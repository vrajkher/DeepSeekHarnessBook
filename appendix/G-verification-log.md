# પરિશિષ્ટ G — Verification log

આ પાનું જણાવે છે કે શું ચલાવ્યું, ક્યાં, શું **નથી** ચલાવ્યું, અને docs તથા code ક્યાં જુદાં પડ્યાં.

## Environment

| વિગત | મૂલ્ય |
|---|---|
| તારીખ | 2026-11-04 |
| Harness | `deepseek-ai/deepseek-harness` @ `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159` (`master`, 0.2.2-rc.1) |
| OS / machine | Linux x64 cloud container, 4 CPU, 15 GB RAM |
| Node.js | v24.22.2 (nodejs.org tarball) |
| pnpm | 11.28.5 via Corepack 0.36.0 |
| Git | 2.43.0 |
| Model provider | **કોઈ real provider નહીં.** બધા model calls repository ના `dsh-llm-mock-server` સામે. `DEEPSEEK_API_KEY` ઉપલબ્ધ નહોતો. |

## Sandbox-specific workarounds (ફક્ત અમારી scratch copy માં)

1. **`cdn.sheetjs.com` blocked.** Client package `ui-sidebar-documentpreview` એ `xlsx` ને `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` થી માંગે છે; અમારું network `403` આપે છે. અમે `pnpm-workspace.yaml` ના `overrides` માં `'xlsx': '0.18.5'` ઉમેરી `pnpm install --no-frozen-lockfile` ચલાવ્યું, અને `packages/client/ui-sidebar-documentpreview/src/client/excel/xlsx-sandbox-shim.d.ts` માં `declare module 'xlsx/dist/cpexcel.full.mjs'` ઉમેર્યું. આ ફક્ત Web document preview ને અસર કરે છે; agent/Host path ને નહીં. **તમારું network CDN સુધી પહોંચે તો આ ન કરશો.**
2. Citations બીજા, **અસ્પૃશ્ય** `git worktree` (pinned SHA) માંથી બનાવ્યાં, જેથી scratch ફેરફારો line numbers ન બદલે.

## Runtime-verified (🧪)

| દાવો | પુરાવો |
|---|---|
| `pnpm install` + `pnpm run build` (10/10 gates) | [evidence/build.log](../evidence/build.log) |
| Cordis tutorial ch.1 | પ્રકરણ 0 |
| README ઉદાહરણ: 2 model calls, `read` tool, `turn/end completed` | [two-calls.err](../evidence/two-calls.err), [two-calls.session.txt](../evidence/two-calls.session.txt) |
| Title row ચાલુ: 3 calls; script exhausted → 5 retries → exit 1 | [three-calls-title-on-exhausted.err](../evidence/three-calls-title-on-exhausted.err) |
| Wire body fields, headers, message roles | [wire.json](../evidence/wire.json) |
| `--dump-config` 101 rows | [dump.yml](../evidence/dump.yml) |
| Missing optional service → warning; missing required → exit 1 | [nofs.err](../evidence/nofs.err), [nosp.err](../evidence/nosp.err), [no-working-directory.err](../evidence/no-working-directory.err) |
| Tool failures: `UNKNOWN_TOOL`, `INVALID_ARGS`, `FS_NOT_FOUND`, `FS_NOT_REGULAR_FILE`, `FS_SANDBOX_DENIED` | `unknown-tool.err`, `invalid-args.err`, `missing-file.err`, `read-directory.err`, `outside-write.err` |
| Provider errors: 429 retry, 401 terminal, 500×2 retry | `rate-limit.err`, `auth-error.err`, `server-error-twice.err` |
| SIGINT: exit 130, durable `aborted`; flush message | `stall.err`, `sigint-unpatched.err`, `sigint-patched.err`, `json-sigint-*.jsonl` |
| Resume (completed અને interrupted) | `resume-a2.err`, `int2.err` |
| Sandbox: escalation unavailable, bash fail-closed, reads open | `escalate-write.err`, `bash-outside.err`, `read-outside.err` |
| Greet tool config, csv_compare e2e, disable, bad config | `greet.err`, `csv.err`, `csv-disabled.err`, `csv-badcfg.err` |
| Metrics (title off/on, csv) | `measure.jsonl`, `measure-csv.jsonl` |
| Reconciliation e2e | `rec.err` |
| Labs: 25/25 tests (+1 challenge test), `tsc` exit 0; challenge test fail/pass | પ્રકરણ 4, 7 |
| Upstream suites: retry/tools/fs-sandbox 321/321; headless 136/136 (patch સાથે) | પ્રકરણ 5, 6 |
| Contribution: lint, tsc, coverage 100%, `git apply --check` on pristine pinned tree | પ્રકરણ 6 |

## Source-verified only (✅) — ચલાવ્યું નથી

- Cordis internals (`provide`, `effect`, `FiberState`) — vendored copy વાંચી; upstream `cordiverse/cordis` અલગથી inspect કર્યું નથી.
- Persistence migrations, compaction, scope chain ની અંદરની વિગતો.
- Telemetry `FEEDBACK_ONLY` વર્તન (બધા runs `DSH_TELEMETRY_DISABLED=1` સાથે).

## Unverified (⚠️)

- **Windows + WSL2** setup — docs પર આધારિત.
- **Real DeepSeek API** — key નહોતી; real model નો જવાબ, tokens, ખર્ચ, latency ચકાસ્યાં નથી.
- **`pnpm dsh web`** Web UI — build થયું, પણ browser માં ચલાવ્યું નથી.
- **Interactive debugger stepping** — ફક્ત `--inspect-brk` listen ચકાસ્યું.
- **Linux kernel sandbox (`bwrap`/Landlock) enforcement** — અમારા host પર કોઈ backend usable નહોતું; ફક્ત fail-closed path ચકાસ્યો.
- **Tally export format** — fixtures નો layout ધારેલો નમૂનો છે; Tally connector extension design છે, code નહીં.
- Latency તફાવતનું કારણ (title call overlap) — અનુમાન.

## Docs અને code ના તફાવત (pinned commit પર)

| Doc દાવો | અમે જોયું | પ્રકરણ |
|---|---|---|
| `docs/cordis-tutorial/01-first-plugin.md`: `apply` throw કરે તો "the process dies with your error" | exit 0, કોઈ output નહીં; error ફક્ત logger માં | 0 |
| `docs/cordis-tutorial/07-into-the-harness.md`: ચાર rows ની composition `tool replied: …` છાપે | `ToolExecutorUnavailableError` (`TOOL_EXECUTOR_UNAVAILABLE`); executor row ઉમેર્યા પછી પણ ક્રમ પર આધારિત | 2 |
| Mock server README: adapter ને mock તરફ વાળી `pnpm dsh --profile headless "test provider recovery"` (title generator નો ઉલ્લેખ નથી — તફાવત નહીં, ચૂક) | અમારા script સાથે base bundle નો title generator script નો એક entry ખાઈ ગયો; scripts માં તેનો હિસાબ રાખવો પડે. Doc ના પોતાના sequence સાથે અમે ચલાવ્યું નથી. | 1, 5 |

## Resume point (output limits માટે)

આ version માં બધાં પ્રકરણ અને પરિશિષ્ટ પૂર્ણ છે; સ્થિતિ [પરિશિષ્ટ H](H-status.md) માં.
