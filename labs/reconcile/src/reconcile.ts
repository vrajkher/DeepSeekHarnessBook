/**
 * Book lab code (not upstream DeepSeek Harness code).
 *
 * Read-only bank ↔ Tally reconciliation. Every output row names the rule that
 * produced it and the exact input lines on both sides, so a reviewer can
 * trace each result back to the files. Rules run in a fixed order:
 *
 *   V1 REJECTED   a row that cannot be parsed (CSV problem, bad date, bad amount, debit and credit both set).
 *   D1 DUPLICATE  rows in ONE file with the same date, amount, reference and text. All copies are held
 *                 for review; picking one would be a guess.
 *   R1 REF_AMOUNT same normalized reference and the same signed amount on both sides, one-to-one.
 *   R2 AMOUNT_DATE same signed amount within ±windowDays, where the candidate group is exactly
 *                 one bank row and one Tally row (connected component of size 1+1).
 *   A1 AMBIGUOUS  a candidate group with more than one row on either side (R1 or R2).
 *   U1 UNMATCHED  everything left.
 *
 * The same inputs always produce the same, sorted report.
 */

import { parseCsv, ROW_PROBLEM_CODES, type CsvTable } from '../../csv-inspect/src/csv.ts'
import {
  assertColumns, dayDistance, isTxn, DEFAULT_BANK_COLUMNS, DEFAULT_TALLY_COLUMNS, normalizeBank, normalizeTally,
  type BankColumns, type Rejection, type TallyColumns, type Txn,
} from './normalize.ts'

export type Status = 'matched' | 'ambiguous' | 'unmatched' | 'duplicate' | 'rejected'
export type RuleId = 'V1' | 'D1' | 'R1' | 'R2' | 'A1' | 'U1'

export interface ResultRow {
  status: Status
  rule: RuleId
  bankLines: number[]
  tallyLines: number[]
  /** Signed paise when the rows agree on one amount; omitted for rejected rows. */
  amount?: number
  reason: string
}

export interface ReconcileReport {
  windowDays: number
  results: ResultRow[]
  totals: {
    bankRows: number
    tallyRows: number
    matched: number
    ambiguous: number
    unmatchedBank: number
    unmatchedTally: number
    duplicates: number
    rejected: number
    /** Sum of matched amounts in paise. */
    matchedAmount: number
    /** Sum of unmatched bank amounts minus unmatched Tally amounts, in paise. */
    unexplainedDifference: number
  }
}

export interface ReconcileOptions {
  windowDays?: number
  bankColumns?: BankColumns
  tallyColumns?: TallyColumns
}

