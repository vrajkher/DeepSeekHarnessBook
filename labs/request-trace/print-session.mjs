#!/usr/bin/env node
// Book lab tool (not upstream code): print a stored Session log one event per line.
// Usage: node print-session.mjs <path to session.vN.jsonl or session.vN.jsonl.zstd> [--full]
// Requires Node.js with zlib zstd support (Node 24 has it).
import { readFileSync } from 'node:fs'
import { zstdDecompressSync } from 'node:zlib'

const [file, flag] = process.argv.slice(2)
if (!file) { console.error('usage: node print-session.mjs <session file> [--full]'); process.exit(2) }
const raw = readFileSync(file)
const text = file.endsWith('.zstd') ? zstdDecompressSync(raw).toString('utf8') : raw.toString('utf8')
const short = (value, n = 140) => { const s = JSON.stringify(value) ?? ''; return s.length > n ? s.slice(0, n) + '…' : s }

for (const [i, line] of text.split('\n').filter(Boolean).entries()) {
  const record = JSON.parse(line)
  if (flag === '--full') { console.log(JSON.stringify(record)); continue }
  const { type, seq, data } = record
  if (type === undefined) { console.log(`${i} header ${short(record, 200)}`); continue }
  let detail = ''
  if (type === 'user/message') detail = `source=${short(data?.source ?? data?.message?.source, 60)} content=${short(data?.content ?? data?.message?.content)}`
  else if (type === 'assistant/message') detail = `content=${short(data?.message?.content)} streamChunks=${data?.stream?.chunks?.length ?? data?.stream?.length ?? '?'}`
  else if (type === 'tool/call') detail = `${data.name} ${data.arguments}`
  else if (type === 'tool/result') detail = `isError=${data?.result?.isError ?? data?.isError} content=${short(data?.result?.content ?? data?.content, 100)}`
  else if (type === 'request/header') detail = `reason=${data.reason} model=${data?.header?.config?.provider}/${data?.header?.config?.model} tools=${data?.header?.tools?.length ?? 0}`
  else detail = short(data)
  console.log(`#${seq} ${type} ${detail}`)
}
