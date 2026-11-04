// Book lab integration test: real harness plugins, no model, no API key.
// Run from <harness>/tmp/book-labs: node --import tsx --test csv-inspect/test/plugin.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as NativeToolExecutor from '@deepseek-ai/dsh-tool-executor-native'
import LocalFileSystem from '@deepseek-ai/dsh-fs-local'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { ToolCallId } from '@deepseek-ai/dsh-llm'
import * as CsvCompare from '../src/plugin.ts'

const fixtures = fileURLToPath(new URL('../fixtures/', import.meta.url))

async function compose(): Promise<Context> {
  const ctx = new Context()
  // Awaiting each plugin makes the order explicit; a cordis.yml would start rows concurrently.
  await ctx.plugin(SystemPrompt, {})
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(NativeToolExecutor)
  await ctx.plugin(LocalFileSystem, { cwd: fixtures })
  await ctx.plugin(CsvCompare, {})
  return ctx
}

async function call(ctx: Context, args: unknown) {
  const batch = await ctx.tools.execute({
    calls: [{ type: 'tool-call', id: brandString<ToolCallId>('t-1'), name: 'csv_compare', arguments: JSON.stringify(args) }],
    signal: new AbortController().signal,
  })
  return batch.results[0]!.result
}

test('csv_compare is registered with a model-facing schema', async () => {
  const ctx = await compose()
  const schema = ctx.tools.schemas().find(s => s.name === 'csv_compare')
  assert.ok(schema, 'tool schema is visible')
  assert.deepEqual((schema.parameters as { required?: string[] }).required, ['left_path', 'right_path', 'key_columns'])
  await ctx.fiber.dispose()
})

test('a valid call returns the rendered report through the real pipeline', async () => {
  const ctx = await compose()
  const result = await call(ctx, { left_path: 'export-a.csv', right_path: 'export-b.csv', key_columns: ['Ref'] })
  assert.equal(result.isError, false)
  const text = result.content.map(b => b.type === 'text' ? b.text : '').join('')
  assert.match(text, /identical 1, different 1, only-left 1, only-right 1, duplicate keys 1, problems 1/)
  assert.match(text, /DIFF INV-1002 \(left L3, right L3\): Amount "8250.50"≠"8250.00"/)
  await ctx.fiber.dispose()
})

test('invalid arguments become an error result, not a crash', async () => {
  const ctx = await compose()
  const result = await call(ctx, { left_path: 'export-a.csv' })
  assert.equal(result.isError, true)
  assert.match(result.content.map(b => b.type === 'text' ? b.text : '').join(''), /^Error: /)
  await ctx.fiber.dispose()
})

test('an unknown file reports not found', async () => {
  const ctx = await compose()
  const result = await call(ctx, { left_path: 'missing.csv', right_path: 'export-b.csv', key_columns: ['Ref'] })
  assert.equal(result.isError, true)
  assert.match(result.content.map(b => b.type === 'text' ? b.text : '').join(''), /not found/)
  await ctx.fiber.dispose()
})

test('unloading the plugin removes the tool (registrations are effects)', async () => {
  const ctx = await compose()
  const fiber = ctx.plugin(CsvCompare, { toolName: 'csv_compare_2' })
  await fiber
  assert.ok(ctx.tools.schemas().some(s => s.name === 'csv_compare_2'))
  await fiber.dispose()
  assert.ok(!ctx.tools.schemas().some(s => s.name === 'csv_compare_2'))
  await ctx.fiber.dispose()
})