const rupees = (paise: number): string => {
  const sign = paise < 0 ? '-' : ''
  const abs = Math.abs(paise)
  return `${sign}₹${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

function rejectionsFrom(source: 'bank' | 'tally', table: CsvTable): Rejection[] {
  return table.problems.map(p => ({ source, line: p.line, reason: `${p.code}: ${p.message}` }))
}

/** Split out exact duplicates within one side. */
function splitDuplicates(txns: Txn[]): { unique: Txn[]; groups: Txn[][] } {
  const byPrint = new Map<string, Txn[]>()
  for (const t of txns) {
    const group = byPrint.get(t.fingerprint)
    if (group) group.push(t)
    else byPrint.set(t.fingerprint, [t])
  }
  const groups = [...byPrint.values()].filter(g => g.length > 1)
  const held = new Set(groups.flat())
  return { unique: txns.filter(t => !held.has(t)), groups }
}

/** Connected components over bank/tally rows joined by `linked`. */
function components(bank: Txn[], tally: Txn[], linked: (b: Txn, t: Txn) => boolean): { bank: Txn[]; tally: Txn[] }[] {
  const adj = new Map<Txn, Txn[]>()
  for (const t of [...bank, ...tally]) adj.set(t, [])
  for (const b of bank) for (const t of tally) if (linked(b, t)) { adj.get(b)!.push(t); adj.get(t)!.push(b) }
  const seen = new Set<Txn>()
  const out: { bank: Txn[]; tally: Txn[] }[] = []
  for (const start of [...bank, ...tally]) {
    if (seen.has(start) || adj.get(start)!.length === 0) continue
    const comp: Txn[] = []
    const stack = [start]
    seen.add(start)
    while (stack.length > 0) {
      const node = stack.pop()!
      comp.push(node)
      for (const next of adj.get(node)!) if (!seen.has(next)) { seen.add(next); stack.push(next) }
    }
    out.push({ bank: comp.filter(x => x.source === 'bank'), tally: comp.filter(x => x.source === 'tally') })
  }
  return out
}

/** A header that parsed with no empty or repeated names. */
const headerUsable = (table: CsvTable): boolean =>
  table.header.length > 0 && !table.problems.some(p => p.code === 'EMPTY_HEADER' || p.code === 'DUPLICATE_HEADER')

const lines = (txns: Txn[]): number[] => txns.map(t => t.line).sort((a, b) => a - b)

/**
 * Reconcile two parsed exports.
 * @param bankTable - parsed bank statement.
 * @param tallyTable - parsed Tally bank-ledger export.
 * @param options - matching window and column names.
 * @returns a deterministic, fully traced report.
 */
export function reconcileTables(bankTable: CsvTable, tallyTable: CsvTable, options: ReconcileOptions = {}): ReconcileReport {
  const windowDays = options.windowDays ?? 3
  if (!Number.isInteger(windowDays) || windowDays < 0) throw new RangeError('windowDays must be a non-negative integer')
  const results: ResultRow[] = []

  // V1: CSV-level and field-level rejections.
  // A header that parsed cleanly must contain every configured column; an invalid or
  // missing header already refuses its rows as V1 problems.
  const bankColumns = options.bankColumns ?? DEFAULT_BANK_COLUMNS
  const tallyColumns = options.tallyColumns ?? DEFAULT_TALLY_COLUMNS
  if (headerUsable(bankTable)) assertColumns('bank', bankTable.header, bankColumns)
  if (headerUsable(tallyTable)) assertColumns('tally', tallyTable.header, tallyColumns)
  const bankNorm = normalizeBank(bankTable.rows, bankColumns)
  const tallyNorm = normalizeTally(tallyTable.rows, tallyColumns)
  const rejected = [
    ...rejectionsFrom('bank', bankTable), ...rejectionsFrom('tally', tallyTable),
    ...[...bankNorm, ...tallyNorm].filter((x): x is Rejection => !isTxn(x)),
  ]
  for (const r of rejected) {
    results.push({
      status: 'rejected', rule: 'V1',
      bankLines: r.source === 'bank' ? [r.line] : [], tallyLines: r.source === 'tally' ? [r.line] : [],
      reason: r.reason,
    })
  }

  // D1: duplicates within each file.
  const bankDup = splitDuplicates(bankNorm.filter(isTxn))
  const tallyDup = splitDuplicates(tallyNorm.filter(isTxn))
  for (const group of [...bankDup.groups, ...tallyDup.groups]) {
    const source = group[0]!.source
    results.push({
      status: 'duplicate', rule: 'D1',
      bankLines: source === 'bank' ? lines(group) : [], tallyLines: source === 'tally' ? lines(group) : [],
      amount: group[0]!.amount,
      reason: `${group.length} identical ${source} rows (date ${group[0]!.date}, ${rupees(group[0]!.amount)}); held for review`,
    })
  }

  let bank = bankDup.unique
  let tally = tallyDup.unique

  // R1 / A1: reference + amount.
  const byRef = components(bank, tally, (b, t) => b.ref !== '' && b.ref === t.ref && b.amount === t.amount)
  const used = new Set<Txn>()
  for (const c of byRef) {
    const all = [...c.bank, ...c.tally]
    all.forEach(x => used.add(x))
    if (c.bank.length === 1 && c.tally.length === 1) {
      results.push({ status: 'matched', rule: 'R1', bankLines: lines(c.bank), tallyLines: lines(c.tally), amount: c.bank[0]!.amount, reason: `reference ${c.bank[0]!.ref} and amount ${rupees(c.bank[0]!.amount)} agree` })
    } else {
      results.push({ status: 'ambiguous', rule: 'A1', bankLines: lines(c.bank), tallyLines: lines(c.tally), amount: c.bank[0]!.amount, reason: `reference ${c.bank[0]!.ref} links ${c.bank.length} bank and ${c.tally.length} Tally rows` })
    }
  }
  bank = bank.filter(x => !used.has(x))
  tally = tally.filter(x => !used.has(x))

  // R2 / A1: amount within the date window.
  const byAmount = components(bank, tally, (b, t) => b.amount === t.amount && dayDistance(b.date, t.date) <= windowDays)
  for (const c of byAmount) {
    const all = [...c.bank, ...c.tally]
    all.forEach(x => used.add(x))
    if (c.bank.length === 1 && c.tally.length === 1) {
      const days = dayDistance(c.bank[0]!.date, c.tally[0]!.date)
      results.push({ status: 'matched', rule: 'R2', bankLines: lines(c.bank), tallyLines: lines(c.tally), amount: c.bank[0]!.amount, reason: `amount ${rupees(c.bank[0]!.amount)} agrees; dates ${days} day(s) apart (window ${windowDays})` })
    } else {
      results.push({ status: 'ambiguous', rule: 'A1', bankLines: lines(c.bank), tallyLines: lines(c.tally), amount: c.bank[0]!.amount, reason: `amount ${rupees(c.bank[0]!.amount)} within ${windowDays} day(s) fits ${c.bank.length} bank and ${c.tally.length} Tally rows` })
    }
  }

  // U1: leftovers, with a note when a duplicate group shares the reference.
  const heldRefs = new Map<string, number[]>()
  for (const g of [...bankDup.groups, ...tallyDup.groups]) if (g[0]!.ref !== '') heldRefs.set(`${g[0]!.source}:${g[0]!.ref}`, lines(g))
  for (const t of [...bank, ...tally].filter(x => !used.has(x))) {
    const other = t.source === 'bank' ? 'tally' : 'bank'
    const held = t.ref === '' ? undefined : heldRefs.get(`${other}:${t.ref}`)
    results.push({
      status: 'unmatched', rule: 'U1',
      bankLines: t.source === 'bank' ? [t.line] : [], tallyLines: t.source === 'tally' ? [t.line] : [],
      amount: t.amount,
      reason: held === undefined
        ? `no ${other} row with this reference or amount within ${windowDays} day(s)`
        : `reference ${t.ref} also appears in held ${other} duplicates (lines ${held.join(', ')})`,
    })
  }

  const order: Record<Status, number> = { matched: 0, ambiguous: 1, unmatched: 2, duplicate: 3, rejected: 4 }
  const firstLine = (r: ResultRow): number => Math.min(...r.bankLines.map(l => l * 2), ...r.tallyLines.map(l => l * 2 + 1))
  results.sort((a, b) => order[a.status] - order[b.status] || firstLine(a) - firstLine(b))

  const sum = (rows: ResultRow[]): number => rows.reduce((acc, r) => acc + (r.amount ?? 0), 0)
  const unmatchedBank = results.filter(r => r.status === 'unmatched' && r.bankLines.length > 0)
  const unmatchedTally = results.filter(r => r.status === 'unmatched' && r.tallyLines.length > 0)
  return {
    windowDays,
    results,
    totals: {
      bankRows: bankTable.rows.length + bankTable.problems.filter(p => ROW_PROBLEM_CODES.has(p.code)).length,
      tallyRows: tallyTable.rows.length + tallyTable.problems.filter(p => ROW_PROBLEM_CODES.has(p.code)).length,
      matched: results.filter(r => r.status === 'matched').length,
      ambiguous: results.filter(r => r.status === 'ambiguous').length,
      unmatchedBank: unmatchedBank.length,
      unmatchedTally: unmatchedTally.length,
      duplicates: results.filter(r => r.status === 'duplicate').length,
      rejected: results.filter(r => r.status === 'rejected').length,
      matchedAmount: sum(results.filter(r => r.status === 'matched')),
      unexplainedDifference: sum(unmatchedBank) - sum(unmatchedTally),
    },
  }
}

/** Parse and reconcile raw CSV text. */
export function reconcileText(bankCsv: string, tallyCsv: string, options: ReconcileOptions = {}): ReconcileReport {
  return reconcileTables(parseCsv(bankCsv), parseCsv(tallyCsv), options)
}

/** Model-facing rendering; the JSON report stays the canonical value. */
export function renderReconciliation(report: ReconcileReport): string {
  const t = report.totals
  const out = [
    `bank rows ${t.bankRows}, tally rows ${t.tallyRows}, window ±${report.windowDays} day(s)`,
    `matched ${t.matched} (${rupees(t.matchedAmount)}), ambiguous ${t.ambiguous}, unmatched bank ${t.unmatchedBank}, unmatched tally ${t.unmatchedTally}, duplicates ${t.duplicates}, rejected ${t.rejected}`,
    `unexplained difference (unmatched bank - unmatched tally): ${rupees(t.unexplainedDifference)}`,
  ]
  for (const r of report.results) {
    const where = [r.bankLines.length ? `bank L${r.bankLines.join(',L')}` : '', r.tallyLines.length ? `tally L${r.tallyLines.join(',L')}` : ''].filter(Boolean).join(' ↔ ')
    out.push(`${r.status.toUpperCase()} [${r.rule}] ${where}${r.amount === undefined ? '' : ` ${rupees(r.amount)}`}: ${r.reason}`)
  }
  return out.join('\n')
}
