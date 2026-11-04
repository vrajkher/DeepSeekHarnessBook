// Chapter 7 debugging challenge — solution test. Run it against the planted bug and the fixed code.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reconcileText } from '../src/reconcile.ts'

const BANK = 'Txn Date,Value Date,Description,Ref No,Debit,Credit,Balance\n'
const TALLY = 'Date,Particulars,Vch Type,Vch No,Instrument No,Debit,Credit\n'

test('R2 never pairs money in with money out of the same size', () => {
  // Bank: ₹100 received. Tally: ₹100 paid. Same date, no references.
  const report = reconcileText(BANK + '01-04-2026,,IN,,,100.00,\n', TALLY + '1-Apr-2026,X,Payment,P1,,,100.00\n')
  assert.deepEqual(report.results.map(r => r.status), ['unmatched', 'unmatched'])
})
