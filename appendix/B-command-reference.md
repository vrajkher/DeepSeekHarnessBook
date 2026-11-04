# પરિશિષ્ટ B — Command reference

બધા commands harness checkout ના root માંથી, સિવાય કે અલગ લખ્યું હોય. Placeholders: `<harness>` = checkout path, `<book>` = આ પુસ્તકનો checkout.
🧪 = આ પુસ્તક માટે ચલાવ્યું.

## Setup

| હેતુ | Command | |
|---|---|---|
| Clone | `git clone https://github.com/deepseek-ai/deepseek-harness.git` | 🧪 |
| Pin | `git checkout --detach fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159` | 🧪 |
| Pin ચકાસો | `git log -1 --format='%H %ci %s'` | 🧪 |
| Node version | `node --version` (≥ 24.9.0) | 🧪 v24.22.2 |
| pnpm via Corepack | `corepack enable` પછી `pnpm --version` → `11.28.5` | 🧪 |
| Install | `pnpm install` | 🧪 (sandbox workaround: પરિશિષ્ટ G) |
| Build (10 gates) | `pnpm run build` | 🧪 129.74 s |
| Typecheck only | `pnpm run typecheck` | ⚠️ ચલાવ્યું નથી |
| Labs copy | `cp -r <book>/labs tmp/book-labs` | 🧪 |

## Cordis tutorial (key વગર)

```bash
mkdir -p tmp/cordis-tutorial && cd tmp/cordis-tutorial
```

```bash
node --import tsx ../../vendor/cordis/bin.js
```

Log exporter સાથે (entry failures જોવા):

```bash
node --import tsx ../book-labs/cordis-basics/bin-with-logs.ts
```

## Headless runs

