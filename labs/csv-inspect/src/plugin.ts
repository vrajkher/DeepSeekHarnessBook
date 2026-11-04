/**
 * Book lab code (not upstream DeepSeek Harness code).
 *
 * `csv_compare`: a read-only, model-callable tool that compares two CSV
 * exports by key columns. It reads only through `ctx.fs` (the filesystem
 * seam), so the deployment's filesystem provider and sandbox stay in charge
 * of path resolution; it never writes.
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolExecution } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-fs'
import type {} from '@deepseek-ai/dsh-working-directory'
import { parseCsv } from './csv.ts'
import { compareTables, renderReport } from './compare.ts'
import type { CompareReport } from './compare.ts'

export const name = 'book-csv-compare'

// `fs` and `tools` are required; the working directory is optional (see below).
export const inject = ['tools', 'fs']

export interface Config {
  /** Model-visible tool name. */
  toolName?: string
  /** Refuse files larger than this many bytes (a deployment tunable, not a constant). */
  maxBytes?: number
}

export const Config: z<Config> = z.object({
  toolName: z.string().default('csv_compare'),
  maxBytes: z.natural().default(5 * 1024 * 1024),
})

/** Resolve a model-supplied path in the calling Session's directory when one is composed. */
async function resolveForCall(ctx: Context, exec: ToolExecution, path: string) {
  const wd = ctx.get('workingDirectory')
  const cwd = exec.agent !== undefined && wd !== undefined ? await wd.ensure(exec.agent, exec.signal) : undefined
  return ctx.fs.resolve(path, { ...cwd === undefined ? {} : { cwd }, signal: exec.signal })
}

async function readCsvFile(ctx: Context, exec: ToolExecution, path: string, maxBytes: number) {
  const target = await resolveForCall(ctx, exec, path)
  const info = await ctx.fs.stat(target, exec.signal)
  if (info === undefined) throw new Error(`cannot read "${path}": not found`)
  if (info.type !== 'file') throw new Error(`cannot read "${path}": not a regular file`)
  if (info.size !== undefined && info.size > maxBytes) {
    throw new Error(`"${path}" is ${info.size} bytes; the configured limit is ${maxBytes}`)
  }
  return parseCsv(await ctx.fs.readText(target, exec.signal))
}

export function apply(ctx: Context, config: Config): void {
  const { toolName, maxBytes } = config as Required<Config>
  ctx.tools.register(defineTool({
    name: toolName,
    description: 'Compare two CSV exports by key columns. Read-only. Returns matched, different, unmatched, duplicate-key and malformed rows with 1-based line numbers.',
    parameters: {
      left_path: { type: 'string', required: true, description: 'First CSV file, for example a bank export.' },
      right_path: { type: 'string', required: true, description: 'Second CSV file, for example a ledger export.' },
      key_columns: { type: 'array', items: { type: 'string' }, required: true, description: 'Header names that identify one record on both sides.' },
      compare_columns: { type: 'array', items: { type: 'string' }, description: 'Header names to compare for matched rows. Defaults to shared non-key columns.' },
    },
    output: {
      // The canonical value is the JSON report; `render` makes the model-facing text.
      schema: { type: 'json' },
      // `value` is the object execute() returned; a `json` output schema gives TypeScript no shape,
      // so this lab casts. (Upstream bans new `as unknown` casts in its own repository.)
      render: (_args, value) => [{ type: 'text', text: renderReport(value as unknown as CompareReport) }],
    },
    // Two reads and no writes: safe to run beside other read-only calls.
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const [left, right] = await Promise.all([
        readCsvFile(ctx, exec, args.left_path, maxBytes),
        readCsvFile(ctx, exec, args.right_path, maxBytes),
      ])
      const report = compareTables(left, right, {
        keyColumns: args.key_columns,
        ...args.compare_columns === undefined ? {} : { compareColumns: args.compare_columns },
      })
      return JSON.parse(JSON.stringify(report))
    },
  }))
}
