// Book lab integration test for reconcile_bank_tally through the real tool pipeline.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as NativeToolExecutor from '@deepseek-ai/dsh-tool-executor-native'
import LocalFileSystem from '@deepseek-ai/dsh-fs-local'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { ToolCallId } from '@deepseek-ai/dsh-llm'
import * as Reconcile from '../src/plugin.ts'

const fixtures = fileURLToPath(new URL('../fixtures/', import.meta.url))

async function run(config: Record<string, unknown>, args: Record<string, unknown>) {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt, {})
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(NativeToolExecutor)
  await ctx.plugin(LocalFileSystem, { cwd: fixtures })
  await ctx.plugin(Reconcile, config)
  const batch = await ctx.tools.execute({
    calls: [{ type: 'tool-call', id: brandString<ToolCallId>('r-1'), name: 'reconcile_bank_tally', arguments: JSON.stringify(args) }],
    signal: new AbortController().signal,
  })
  await ctx.fiber.dispose()
  const result = batch.results[0]!.result
  return { result, text: result.content.map(b => b.type === 'text' ? b.text : '').join('') }
}

test('the tool returns the same golden text as the library', async () => {
  const { result, text } = await run({}, { bank_path: 'bank-statement.csv', tally_path: 'tally-bank-ledger.csv' })
  assert.equal(result.isError, false)
  assert.equal(text + '\n', readFileSync(`${fixtures}expected-report.txt`, 'utf8'))
})

test('column names come from config, so a renamed export fails loudly until configured', async () => {
  const bad = await run({ bankColumns: { date: 'Posting Date' } }, { bank_path: 'bank-statement.csv', tally_path: 'tally-bank-ledger.csv' })
  assert.equal(bad.result.isError, true)
  assert.match(bad.text, /bank export is missing configured column\(s\) date="Posting Date"/)
})

test('a negative window is refused by the schema-validated arguments', async () => {
  const { result } = await run({}, { bank_path: 'bank-statement.csv', tally_path: 'tally-bank-ledger.csv', window_days: -1 })
  assert.equal(result.isError, true)
})
