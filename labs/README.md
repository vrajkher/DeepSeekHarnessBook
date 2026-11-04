# Book labs

Book-owned code. None of it is upstream DeepSeek Harness code.

The labs import harness workspace packages (for example `@deepseek-ai/dsh-tools`)
and resolve them through the harness checkout's TypeScript `paths`, so copy this
folder into the checkout's gitignored `tmp/` directory and run from there:

```bash
cp -r labs <harness>/tmp/book-labs
```

| Folder | Chapter | What it is |
|---|---|---|
| `request-trace/` | 1, 3, 5 | `run-mock.sh` (keyless headless run), `trace-events.ts` observer, `capture-wire.ts`, `print-session.mjs` |
| `csv-inspect/` | 4 | `csv_compare` read-only tool plugin, fixtures, tests |
| `measure/` | 6 | `metrics.ts` model-call and tool-latency observer |
| `contribution/` | 6 | `headless-teardown.patch`: worked contribution with regression test |
| `reconcile/` | 7 | `reconcile_bank_tally` read-only tool plugin, synthetic fixtures, golden report, tests |
| `tsconfig.json` | all | strict type check of the labs against built harness declarations |

Checks used in the book (run from `<harness>/tmp/book-labs`):

```bash
node --import tsx --test csv-inspect/test/*.test.ts reconcile/test/*.test.ts
```

```bash
node --max-old-space-size=8192 ../../node_modules/typescript/bin/tsc -p tsconfig.json
```
