/**
 * Book lab code (not upstream DeepSeek Harness code).
 *
 * `reconcile_bank_tally`: read-only reconciliation of a bank statement CSV
 * against a Tally bank-ledger CSV export. Column names and the default date
 * window are deployment configuration (cordis.yml), not constants.
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolExecution } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-fs'
import type {} from '@deepseek-ai/dsh-working-directory'
import { DEFAULT_BANK_COLUMNS, DEFAULT_TALLY_COLUMNS, type BankColumns, type TallyColumns } from './normalize.ts'
import { reconcileText, renderReconciliation, type ReconcileReport } from './reconcile.ts'

export const name = 'book-reconcile-bank-tally'
export const inject = ['tools', 'fs']

export interface Config {
  toolName?: string
  windowDays?: number
  maxBytes?: number
  bankColumns?: BankColumns
  tallyColumns?: TallyColumns
}

export const Config: z<Config> = z.object({
  toolName: z.string().default('reconcile_bank_tally'),
  windowDays: z.natural().default(3),
  maxBytes: z.natural().default(5 * 1024 * 1024),
  bankColumns: z.object({
    date: z.string().default(DEFAULT_BANK_COLUMNS.date),
    text: z.string().default(DEFAULT_BANK_COLUMNS.text),
    ref: z.string().default(DEFAULT_BANK_COLUMNS.ref),
    debit: z.string().default(DEFAULT_BANK_COLUMNS.debit),
    credit: z.string().default(DEFAULT_BANK_COLUMNS.credit),
  }),
  tallyColumns: z.object({
    date: z.string().default(DEFAULT_TALLY_COLUMNS.date),
    text: z.string().default(DEFAULT_TALLY_COLUMNS.text),
    ref: z.string().default(DEFAULT_TALLY_COLUMNS.ref),
    voucher: z.string().default(DEFAULT_TALLY_COLUMNS.voucher),
    debit: z.string().default(DEFAULT_TALLY_COLUMNS.debit),
    credit: z.string().default(DEFAULT_TALLY_COLUMNS.credit),
  }),
})

async function readText(ctx: Context, exec: ToolExecution, path: string, maxBytes: number): Promise<string> {
  const wd = ctx.get('workingDirectory')
  const cwd = exec.agent !== undefined && wd !== undefined ? await wd.ensure(exec.agent, exec.signal) : undefined
  const target = await ctx.fs.resolve(path, { ...cwd === undefined ? {} : { cwd }, signal: exec.signal })
  const info = await ctx.fs.stat(target, exec.signal)
  if (info === undefined) throw new Error(`cannot read "${path}": not found`)
  if (info.type !== 'file') throw new Error(`cannot read "${path}": not a regular file`)
  if (info.size !== undefined && info.size > maxBytes) throw new Error(`"${path}" is ${info.size} bytes; the configured limit is ${maxBytes}`)
  return ctx.fs.readText(target, exec.signal)
}

export function apply(ctx: Context, config: Config): void {
  const c = config as Required<Config>
  ctx.tools.register(defineTool({
    name: c.toolName,
    description: 'Reconcile a bank statement CSV against a Tally bank-ledger CSV export. Read-only. Every result names its rule (R1 reference+amount, R2 amount+date window, A1 ambiguous, U1 unmatched, D1 duplicate, V1 rejected) and the input line numbers on both sides.',
    parameters: {
      bank_path: { type: 'string', required: true, description: 'Bank statement CSV path.' },
      tally_path: { type: 'string', required: true, description: 'Tally bank-ledger CSV path.' },
      window_days: { type: 'integer', description: `Days allowed between bank and Tally dates for rule R2. Defaults to ${c.windowDays}.` },
    },
    output: {
      schema: { type: 'json' },
      // `value` is the object execute() returned; a `json` output schema gives TypeScript no shape,
      // so this lab casts. (Upstream bans new `as unknown` casts in its own repository.)
      render: (_args, value) => [{ type: 'text', text: renderReconciliation(value as unknown as ReconcileReport) }],
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const [bank, tally] = await Promise.all([
        readText(ctx, exec, args.bank_path, c.maxBytes),
        readText(ctx, exec, args.tally_path, c.maxBytes),
      ])
      const report = reconcileText(bank, tally, {
        windowDays: args.window_days ?? c.windowDays,
        bankColumns: c.bankColumns,
        tallyColumns: c.tallyColumns,
      })
      return JSON.parse(JSON.stringify(report))
    },
  }))
}
