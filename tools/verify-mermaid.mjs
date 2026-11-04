#!/usr/bin/env node
// Book tool: parse every ```mermaid block in book/ and appendix/ with the same mermaid
// and jsdom packages the harness uses for its own docs (scripts/verify-mermaid.ts).
// Usage: node tools/verify-mermaid.mjs <harness checkout with node_modules>
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const harness = resolve(process.argv[2] ?? '.')
const book = resolve(import.meta.dirname, '..')
const require = createRequire(join(harness, 'package.json'))
const { JSDOM } = await import(pathToFileURL(require.resolve('jsdom')).href)
const { window } = new JSDOM('')
for (const key of ['window', 'document', 'navigator']) {
  Object.defineProperty(globalThis, key, { value: key === 'window' ? window : window[key], configurable: true })
}
const mermaid = (await import(pathToFileURL(require.resolve('mermaid')).href)).default
mermaid.initialize({ startOnLoad: false })

let blocks = 0
const failures = []
for (const dir of ['book', 'appendix']) {
  for (const name of readdirSync(join(book, dir)).filter(n => n.endsWith('.md')).sort()) {
    const text = readFileSync(join(book, dir, name), 'utf8')
    for (const match of text.matchAll(/```mermaid\n([\s\S]*?)```/g)) {
      blocks++
      const line = text.slice(0, match.index).split('\n').length
      try {
        await mermaid.parse(match[1], { suppressErrors: false })
      } catch (error) {
        failures.push(`${dir}/${name}:${line} ${String(error?.message ?? error).split('\n')[0]}`)
      }
    }
  }
}
for (const f of failures) console.error('MERMAID', f)
console.log(`verify-mermaid: ${blocks} block(s), ${failures.length} failure(s)`)
process.exit(failures.length ? 1 : 0)
