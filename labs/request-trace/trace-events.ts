/**
 * Book lab code (not upstream DeepSeek Harness code).
 *
 * An observer plugin for Level 1. It changes nothing; it prints one line per
 * durable Session event, a compact summary of live assistant-stream frames,
 * every LLM request entering `llm/stream`, and every finished tool result.
 * Output goes to stderr so headless stdout stays the final answer.
 *
 * Insert it with an overlay (see overlay.yml) and an ABSOLUTE module path.
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-llm'

export const name = 'book-trace-events'
export const inject = ['sessions', 'agents', 'tools', 'llm']

export function apply(ctx: Context): void {
  const t0 = Date.now()
  const log = (line: string): void => { process.stderr.write(`[trace +${String(Date.now() - t0).padStart(5)}ms] ${line}\n`) }
  let llmCalls = 0
  const chunkCounts = new Map<string, number>()

  // Durable facts: everything here is also written to the Session log.
  ctx.on('session/event', (_session, event) => {
    const data = event.data as Record<string, unknown>
    let detail = ''
    if (event.type === 'tool/call') detail = ` name=${String(data.name)} arguments=${String(data.arguments)}`
    if (event.type === 'turn/end') detail = ` reason=${JSON.stringify(data.reason)}`
    if (event.type === 'turn/start' || event.type === 'step/start' || event.type === 'step/end') detail = ` ${JSON.stringify(data)}`
    log(`session/event #${String(event.seq)} ${event.type}${detail}`)
  })

  // Live only: chunk frames are transient; the committed end frame points at the durable event.
  ctx.on('agent/assistant-stream', ({ frame }) => {
    const id = String(frame.attemptId)
    if (frame.type === 'start') { chunkCounts.set(id, 0); log(`live  stream start turn=${frame.turn} step=${frame.step}`) }
    if (frame.type === 'chunk') chunkCounts.set(id, (chunkCounts.get(id) ?? 0) + 1)
    if (frame.type === 'end') {
      const outcome = frame.outcome.kind === 'committed' ? `${frame.outcome.eventType} #${String(frame.outcome.seq)}` : 'abandoned'
      log(`live  stream end chunks=${chunkCounts.get(id) ?? 0} -> ${outcome}`)
    }
  })

  // Every model request passes this waterfall; we observe and delegate with next().
  ctx.on('llm/stream', (options, next) => {
    llmCalls += 1
    const tools = options.tools?.map(tool => tool.name).join(',') ?? ''
    log(`llm/stream call #${llmCalls} ${options.provider}/${options.model} messages=${options.messages.length} tools=[${tools.length > 80 ? tools.slice(0, 80) + '…' : tools}]`)
    return next()
  })

  ctx.on('tools/result', (exec, result) => {
    const text = result.content.map(block => block.type === 'text' ? block.text : `[${block.type}]`).join('')
    log(`tools/result ${exec.name} isError=${String(result.isError)} chars=${text.length}`)
  })

  ctx.effect(() => () => { log(`dispose: total llm/stream calls = ${llmCalls}`) })
}
