/**
 * Book lab launcher (not upstream code): vendor/cordis/bin.js plus a console log
 * exporter mounted BEFORE the Loader, and an entry-state report after startup.
 * Run from a folder that has a cordis.yml:
 *   node --import tsx <harness>/tmp/book-labs/cordis-basics/bin-with-logs.ts
 */
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import ConsoleLogger from '@deepseek-ai/cordis-plugin-logger-console'

const STATES = ['PENDING', 'LOADING', 'ACTIVE', 'FAILED', 'DISPOSED', 'UNLOADING']

const ctx = new Context()
ctx.baseUrl = pathToFileURL(process.cwd()).href + '/'
await ctx.plugin(ConsoleLogger, { levels: { default: 2 } })
await ctx.plugin(Loader)
await ctx.loader.create({ name: '@deepseek-ai/cordis-plugin-include', config: { path: './cordis.yml' } })
await ctx.loader.await()
for (const entry of ctx.loader.entries()) {
  const state = entry.fiber === undefined ? 'NO FIBER (import failed?)' : STATES[entry.fiber.state]
  console.error(`[entry] ${entry.options.name} -> ${state}`)
}
