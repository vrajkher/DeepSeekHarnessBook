/**
 * Book lab tool (not upstream code): run the upstream mock Messages server in-process
 * and save what the DeepSeek adapter actually sent over HTTP.
 *
 *   node --import tsx tmp/book-labs/request-trace/capture-wire.ts 8001 tool_call_success,success
 *
 * Then point a headless run at http://127.0.0.1:8001/v1 in another terminal.
 * The script exits after the scripted sequence is consumed and writes wire.json.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { startMockLlmServer, type MockLlmBehavior } from '@deepseek-ai/dsh-llm-mock-server'

const port = Number(process.argv[2] ?? 8001)
const sequence = (process.argv[3] ?? 'tool_call_success,success').split(',') as MockLlmBehavior[]
const out = fileURLToPath(new URL('./wire.json', import.meta.url))

const server = await startMockLlmServer({
  port,
  apiKey: 'mock-key',
  sequence,
  toolName: process.env.TOOL_NAME ?? 'read',
  toolArguments: process.env.TOOL_ARGS ?? '{"file_path":"README.md"}',
  successText: process.env.SUCCESS_TEXT ?? 'README નો સાર: DeepSeek Harness એ plugin આધારિત agent harness છે.',
})
process.stderr.write(`capture-wire: listening on ${server.baseURL}/v1, waiting for ${sequence.length} request(s)\n`)

const timer = setInterval(() => {
  const done = server.requests.filter(r => r.outcome !== undefined).length
  if (done < sequence.length) return
  clearInterval(timer)
  const summary = server.requests.map((r) => {
    const body = r.body as Record<string, unknown> & { messages?: { role: string; content: unknown }[]; tools?: { name: string }[] }
    return {
      attempt: r.attempt,
      behavior: r.behavior,
      path: r.path,
      headers: Object.fromEntries(Object.entries(r.headers).filter(([k]) => k.startsWith('anthropic') || k.startsWith('x-deepseek') || k === 'content-type')),
      bodyKeys: Object.keys(body).sort(),
      model: body.model,
      stream: body.stream,
      messageRoles: body.messages?.map(m => m.role),
      lastMessage: body.messages?.at(-1),
      toolNames: body.tools?.map(t => t.name),
      hasSessionLogField: 'dsh_session_log' in body,
    }
  })
  writeFileSync(out, JSON.stringify(summary, null, 2) + '\n')
  process.stderr.write(`capture-wire: wrote ${out}\n`)
  void server.close().then(() => process.exit(0))
}, 100)
