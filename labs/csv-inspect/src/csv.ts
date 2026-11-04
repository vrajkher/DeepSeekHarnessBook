/**
 * Book lab code (not upstream DeepSeek Harness code).
 *
 * A small, deterministic CSV reader for the csv_compare tool. It supports the
 * RFC 4180 subset that typical bank and accounting exports use: comma
 * separators, double-quoted fields, doubled quotes inside quoted fields, and
 * LF or CRLF line endings. It never guesses: a row that does not fit is
 * reported as a structured problem with its 1-based line number.
 */

/** One data row with the physical line where it started. */
export interface CsvRow {
  /** 1-based line number of the row in the source text (header is line 1). */
  line: number
  /** Field values keyed by header name. */
  values: Record<string, string>
}

/** A row the reader refused, with the reason. */
export interface CsvProblem {
  line: number
  code: 'COLUMN_COUNT' | 'UNTERMINATED_QUOTE' | 'EMPTY_HEADER' | 'DUPLICATE_HEADER' | 'INVALID_HEADER'
  message: string
}

/** Problem codes that stand for one refused data row (as opposed to the header or the file). */
export const ROW_PROBLEM_CODES: ReadonlySet<CsvProblem['code']> = new Set(['COLUMN_COUNT', 'INVALID_HEADER'])

/** Parsed table: header, accepted rows, and refused rows. */
export interface CsvTable {
  header: string[]
  rows: CsvRow[]
  problems: CsvProblem[]
}

/** Split raw text into records of fields, tracking the start line of each record. */
function tokenize(text: string): { records: { line: number; fields: string[] }[]; unterminatedAt?: number } {
  const records: { line: number; fields: string[] }[] = []
  let fields: string[] = []
  let field = ''
  let inQuotes = false
  let line = 1
  let recordLine = 1
  let quoteStartLine = 1
  // Strip a UTF-8 byte order mark, which spreadsheet exports often add.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else {
        if (ch === '\n') line++
        field += ch
      }
      continue
    }
    if (ch === '"' && field === '') { inQuotes = true; quoteStartLine = line; continue }
    if (ch === ',') { fields.push(field); field = ''; continue }
    if (ch === '\r' && src[i + 1] === '\n') continue
    if (ch === '\n') {
      fields.push(field)
      records.push({ line: recordLine, fields })
      fields = []; field = ''
      line++; recordLine = line
      continue
    }
    field += ch
  }
  if (inQuotes) return { records, unterminatedAt: quoteStartLine }
  if (field !== '' || fields.length > 0) {
    fields.push(field)
    records.push({ line: recordLine, fields })
  }
  return { records }
}

/**
 * Parse CSV text into a header and rows.
 * @param text - the whole file content.
 * @returns accepted rows and structured problems; blank lines are skipped.
 */
export function parseCsv(text: string): CsvTable {
  const { records, unterminatedAt } = tokenize(text)
  const problems: CsvProblem[] = []
  const nonBlank = records.filter(r => !(r.fields.length === 1 && r.fields[0]!.trim() === ''))
  const headerRecord = nonBlank[0]
  if (headerRecord === undefined) {
    return { header: [], rows: [], problems: [{ line: 1, code: 'EMPTY_HEADER', message: 'file has no header row' }] }
  }
  const header = headerRecord.fields.map(h => h.trim())
  const seen = new Set<string>()
  for (const name of header) {
    if (name === '') problems.push({ line: headerRecord.line, code: 'EMPTY_HEADER', message: 'header contains an empty column name' })
    else if (seen.has(name)) problems.push({ line: headerRecord.line, code: 'DUPLICATE_HEADER', message: `header repeats column "${name}"` })
    seen.add(name)
  }
  // An empty or repeated column name makes every row ambiguous, so no row is accepted.
  const headerInvalid = problems.length > 0
  const rows: CsvRow[] = []
  for (const record of nonBlank.slice(1)) {
    if (headerInvalid) {
      problems.push({ line: record.line, code: 'INVALID_HEADER', message: `row refused because the header on line ${headerRecord.line} is invalid` })
      continue
    }
    if (record.fields.length !== header.length) {
      problems.push({
        line: record.line,
        code: 'COLUMN_COUNT',
        message: `expected ${header.length} fields, found ${record.fields.length}`,
      })
      continue
    }
    const values: Record<string, string> = {}
    header.forEach((name, index) => { values[name] = record.fields[index]!.trim() })
    rows.push({ line: record.line, values })
  }
  if (unterminatedAt !== undefined) {
    problems.push({ line: unterminatedAt, code: 'UNTERMINATED_QUOTE', message: 'quoted field is not closed before end of file' })
  }
  return { header, rows, problems }
}
