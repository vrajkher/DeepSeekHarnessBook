// Book lab tests: node --import tsx --test reconcile/test/*.test.ts (from <harness>/tmp/book-labs)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseAmount, parseDate, normalizeRef } from '../src/normalize.ts'
import { reconcileText, renderReconciliation } from '../src/reconcile.ts'
import { ReconcileConfigError } from '../src/normalize.ts'

const fx = (name: string): string => readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), 'utf8')
const BANK_HEADER = 'Txn Date,Value Date,Description,Ref No,Debit,Credit,Balance\n'
const TALLY_HEADER = 'Date,Particulars,Vch Type,Vch No,Instrument No,Debit,Credit\n'

test('parsers accept export spellings and refuse impossible values', () => {
  assert.equal(parseDate('1-Apr-2026'), '2026-04-01')
  assert.equal(parseDate('01/04/2026'), '2026-04-01')
  assert.equal(parseDate('29-02-2028'), '2028-02-29')
  assert.equal(parseDate('31-02-2026'), undefined)
  assert.equal(parseAmount('1,23,456.50'), 12_345_650)
  assert.equal(parseAmount('12,00x.00'), undefined)
  assert.equal(parseAmount('1.234'), undefined)
  assert.equal(normalizeRef('004512'), '4512')
  assert.equal(normalizeRef(' n09-14 '), 'N0914')
  assert.equal(normalizeRef('-'), '')
})

test('golden report for the synthetic fixtures', () => {
  const report = reconcileText(fx('bank-statement.csv'), fx('tally-bank-ledger.csv'))
  assert.equal(renderReconciliation(report) + '\n', fx('expected-report.txt'))
})

test('every input row appears in exactly one result', () => {
  const report = reconcileText(fx('bank-statement.csv'), fx('tally-bank-ledger.csv'))
  const bank = report.results.flatMap(r => r.bankLines).sort((a, b) => a - b)
  const tally = report.results.flatMap(r => r.tallyLines).sort((a, b) => a - b)
  assert.deepEqual(bank, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  assert.deepEqual(tally, [2, 3, 4, 5, 6, 7, 8, 9])
})

test('R1 needs both reference and amount; a different amount falls through', () => {
  const bank = BANK_HEADER + '01-04-2026,,X,REF9,,100.00,\n'
  const tally = TALLY_HEADER + '20-Apr-2026,X,Receipt,R1,REF9,100.50,\n'
  const report = reconcileText(bank, tally)
  assert.deepEqual(report.results.map(r => `${r.status}/${r.rule}`), ['unmatched/U1', 'unmatched/U1'])
})

test('R2 respects the window and A1 refuses to guess', () => {
  const bank = BANK_HEADER + '01-04-2026,,X,,,100.00,\n'
  const tallyNear = TALLY_HEADER + '3-Apr-2026,X,Receipt,R1,,100.00,\n'
  assert.equal(reconcileText(bank, tallyNear, { windowDays: 2 }).results[0]!.rule, 'R2')
  assert.equal(reconcileText(bank, tallyNear, { windowDays: 1 }).results[0]!.rule, 'U1')
  const tallyTwo = tallyNear + '2-Apr-2026,Y,Receipt,R2,,100.00,\n'
  const amb = reconcileText(bank, tallyTwo).results[0]!
  assert.equal(amb.rule, 'A1')
  assert.deepEqual(amb.tallyLines, [2, 3])
})

test('two bank rows competing for one Tally row are ambiguous, not first-come', () => {
  const bank = BANK_HEADER + '01-04-2026,,A,,,100.00,\n02-04-2026,,B,,,100.00,\n'
  const tally = TALLY_HEADER + '1-Apr-2026,X,Receipt,R1,,100.00,\n'
  const r = reconcileText(bank, tally).results
  assert.equal(r.length, 1)
  assert.deepEqual([r[0]!.rule, r[0]!.bankLines, r[0]!.tallyLines], ['A1', [2, 3], [2]])
})

test('results are deterministic across runs', () => {
  const a = JSON.stringify(reconcileText(fx('bank-statement.csv'), fx('tally-bank-ledger.csv')))
  const b = JSON.stringify(reconcileText(fx('bank-statement.csv'), fx('tally-bank-ledger.csv')))
  assert.equal(a, b)
})

test('a missing monetary column is a configuration error, not a zero', () => {
  const bank = 'Txn Date,Value Date,Description,Ref No,Withdrawal,Credit,Balance\n01-04-2026,,X,R9,900.00,100.00,\n'
  const tally = 'Date,Particulars,Vch Type,Vch No,Instrument No,Debit,Credit\n1-Apr-2026,X,Receipt,R1,R9,100.00,\n'
  assert.throws(() => reconcileText(bank, tally), (e: unknown) => e instanceof ReconcileConfigError && /debit="Debit"/.test(e.message))
})

test('an invalid header rejects its rows as V1 and still accounts for them', () => {
  const bank = 'Txn Date,Txn Date,Description,Ref No,Debit,Credit,Balance\n01-04-2026,x,X,R9,,100.00,\n'
  const tally = 'Date,Particulars,Vch Type,Vch No,Instrument No,Debit,Credit\n1-Apr-2026,X,Receipt,R1,R9,100.00,\n'
  const r = reconcileText(bank, tally)
  assert.equal(r.totals.bankRows, 1)
  assert.deepEqual(r.results.filter(x => x.bankLines.includes(2)).map(x => x.rule), ['V1'])
  assert.equal(r.totals.matched, 0)
})
