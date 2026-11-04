/**
 * Book lab code (not upstream DeepSeek Harness code).
 *
 * Deterministic comparison of two CSV exports by key columns. Rules:
 *  1. A key is the trimmed values of the key columns joined with U+001F.
 *  2. A key that appears more than once on either side is a DUPLICATE: none of
 *     its rows is matched, because choosing one would be a guess. The group
 *     lists the key's lines on BOTH sides, so every input row stays traceable.
 *  3. A key present exactly once on both sides is MATCHED; the compare
 *     columns decide whether the pair is identical or lists differences.
 *  4. Every other row is unmatched on its side.
 * Output arrays are sorted by key, then line, so the same input always
 * produces byte-identical JSON.
 */

import type { CsvProblem, CsvRow, CsvTable } from './csv.ts'

export interface CompareOptions {
  /** Columns that identify a record on both sides. */
  keyColumns: string[]
  /** Columns compared for matched pairs; defaults to shared non-key columns. */
  compareColumns?: string[]
}

export interface FieldDifference { column: string; left: string; right: string }

export interface MatchedPair {
  key: string[]
  leftLine: number
  rightLine: number
  differences: FieldDifference[]
}

export interface UnmatchedRow { key: string[]; line: number }

export interface DuplicateKey { key: string[]; left: number[]; right: number[] }

export interface SideProblem extends CsvProblem { side: 'left' | 'right' }

export interface CompareReport {
  keyColumns: string[]
  compareColumns: string[]
  summary: {
    leftRows: number
    rightRows: number
    identical: number
    different: number
    onlyLeft: number
    onlyRight: number
    duplicateKeys: number
    problems: number
  }
  matched: MatchedPair[]
  onlyLeft: UnmatchedRow[]
  onlyRight: UnmatchedRow[]
  duplicates: DuplicateKey[]
  problems: SideProblem[]
}

/** Raised for caller mistakes such as a key column missing from a header. */
export class CompareConfigError extends Error {
  readonly code = 'CSV_COMPARE_CONFIG'
}

const SEP = '\u001f'

function keyOf(row: CsvRow, columns: string[]): string[] {
  return columns.map(c => row.values[c] ?? '')
}

function index(rows: CsvRow[], columns: string[]): Map<string, CsvRow[]> {
  const map = new Map<string, CsvRow[]>()
  for (const row of rows) {
    const k = keyOf(row, columns).join(SEP)
    const bucket = map.get(k)
    if (bucket === undefined) map.set(k, [row])
    else bucket.push(row)
  }
  return map
}

const byKeyThenLine = <T extends { key: string[] }>(lineOf: (x: T) => number) => (a: T, b: T): number => {
  const ka = a.key.join(SEP)
  const kb = b.key.join(SEP)
  if (ka !== kb) return ka < kb ? -1 : 1
  return lineOf(a) - lineOf(b)
}

/**
 * Compare two parsed tables.
 * @param left - the first export (for example the bank statement).
 * @param right - the second export (for example the ledger).
 * @param options - key and compare columns.
 * @returns a deterministic report; parse problems from both sides are carried through.
 * @throws CompareConfigError when a key or compare column is absent from either header.
 */
