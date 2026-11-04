/**
 * Book lab code (not upstream DeepSeek Harness code).
 *
 * Measure two behaviors without changing them:
 *  - model calls: every request entering the `llm/stream` waterfall, split by purpose;
 *  - tool latency: wall time around the `tools/execute` waterfall (around-dispatch),
 *    which includes the tool body but not pre-execute policy or post-execute rewriting.
 * Both listeners delegate with next(), so behavior is unchanged.
 * On unload it writes a JSON summary to stderr (and to $BOOK_METRICS_FILE when set).
 */

import { writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-llm'

export const name = 'book-metrics'
export const inject = ['tools', 'llm']

export function apply(ctx: Context): void {
  const calls: { purpose: string; messages: number }[] = []
  const tools: { name: string; ms: number; isError: boolean }[] = []

  ctx.on('llm/stream', (options, next) => {
    calls.push({ purpose: options.purpose ?? 'agent', messages: options.messages.length })
    return next()
  })

  ctx.on('tools/execute', async (exec, next) => {
    const start = performance.now()
    const result = await next()
    tools.push({ name: exec.name, ms: Math.round((performance.now() - start) * 100) / 100, isError: result.isError === true })
    return result
  })

  ctx.effect(() => () => {
    const summary = { modelCalls: calls.length, calls, toolCalls: tools.length, tools }
    const text = JSON.stringify(summary)
    process.stderr.write(`[metrics] ${text}\n`)
    if (process.env.BOOK_METRICS_FILE) writeFileSync(process.env.BOOK_METRICS_FILE, text + '\n')
  })
}
