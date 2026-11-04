/**
 * Book lab code (not upstream DeepSeek Harness code).
 *
 * Turn raw CSV rows from a bank statement and a Tally bank-ledger export into
 * one comparable shape. All money is integer paise; all dates are ISO
 * YYYY-MM-DD strings. Nothing here uses floating point or the local timezone.
 */

import type { CsvRow } from '../../csv-inspect/src/csv.ts'

/** A transaction seen from the bank account's side: positive means money into the bank. */
export interface Txn {
  source: 'bank' | 'tally'
  line: number
  date: string
  /** Signed paise: + money in, - money out. */
  amount: number
  /** Normalized reference (UTR, cheque, UPI id) or '' when absent. */
  ref: string
  text: string
  /** Fingerprint of the raw row, used to find exact duplicates within one file. */
  fingerprint: string
}

/** A row that could not be normalized, and why. */
export interface Rejection { source: 'bank' | 'tally'; line: number; reason: string }

/** Header names for each export; deployments with different bank formats change these in config. */
export interface BankColumns { date: string; text: string; ref: string; debit: string; credit: string }
export interface TallyColumns { date: string; text: string; ref: string; voucher: string; debit: string; credit: string }

export const DEFAULT_BANK_COLUMNS: BankColumns = { date: 'Txn Date', text: 'Description', ref: 'Ref No', debit: 'Debit', credit: 'Credit' }
export const DEFAULT_TALLY_COLUMNS: TallyColumns = { date: 'Date', text: 'Particulars', ref: 'Instrument No', voucher: 'Vch No', debit: 'Debit', credit: 'Credit' }

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }

function isoDate(y: number, m: number, d: number): string | undefined {
  if (m < 1 || m > 12 || d < 1) return undefined
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]!
  if (d > days) return undefined
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * Parse the date spellings these exports use: YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, D-Mon-YYYY, D-Mon-YY.
 * @returns ISO date, or undefined for anything else, including impossible dates such as 31-02-2026.
 */
export function parseDate(raw: string): string | undefined {
  const s = raw.trim()
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (m) return isoDate(+m[1]!, +m[2]!, +m[3]!)
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(s)
  if (m) return isoDate(+m[3]!, +m[2]!, +m[1]!)
  m = /^(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})$/.exec(s)
  if (m) {
    const month = MONTHS[m[2]!.toLowerCase()]
    if (month === undefined) return undefined
    const year = m[3]!.length === 2 ? 2000 + +m[3]! : +m[3]!
    return isoDate(year, month, +m[1]!)
  }
  return undefined
}

/**
 * Parse an Indian-format amount such as "1,23,456.50" into paise. Empty means zero.
 * @returns paise, or undefined when the text is not a plain non-negative amount with at most 2 decimals.
 */
export function parseAmount(raw: string): number | undefined {
  const s = raw.trim().replace(/,/g, '')
  if (s === '') return 0
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s)
  if (!m) return undefined
  const paise = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'))
  return Number.isSafeInteger(paise) ? paise : undefined
}

/** Normalize a reference: uppercase alphanumerics; strip leading zeros of all-digit refs; '-' means none. */
export function normalizeRef(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (s === '') return ''
  return /^\d+$/.test(s) ? s.replace(/^0+(?=\d)/, '') : s
}

/** Days between two ISO dates (absolute). */
export function dayDistance(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000
}

function normalizeRow(
  source: 'bank' | 'tally', row: CsvRow, cols: { date: string; text: string; ref: string; debit: string; credit: string },
  sign: 1 | -1, extraText = '',
): Txn | Rejection {
  const v = row.values
  const date = parseDate(v[cols.date] ?? '')
  if (date === undefined) return { source, line: row.line, reason: `invalid date ${JSON.stringify(v[cols.date] ?? '')}` }
  const debit = parseAmount(v[cols.debit] ?? '')
  const credit = parseAmount(v[cols.credit] ?? '')
  if (debit === undefined) return { source, line: row.line, reason: `invalid debit ${JSON.stringify(v[cols.debit])}` }
  if (credit === undefined) return { source, line: row.line, reason: `invalid credit ${JSON.stringify(v[cols.credit])}` }
  if (debit > 0 && credit > 0) return { source, line: row.line, reason: 'both debit and credit are filled' }
  if (debit === 0 && credit === 0) return { source, line: row.line, reason: 'neither debit nor credit is filled' }
  // Bank statements: credit is money in. Tally bank ledgers: debit is money in. `sign` encodes that.
  const amount = sign * (credit - debit)
  const text = [v[cols.text] ?? '', extraText].filter(Boolean).join(' ')
  return {
    source, line: row.line, date, amount, ref: normalizeRef(v[cols.ref] ?? ''), text,
    fingerprint: JSON.stringify([date, amount, normalizeRef(v[cols.ref] ?? ''), (v[cols.text] ?? '').trim().toUpperCase()]),
  }
}

/** Raised when a configured column is absent from an export's header. */
export class ReconcileConfigError extends Error {
  readonly code = 'RECONCILE_CONFIG'
}

/**
 * Require every configured column in the header, so a renamed export fails loudly
 * instead of reading missing debit/credit cells as zero.
 * @param source - which export, for the message.
 * @param header - the parsed header names.
 * @param cols - the configured column names.
 * @throws ReconcileConfigError naming the missing columns and the header it saw.
 */
export function assertColumns(source: 'bank' | 'tally', header: string[], cols: BankColumns | TallyColumns): void {
  const missing = Object.entries(cols).filter(([, name]) => !header.includes(name))
  if (missing.length > 0) {
    throw new ReconcileConfigError(
      `${source} export is missing configured column(s) ${missing.map(([field, name]) => `${field}=${JSON.stringify(name)}`).join(', ')}; header is (${header.join(', ')})`,
    )
  }
}

export function normalizeBank(rows: CsvRow[], cols: BankColumns = DEFAULT_BANK_COLUMNS): (Txn | Rejection)[] {
  return rows.map(row => normalizeRow('bank', row, cols, 1))
}

export function normalizeTally(rows: CsvRow[], cols: TallyColumns = DEFAULT_TALLY_COLUMNS): (Txn | Rejection)[] {
  return rows.map(row => normalizeRow('tally', row, cols, -1, row.values[cols.voucher] ? `[${row.values[cols.voucher]}]` : ''))
}

export const isTxn = (x: Txn | Rejection): x is Txn => 'amount' in x