export function compareTables(left: CsvTable, right: CsvTable, options: CompareOptions): CompareReport {
  const { keyColumns } = options
  if (keyColumns.length === 0) throw new CompareConfigError('at least one key column is required')
  for (const [side, table] of [['left', left], ['right', right]] as const) {
    for (const column of keyColumns) {
      if (!table.header.includes(column)) {
        throw new CompareConfigError(`key column "${column}" is missing from the ${side} header (${table.header.join(', ')})`)
      }
    }
  }
  const compareColumns = options.compareColumns
    ?? left.header.filter(c => right.header.includes(c) && !keyColumns.includes(c))
  for (const column of compareColumns) {
    if (!left.header.includes(column) || !right.header.includes(column)) {
      throw new CompareConfigError(`compare column "${column}" must exist in both headers`)
    }
  }

  const leftIndex = index(left.rows, keyColumns)
  const rightIndex = index(right.rows, keyColumns)
  const duplicates: DuplicateKey[] = []
  const duplicateKeys = new Set<string>()
  for (const map of [leftIndex, rightIndex]) {
    for (const [k, rows] of map) if (rows.length > 1) duplicateKeys.add(k)
  }
  for (const k of duplicateKeys) {
    duplicates.push({
      key: k.split(SEP),
      left: (leftIndex.get(k) ?? []).map(r => r.line),
      right: (rightIndex.get(k) ?? []).map(r => r.line),
    })
  }

  const matched: MatchedPair[] = []
  const onlyLeft: UnmatchedRow[] = []
  const onlyRight: UnmatchedRow[] = []
  for (const [k, rows] of leftIndex) {
    if (duplicateKeys.has(k)) continue
    const other = rightIndex.get(k)
    const leftRow = rows[0]!
    if (other === undefined) { onlyLeft.push({ key: k.split(SEP), line: leftRow.line }); continue }
    const rightRow = other[0]!
    const differences = compareColumns
      .filter(c => (leftRow.values[c] ?? '') !== (rightRow.values[c] ?? ''))
      .map(c => ({ column: c, left: leftRow.values[c] ?? '', right: rightRow.values[c] ?? '' }))
    matched.push({ key: k.split(SEP), leftLine: leftRow.line, rightLine: rightRow.line, differences })
  }
  for (const [k, rows] of rightIndex) {
    if (duplicateKeys.has(k) || leftIndex.has(k)) continue
    onlyRight.push({ key: k.split(SEP), line: rows[0]!.line })
  }

  matched.sort(byKeyThenLine(m => m.leftLine))
  onlyLeft.sort(byKeyThenLine(u => u.line))
  onlyRight.sort(byKeyThenLine(u => u.line))
  duplicates.sort(byKeyThenLine<DuplicateKey>(d => d.left[0] ?? d.right[0]!))
  const problems: SideProblem[] = [
    ...left.problems.map(p => ({ ...p, side: 'left' as const })),
    ...right.problems.map(p => ({ ...p, side: 'right' as const })),
  ]

  return {
    keyColumns,
    compareColumns,
    summary: {
      leftRows: left.rows.length,
      rightRows: right.rows.length,
      identical: matched.filter(m => m.differences.length === 0).length,
      different: matched.filter(m => m.differences.length > 0).length,
      onlyLeft: onlyLeft.length,
      onlyRight: onlyRight.length,
      duplicateKeys: duplicates.length,
      problems: problems.length,
    },
    matched,
    onlyLeft,
    onlyRight,
    duplicates,
    problems,
  }
}

/**
 * Render a report as short model-facing text. The JSON report stays the canonical value.
 * @param report - the comparison report.
 * @returns a few lines a model can quote back to a user.
 */
export function renderReport(report: CompareReport): string {
  const s = report.summary
  const lines = [
    `key: ${report.keyColumns.join(' + ')}; compared: ${report.compareColumns.join(', ') || '(none)'}`,
    `left rows ${s.leftRows}, right rows ${s.rightRows}`,
    `identical ${s.identical}, different ${s.different}, only-left ${s.onlyLeft}, only-right ${s.onlyRight}, duplicate keys ${s.duplicateKeys}, problems ${s.problems}`,
  ]
  for (const m of report.matched.filter(x => x.differences.length > 0)) {
    lines.push(`DIFF ${m.key.join('/')} (left L${m.leftLine}, right L${m.rightLine}): ${m.differences.map(d => `${d.column} ${JSON.stringify(d.left)}≠${JSON.stringify(d.right)}`).join('; ')}`)
  }
  for (const u of report.onlyLeft) lines.push(`ONLY-LEFT ${u.key.join('/')} (L${u.line})`)
  for (const u of report.onlyRight) lines.push(`ONLY-RIGHT ${u.key.join('/')} (L${u.line})`)
  for (const d of report.duplicates) lines.push(`DUPLICATE ${d.key.join('/')} (left ${d.left.length ? 'L' + d.left.join(', L') : '-'}; right ${d.right.length ? 'L' + d.right.join(', L') : '-'})`)
  for (const p of report.problems) lines.push(`PROBLEM ${p.side} L${p.line} ${p.code}: ${p.message}`)
  return lines.join('\n')
}