| હેતુ | Command | |
|---|---|---|
| Real API સાથે એક task | `DEEPSEEK_API_KEY=… pnpm dsh --profile headless "task"` | ⚠️ (key નથી) |
| Composition dump | `pnpm dsh --profile headless --dump-config` | 🧪 101 rows |
| Overlay સાથે | `pnpm dsh --profile headless --patch /abs/overlay.yml "task"` | 🧪 |
| JSON events | `pnpm dsh --profile headless --json "task"` | 🧪 |
| Resume | `pnpm dsh --profile headless --session-id session-… "continue"` | 🧪 |
| Help | `pnpm dsh --profile headless --help` | ✅ ([startup.ts](https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/bundle/headless/src/startup.ts#L55-L72)) |
| Debugger | `node --inspect-brk --import tsx/esm apps/cli/src/bin.ts --profile headless "task"` | 🧪 listening |

## Keyless mock provider

Standalone mock:

```bash
pnpm run mock:llm --port 8000 --api-key mock-key --sequence tool_call_success,success --tool-name read --tool-arguments '{"file_path":"README.md"}'
```

Adapter ને mock તરફ વાળો:

```bash
DEEPSEEK_BASE_URL=http://127.0.0.1:8000/v1 DEEPSEEK_API_KEY=mock-key DSH_TELEMETRY_DISABLED=1 pnpm dsh --profile headless "task"
```

## Book runner: `run-mock.sh`

```bash
bash tmp/book-labs/request-trace/run-mock.sh
```

| Env knob | Default | અર્થ |
|---|---|---|
| `SEQUENCE` | `tool_call_success,success` | mock behaviors, FIFO |
| `TOOL_NAME` | `read` | `tool_call_success` નો tool |
| `TOOL_ARGS` | `{"file_path":"README.md"}` | raw JSON arguments |
| `SUCCESS_TEXT` | Gujarati સાર | `success` નો text |
| `TASK` | README ગુજરાતી સાર | headless task |
| `TITLE` | `off` | `on` = title row ચાલુ (એક વધારાનો call) |
| `PORT` | `8000` | mock port |
| `EXTRA_PATCH` | — | એક વધુ overlay (absolute path) |
| `DSH_ARGS` | — | વધારાના headless flags |
| `DSH_HOME` | `tmp/book-home` | profiles, sessions; runs વચ્ચે રહે છે |

Session વાંચો:

```bash
node tmp/book-labs/request-trace/print-session.mjs "$(find tmp/book-home/sessions -name 'session.v*.jsonl*' | head -1)"
```

Wire capture (બે terminals):

```bash
node --import tsx tmp/book-labs/request-trace/capture-wire.ts 8001 tool_call_success,success
```

```bash
DEEPSEEK_BASE_URL=http://127.0.0.1:8001/v1 DEEPSEEK_API_KEY=mock-key pnpm dsh --profile headless --patch /abs/notitle.yml "task"
```

<a id="interrupt-and-resume"></a>

## Interrupt અને resume

Terminal 1 — stall કરતું mock:

```bash
pnpm run mock:llm --port 8002 --api-key mock-key --sequence stall
```

Terminal 2 — headless run શરૂ કરો, પછી થોડી સેકન્ડે `Ctrl+C`:

```bash
DSH_HOME=$PWD/tmp/book-home DEEPSEEK_BASE_URL=http://127.0.0.1:8002/v1 DEEPSEEK_API_KEY=mock-key DSH_TELEMETRY_DISABLED=1 node --import tsx/esm apps/cli/src/bin.ts --profile headless "આ repositoryનું README વાંચીને ગુજરાતી સાર આપો."
```

અપેક્ષિત 🧪: exit 130; patch વગર stderr `dsh: session "…": flush on a closed handle`.

Resume (terminal 1 નું mock બંધ કરી):

```bash
SID=$(basename "$(find tmp/book-home/sessions -maxdepth 2 -name 'session-*' -type d | head -1)")
```

```bash
DSH_ARGS="--session-id $SID" TASK='ફરી પ્રયાસ કરો.' bash tmp/book-labs/request-trace/run-mock.sh
```

<a id="measure"></a>

## Measure (પ્રકરણ 6)

```bash
M=$(bash tmp/book-labs/measure/make-overlay.sh)
```

Title off, એક run (દરેક run માટે નવો `DSH_HOME`):

```bash
DSH_HOME=$PWD/tmp/mhome-off-1 BOOK_METRICS_FILE=$PWD/tmp/m-off-1.json EXTRA_PATCH=$M bash tmp/book-labs/request-trace/run-mock.sh
```

Title on (script માં ત્રીજો `success`):

```bash
DSH_HOME=$PWD/tmp/mhome-on-1 BOOK_METRICS_FILE=$PWD/tmp/m-on-1.json TITLE=on SEQUENCE=tool_call_success,success,success EXTRA_PATCH=$M bash tmp/book-labs/request-trace/run-mock.sh
```

## Tests અને checks

Labs (from `tmp/book-labs`):

```bash
node --import tsx --test csv-inspect/test/*.test.ts reconcile/test/*.test.ts
```

```bash
node --max-old-space-size=8192 ../../node_modules/typescript/bin/tsc -p tsconfig.json
```

Upstream suites:

```bash
pnpm exec vitest run packages/llm/llm-retry packages/core/tools packages/fs/fs-sandbox
```

```bash
pnpm exec vitest run packages/bundle/headless
```

Coverage (headless sources):

```bash
pnpm exec vitest run --coverage --coverage.include='packages/bundle/headless/src/**' --coverage.reporter=text packages/bundle/headless
```

Lint (ફક્ત બદલાયેલી files):

```bash
pnpm exec tsx scripts/run-oxlint.ts packages/bundle/headless/src/index.ts packages/bundle/headless/tests/teardown-flush.spec.ts
```

Contribution patch:

```bash
git apply --check <book>/labs/contribution/headless-teardown.patch
```

Debugging challenge (from `tmp/book-labs`):

```bash
patch -p1 < reconcile/challenge/planted-bug.patch
```

```bash
node --import tsx --test reconcile/challenge/sign.test.ts
```

## Book maintenance tools

```bash
python3 tools/citations.py <pinned harness checkout> > appendix/citations.generated.md
```

```bash
python3 tools/refdefs.py book/*.md appendix/*.md
```

```bash
python3 tools/verify_book.py <pinned harness checkout>
```
