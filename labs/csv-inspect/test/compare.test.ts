// Book lab tests: run with `node --import tsx --test labs/csv-inspect/test/*.test.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseCsv } from '../src/csv.ts'
import { compareTables, CompareConfigError, renderReport } from '../src/compare.ts'

const fixture = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), 'utf8')

test('parseCsv keeps quoted commas and reports a short row with its line', () => {
  const table = parseCsv(fixture('export-a.csv'))
  assert.deepEqual(table.header, ['Ref', 'Date', 'Party', 'Amount'])
  assert.equal(table.rows[0]!.values.Party, 'Shah Traders, Surat')
  assert.equal(table.rows.length, 5)
  assert.deepEqual(table.problems, [{ line: 7, code: 'COLUMN_COUNT', message: 'expected 4 fields, found 3' }])
})

test('parseCsv handles CRLF, BOM, doubled quotes and an unterminated quote', () => {
  const ok = parseCsv('﻿A,B\r\n1,"say ""hi"""\r\n')
  assert.deepEqual(ok.rows, [{ line: 2, values: { A: '1', B: 'say "hi"' } }])
  const bad = parseCsv('A,B\n1,"open\n')
  assert.equal(bad.problems.at(-1)?.code, 'UNTERMINATED_QUOTE')
})

test('compareTables classifies every row deterministically', () => {
  const report = compareTables(parseCsv(fixture('export-a.csv')), parseCsv(fixture('export-b.csv')), { keyColumns: ['Ref'] })
  assert.deepEqual(report.summary, {
    leftRows: 5, rightRows: 4, identical: 1, different: 1, onlyLeft: 1, onlyRight: 1, duplicateKeys: 1, problems: 1,
  })
  assert.deepEqual(report.matched.find(m => m.key[0] === 'INV-1002')?.differences, [
    { column: 'Amount', left: '8250.50', right: '8250.00' },
  ])
  assert.deepEqual(report.duplicates, [{ side: 'left', key: ['INV-1004'], lines: [5, 6] }])
  assert.deepEqual(report.onlyLeft, [{ key: ['INV-1003'], line: 4 }])
  assert.deepEqual(report.onlyRight, [{ key: ['INV-1005'], line: 5 }])
})

test('the same input renders byte-identical output', () => {
  const run = () => renderReport(compareTables(parseCsv(fixture('export-a.csv')), parseCsv(fixture('export-b.csv')), { keyColumns: ['Ref'] }))
  assert.equal(run(), run())
})

test('a missing key column fails loudly with the header it saw', () => {
  assert.throws(
    () => compareTables(parseCsv('A\n1\n'), parseCsv('A\n1\n'), { keyColumns: ['Ref'] }),
    (error: unknown) => error instanceof CompareConfigError && /missing from the left header \(A\)/.test(error.message),
  )
})
