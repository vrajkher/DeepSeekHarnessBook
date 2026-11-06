# પ્રકરણ 5 — Debugging, permissions અને reliability

> 🧭 **નવું:** આ પ્રકરણ અઘરું લાગે તો પહેલાં નીચેનો [સરળ સમજ](#saral-samaj) વિભાગ વાંચો (ઉપમા, નવા શબ્દો, યાદ રાખવાની રીતો). આખા પુસ્તકનો નકશો: [સમગ્ર નકશો](overview-samagra-naksho.md).

> **Level 5.** ચાર નક્કર નિષ્ફળતાઓ ફરી ઉત્પન્ન કરીએ — unavailable tool, invalid input, provider error, interrupted execution —
> અને દરેકનું નિદાન source, logs, breakpoints અને tests થી કરીએ. પછી permission/sandbox ની ખરી સીમાઓ ચકાસીએ.

## આ પ્રકરણ પછી તમે શું કરી શકશો

- ચારેય failure class ને mock provider થી ઇચ્છા મુજબ ઉત્પન્ન કરી, stored session માંથી તેનું exact model-visible text અને error code કાઢી શકશો.
- `llm-retry` નું backoff ક્યાં નક્કી થાય છે અને કઈ errors retry થાય છે તે બતાવી શકશો.
- Sandbox modes, approval policy, અને "fail closed" વર્તન ચલાવીને સાબિત કરી શકશો — અને ક્યાં સીમા **નથી** તે પણ.
- Cancellation, retries, concurrency અને recovery ના માલિક symbols બતાવી શકશો.
- દરેક fix માટે "મૂળ નિષ્ફળતા ગઈ" એવો પુરાવો કેવી રીતે આપવો તે લખી શકશો.

## 5.1 Debugging toolkit

| Tool | ક્યારે | Command / file |
|---|---|---|
| Observer plugin (logs) | કયું event ક્યારે, કયા ક્રમમાં | [`trace-events.ts`](../labs/request-trace/trace-events.ts) overlay |
| Stored session | model ને **ખરેખર** શું દેખાયું | [`print-session.mjs`](../labs/request-trace/print-session.mjs) `--full` |
| Wire capture | adapter એ HTTP પર શું મોકલ્યું | [`capture-wire.ts`](../labs/request-trace/capture-wire.ts) |
| Breakpoints | એક line પર અટકવું | `node --inspect-brk --import tsx/esm apps/cli/src/bin.ts --profile headless "…"` |
| Upstream tests | વર્તનનો contract | `pnpm exec vitest run <package path>` |
| Startup audit | plugin load નથી થતો | stderr નું `entries did not activate` (પ્રકરણ 2) |

**Breakpoint** એટલે debugger ને "આ line પર રોકાઈ જા" કહેવું. ઉદાહરણ: Chrome માં `chrome://inspect` ખોલી, `packages/core/agent-loop/src/agent.ts` ની [`step`][loop-step] પર breakpoint મૂકો. Source `tsx` થી ચાલે છે, તેથી TypeScript lines સીધી દેખાય છે. 🧪 command ચકાસ્યો (`Debugger listening on ws://127.0.0.1:9229/…`); interactive stepping અમે આ environment માં કર્યું નથી. ⚠️

## 5.2 ચાર નિષ્ફળતાઓ

બધા runs: `bash tmp/book-labs/request-trace/run-mock.sh` + નીચેના env knobs. દરેક stored `tool/result` / `turn/end` અમારા [evidence/](../evidence/) માં છે. 🧪

### (A) Unavailable tool

```bash
TOOL_NAME=read_everything bash tmp/book-labs/request-trace/run-mock.sh
```

| અવલોકન | મૂલ્ય |
|---|---|
| Model-visible text | `Error: unknown tool "read_everything"` |
| `error` in log | `{"name":"ToolNotFoundError","code":"UNKNOWN_TOOL"}` |
| Turn | `completed` (step 2 ચાલ્યો), exit 0 |

**નિદાન:** pipeline નું [`dispatchToolBody`][pipeline-body] → `resolveExecution` → `undefined` → `throw new ToolNotFoundError(exec.name)` ([class][contracts-notfound]). Tool registry માં નામ છે કે નહીં તે trace ની `tools=[…]` અથવા wire `toolNames` થી જુઓ. પ્રકરણ 4 નું "disabled plugin" પણ બરાબર આ જ લક્ષણ આપે છે.

### (B) Invalid input

```bash
TOOL_ARGS='{"path":"README.md"}' bash tmp/book-labs/request-trace/run-mock.sh
```

| અવલોકન | મૂલ્ય |
|---|---|
| Model-visible text | `Error: invalid arguments: missing required property "file_path"` |
| `error` | `{"name":"ToolArgsError","code":"INVALID_ARGS"}` |

**નિદાન:** [`defineTool` validation][schema-defineTool-validate] — `validate(args)` → `throw new ToolArgsError(violations)`. Model ને સુધારવાની તક મળે છે, કારણ કે તે સામાન્ય tool result છે.

### (C) Provider error — ત્રણ પ્રકાર

| Script | પરિણામ | Model calls | Exit |
|---|---|---|---|
| `SEQUENCE=rate_limit,tool_call_success,success` | 429 → `llm/retry` → ~1s પછી સફળ | 3 | 0 🧪 |
| `SEQUENCE=auth_error` | `turn/end` reason `error`, `AUTH`, status 401; **retry નહીં** | 1 | 1 🧪 |
| Title row on + `tool_call_success,success` (પ્રકરણ 1 ની આગાહી) | 500 `script exhausted` → 5 retries (આશરે 0.5s, 1s, 1.9s, 3.9s, 8.2s) → `SERVER` | 8 | 1 🧪 |

Stored `auth-error` sequence ([evidence/auth-error.err](../evidence/auth-error.err)):

```text
[trace +  323ms] llm/stream call #1 deepseek-official/deepseek-flash messages=5 …
[trace +  375ms] session/event #15 assistant/attempt
[trace +  377ms] session/event #17 turn/end reason={"kind":"error","error":{"message":"mock authentication failed","code":"AUTH","status":401}}
dsh: AUTH: mock authentication failed
```

**Retry ક્યાં નક્કી થાય છે?** Loop stream નિષ્ફળ થાય ત્યારે `assistant/attempt` લખી `agent/request-error` **waterfall** ચલાવે છે ([source][loop-request-error]); `{ kind: 'retry' }` મળે તો એ જ step માં ફરી પ્રયાસ, નહીં તો `LlmError` ફેંકે. Base bundle નો `llm-retry` plugin આ event સાંભળે છે ([listener][retry-listener]) અને retry policy વાપરે છે. Defaults ([source][retry-defaults]):

```ts
const DEFAULT_MAX_RETRIES = 5
const DEFAULT_INITIAL_DELAY_MS = 500
const DEFAULT_MAX_DELAY_MS = 10_000
const DEFAULT_JITTER_RATIO = 0.1
```

Observed delays (0.5 → 1 → 2 → 4 → 8 s, થોડો jitter) આ exponential backoff સાથે મેળ ખાય છે. `AUTH` retryable codes માં નથી, તેથી તરત error. ✅🧪 Retry **એ જ step** માં થાય છે; તેથી `agent/pre-step` અને user admission ફરી થતાં નથી (architecture doc ✅).

### (D) Interrupted execution

Mock ને `--sequence stall` (headers મોકલી શાંત) સાથે ચલાવી, headless process ને 4 સેકન્ડે `SIGINT` (પૂરા commands: [પરિશિષ્ટ B](../appendix/B-command-reference.md#interrupt-and-resume)).

| અવલોકન | મૂલ્ય |
|---|---|
| Exit code | **130** (launcher: `SIGINT` → 130, `SIGTERM` → 0) ([`runProfile`][cli-runProfile]) |
| Durable log | `assistant/attempt {"stream":[]}`, `step/end`, `turn/end {"kind":"aborted","reason":{"kind":"disposed"}}` |
| Stderr | `dsh: session "session-…": flush on a closed handle` |

ત્રીજી line રસપ્રદ છે: interruption **સાચું** handle થયું (durable `aborted` turn, exit 130), પણ headless runner teardown પછી પણ `sessions.flush` અને failure report કરે છે. આ નાની ખામીનું આખું contribution — reproduce, patch, regression test — પ્રકરણ 6 માં છે.

**Cancellation કેવી રીતે વહે છે:** SIGINT → `shutdown.interrupt(130)` → root fiber dispose → agent loop નો `cancel(cause)` ([source][loop-cancel]) → loop-owned `AbortController` abort → દરેક `await` પછીનું `signal.throwIfAborted()` → `turn()` નું `catch` reason `aborted` નક્કી કરે → `finally` માં `turn/end`. Tool body ચાલુ હોય તો pipeline તેને છોડી દેતું નથી: "Cancellation never abandons the body: a started promise reaches quiescence before its outcome becomes `ABORTED`" ([`dispatchToolBody`][pipeline-body]). ✅

## 5.3 Permissions અને sandbox: ખરી સીમાઓ

**Sandbox mode** એટલે process/file side effects કેટલા દૂર સુધી માન્ય: `read-only`, `workspace-write`, `danger-full-access` ([`SandboxPolicyService`][sandbox-policy], default `read-only`). Base bundle `DSH_PERMISSION_MODE` ન હોય તો `workspace-write` અને `workspaceRoot: process.cwd()` વાપરે છે ([rows][bundle-base-sandbox]). ✅

**Approval policy** એટલે મંજૂરી કોને/કેવી રીતે પૂછવી: `'ask' | 'never'` ([`ApprovalPolicy`][approval-policy]). `danger-full-access` સિવાય base `ask` વાપરે છે.

દરેક headless run ના log ની શરૂઆતમાં આ ત્રણ events દેખાય છે 🧪:

```text
#0 permission/preset {"preset":"workspace-write"}
#1 sandbox/mode {"mode":"workspace-write"}
#2 approval/policy {"policy":"ask"}
```

### પાંચ પ્રયોગ (🧪 બધા `workspace-write` માં)

| # | Tool call | પરિણામ (model-visible) | સીમા કોણ લાગુ કરે |
|---|---|---|---|
| 1 | `write` `/etc/book-test.txt` | `Error: [sandbox: file access denied under workspace-write mode]` + escalation hint, code `FS_SANDBOX_DENIED` | `dsh-fs-sandbox` ([policy][fs-sandbox-doc]) |
| 2 | એ જ `write` + `sandbox_permissions: "danger-full-access"`, `justification` | `approval/asked` → `approval/decided {"outcome":"unavailable"}` → `Error: sandbox escalation to "danger-full-access" requires approval, but no approval channel is available` | [escalation][sandbox-escalation] (headless માં answerer નથી → fail closed) |
| 3 | `bash` `touch /etc/book-bash-test` | `Error: sandbox mode "workspace-write" is requested but no sandbox backend is usable on this host; refusing to run the command unconfined. Install bubblewrap …` | [`SandboxUnavailableError`][sandbox-unavailable] — અમારા host પર `bwrap` નથી |
| 4 | `read` `/etc/os-release` (workspace બહાર) | **સફળ** — `<path>/usr/lib/os-release</path>` | કોઈ નહીં: "Reads pass through untouched: every mode permits reading" ([source][fs-sandbox-reads]) |
| 5 | `read` `NOPE.md` | `FS_NOT_FOUND` | `read` tool |

કોઈ પણ run પછી `/etc/book-test.txt` કે `/etc/book-bash-test` બન્યા નથી (`ls` થી ચકાસ્યું). 🧪

**શીખ:**

- **Fail closed.** Sandbox backend નથી, તો bash command unconfined ચાલતો નથી; approval channel નથી, તો escalation નકારાય છે. ✅🧪
- **Reads ખુલ્લાં છે.** File sandbox ફક્ત mutations પર policy fence છે. `read` વડે process વાંચી શકે તે કંઈ પણ model વાંચી શકે છે. Source પોતે કહે છે: "This is containment, not a security boundary". ✅ — તેથી secrets વાળા machine પર agent ચલાવતા પહેલાં [SAFETY.md](https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/SAFETY.md) વાંચો: disposable VM/container, least privilege.
- **Kernel isolation shell નું કામ છે.** Linux પર `dsh-sandbox-local` પહેલાં `bwrap`, પછી Landlock ([source][sandbox-local-chain]); macOS `sandbox-exec`; Windows ACL runner.

### Data boundary: model provider ને શું જાય છે

પ્રકરણ 3 ની wire capture મુજબ base bundle દરેક request માં `dsh_session_log` (session log નો incremental suffix) અને `dsh_plugin_packages` મોકલે છે, અને headers માં anonymous user id તથા session id. 🧪 આ permission ની બાબત નથી, **data** ની છે. Official API ને session-log suffix ન મોકલવો હોય તો row disable કરો ([row][bundle-base-sessionlog]):

```yaml
- id: session-log-deepseek
  disabled: true
```

Telemetry: `session-telemetry-otel` row default `FEEDBACK_ONLY` mode માં છે ([row][bundle-base-telemetry]); base bundle ની comment મુજબ "OTel releases a Session-log prefix only after explicit user feedback", અને non-empty `DSH_TELEMETRY_DISABLED` process ને opt out કરે છે. ✅ (અમારા બધા runs `DSH_TELEMETRY_DISABLED=1` સાથે હતા.)

## 5.4 Concurrency

Model એક જ response માં ઘણા tool calls આપી શકે. [`executeToolBatch`][batch-execute] દરેક call માટે [`executionMode`][pipeline-executionMode] પૂછે છે: `parallel` calls rolling pool માં ચાલે, બીજાં exclusive barrier બને. Pool ની મર્યાદા `agent-loop` config `maxParallelToolCalls` ([source][loop-maxparallel]), default 10 ([source][loop-maxparallel-default]), અને તે `volatile()` છે — restart વગર બદલાય. Tool `isConcurrencySafe` આપે ત્યારે જ parallel ગણાય (`read` અને આપણો `csv_compare` બંને `true`). Results હંમેશા **model order** માં commit થાય છે. ✅

## Source map: આ ક્રમમાં ખોલો

| ક્રમ | File | Symbol | વિષય |
|---|---|---|---|
| 1 | `packages/core/tools/src/pipeline.ts` | [`dispatchToolBody`][pipeline-body] | unknown tool, cancellation |
| 2 | `packages/core/tools/src/schema.ts` | [`defineTool` validation][schema-defineTool-validate] | invalid input |
| 3 | `packages/core/agent-loop/src/agent.ts` | [`agent/request-error`][loop-request-error] | provider error → retry decision |
| 4 | `packages/llm/llm/src/retry-policy.ts` | [defaults][retry-defaults] | backoff |
| 5 | `packages/core/agent-loop/src/agent.ts` | [`cancel`][loop-cancel], [`turn`][loop-turn] | interruption |
| 6 | `packages/fs/fs-sandbox/src/index.ts` | [policy][fs-sandbox-doc] | file mutation fence |
| 7 | `packages/sandbox/sandbox/src/escalation.ts` | [outcomes][sandbox-escalation] | approval |
| 8 | `packages/sandbox/sandbox/src/index.ts` | [`SandboxUnavailableError`][sandbox-unavailable] | fail closed |

## Lab 5 — ચાર નિષ્ફળતા + તેમના upstream tests

1. ઉપરના ચારેય runs ચલાવો અને દરેક માટે stored `tool/result` અથવા `turn/end` આ command થી કાઢો:

```bash
node tmp/book-labs/request-trace/print-session.mjs "$(find tmp/book-home/sessions -name 'session.v*.jsonl*' | head -1)" | grep -E "tool/result|turn/end"
```

દરેક run પહેલાં `rm -rf tmp/book-home` કરો, જેથી `find` એક જ session શોધે.

2. એ જ વર્તનના upstream tests:

```bash
pnpm exec vitest run packages/llm/llm-retry packages/core/tools packages/fs/fs-sandbox
```

🧪 `Test Files 16 passed (16)`, `Tests 321 passed (321)`, આશરે 10 સેકન્ડ.

## આગાહી કસોટી

`SEQUENCE=server_error,server_error,tool_call_success,success` સાથે ચલાવો. **ચલાવતા પહેલાં લખો:** (1) કુલ model calls, (2) `llm/retry` events ની સંખ્યા, (3) exit code, (4) આશરે કેટલી સેકન્ડ. જવાબ: [પરિશિષ્ટ D — Lab 5](../appendix/D-lab-solutions.md#lab-5).

## નિષ્ફળતા → fix → પુરાવો: ત્રણ ઉદાહરણ

| નિષ્ફળતા | Fix | મૂળ નિષ્ફળતા ગઈ તેનો પુરાવો |
|---|---|---|
| Tutorial ch.7: `TOOL_EXECUTOR_UNAVAILABLE`, ક્રમ પર આધારિત | executor row ઉમેરો + demo call પહેલાં `loader.await()` | executor row **છેલ્લે** રાખી 3/3 runs સફળ (પ્રકરણ 2d) — fix વગર એ જ ક્રમ નિષ્ફળ |
| TITLE on: ત્રીજો model call script ખાઈ જાય | lab overlay માં `session-title-llm` disable, અથવા script માં ત્રીજો `success` | metrics: `modelCalls` 3 → 2, `purpose: session-title` ગાયબ (પ્રકરણ 6) |
| SIGINT પછી `flush on a closed handle` | headless runner: tree active ન હોય તો report/exit ન કરવો | patch વગર 2/2 runs માં message, patch સાથે ગાયબ; નવો regression test patch વગર fail, સાથે pass; આખું headless suite 136/136 (પ્રકરણ 6) |

સામાન્ય નિયમ: **પહેલાં નિષ્ફળતા ફરી ઉત્પન્ન કરો, પછી fix, પછી એ જ પગલાંથી ફરી ચલાવો, અને fix ઉલટાવીને નિષ્ફળતા પાછી આવે છે તે પણ બતાવો.**

## Mastery check

1. Unknown tool અને invalid args — બંને model ને કેવી રીતે પાછાં મળે છે, અને turn કેમ ચાલુ રહે છે?
2. `AUTH` retry કેમ નથી થતો અને 429 કેમ થાય છે? Source બતાવો.
3. SIGINT પર exit 130 ક્યાંથી આવે છે, અને `turn/end` કેમ છતાં લખાય છે?
4. `workspace-write` માં `read` workspace બહારની file વાંચી શકે છે — આ bug છે કે design? Source વાક્ય ટાંકો.
5. Headless માં escalation હંમેશા નકારાય છે — કેમ?
6. `maxParallelToolCalls` `volatile` હોવાનો શું અર્થ?

જવાબો: [પરિશિષ્ટ D — પ્રકરણ 5](../appendix/D-lab-solutions.md#ch5).

<a id="saral-samaj"></a>

## સરળ સમજ — પ્રકરણ 5 સાદી ગુજરાતીમાં

> આ વિભાગ નવો ઉમેરેલો છે; ઉપરનું પ્રકરણ જેમ હતું તેમ જ છે. આખો નકશો: [સમગ્ર નકશો](overview-samagra-naksho.md).

### એક વાક્યમાં

**પ્રકરણ 5 = ભોજનાલયની કટોકટી-તાલીમ: ખોટો ઓર્ડર, અધૂરી ચિઠ્ઠી, supplier નો ફોન ન લાગે, અને અચાનક દુકાન બંધ — દરેકને જાણી જોઈને ઉત્પન્ન કરો, નિદાન કરો; અને રસોડાની દીવાલો (sandbox) ક્યાં છે અને ક્યાં નથી તે ચકાસો.**

### ભોજનાલયની ઉપમામાં

| કટોકટી | ભોજનાલયમાં | Harness માં | શું થયું (lab માં) |
|---|---|---|---|
| A | રસોઇયો એવું સાધન માંગે જે છે જ નહીં | unknown tool | `Error: unknown tool "read_everything"`, turn ચાલુ |
| B | ચિઠ્ઠીમાં જરૂરી વિગત જ નથી | invalid args | `missing required property "file_path"` |
| C | supplier નો ફોન વ્યસ્ત / પાસવર્ડ ખોટો | provider error | 429 → retry → સફળ; 401 → તરત બંધ |
| D | ઓર્ડર વચ્ચે દુકાન અચાનક બંધ | SIGINT | exit 130, ચોપડામાં `aborted` |

**દીવાલો (sandbox):** "ગમે ત્યાં **જોઈ** શકો, **રાંધી** ફક્ત પોતાના રસોડામાં" — `workspace-write` mode. મોટું કામ (બહાર લખવું) કરવું હોય તો **શેઠને પૂછો** (approval) — headless માં શેઠ હાજર નથી, એટલે જવાબ "ના".

**ઉપમા ક્યાં તૂટે છે:** ભોજનાલયની દીવાલ ચોરને પણ રોકે. અહીં file sandbox ફક્ત **લખવા** પર વાડ છે — **વાંચવું ખુલ્લું છે**. `read` થી `/etc/os-release` વંચાય છે. Source પોતે કહે છે: "containment, not a security boundary".

### વિષય-વાર ઊંડી સમજ

#### (1) Debugging ના છ સાધન

| સાધન | ક્યારે | યાદ-ચાવી |
|---|---|---|
| Observer plugin (trace) | શું, ક્યારે, કયા ક્રમમાં | "CCTV" |
| Stored session (`print-session --full`) | model ને **ખરેખર** શું દેખાયું | "ચોપડો" |
| Wire capture | adapter એ HTTP પર શું મોકલ્યું | "ટપાલની નકલ" |
| Breakpoint (`--inspect-brk`) | એક line પર અટકવું | "સમય રોકો" |
| Upstream tests | વર્તનનો contract | "નિયમપોથી" |
| Startup audit | plugin load નથી થતો | "હાજરીપત્રક" |

**યાદ-ચાવી "સી-ચો-ટ-સ-નિ-હા":** CCTV, ચોપડો, ટપાલ, સમય, નિયમપોથી, હાજરી — "**સીધો ચોર ટપાલ સમયે નિયમ હાજર**".

#### (2) ચાર નિષ્ફળતા — એક જ સિદ્ધાંત

A અને B બંને **tool-level** નિષ્ફળતા છે: `tool/result` માં `isError: true`, step 2 ચાલે છે, turn `completed`. Model ને સુધારવાની તક મળે. C અને D **turn-level** છે: turn `error` કે `aborted` થી બંધ થાય.

**યાદ-ચાવી:** "**સાધનની ભૂલ = ચિઠ્ઠી પાછી; ફોન કે દુકાનની ભૂલ = ઓર્ડર બંધ.**"

#### (3) Retry — ક્યારે ફરી ફોન કરવો

- Stream નિષ્ફળ → loop `assistant/attempt` લખે → `agent/request-error` waterfall → `llm-retry` plugin નિર્ણય લે.
- **Retry થાય તેવા codes:** `RATE_LIMIT`, `SERVER`, `TIMEOUT`, `TRANSPORT`, ખાલી response.
- **Retry ન થાય:** `AUTH` (ખોટી key) — ફરી ફોન કરવાથી પાસવર્ડ સાચો નહીં થાય.
- **Backoff:** 5 વાર સુધી, 500 ms થી શરૂ, દરેક વખતે બમણું (≈0.5, 1, 2, 4, 8 s), મહત્તમ 10 s, 10% jitter.
- Retry **એ જ step** માં થાય; `agent/pre-step` અને user message ફરી ઉમેરાતા નથી.

**યાદ-ચાવી "5-અડધી-બમણું-દસ":** 5 વાર, અડધી સેકન્ડથી, બમણું કરતા, 10 સેકન્ડ સુધી. "**રેટ-સર્વર-ટાઇમ-ટ્રાન્સપોર્ટ ફરી, ઓથ કદી નહીં.**"

#### (4) Cancellation — Ctrl+C ની સાંકળ

```text
Ctrl+C (SIGINT) → launcher interrupt(130) → root fiber dispose
  → agent loop cancel(cause) → AbortController.abort()
  → દરેક await પછી signal.throwIfAborted()
  → turn() નો catch: reason aborted → finally: turn/end
```

Tool body ચાલુ હોય તો pipeline તેને **છોડી દેતું નથી**; body શાંત થાય પછી પરિણામ `ABORTED` બને. Exit code: SIGINT → 130, SIGTERM → 0.

**યાદ-ચાવી "બંધ-રદ-ફેંક-નોંધ":** દુકાન **બંધ** → ઓર્ડર **રદ** → ભૂલ **ફેંક** → ચોપડામાં **નોંધ**.

#### (5) Sandbox, approval, અને "fail closed"

- **ત્રણ mode:** `read-only` (કંઈ લખી ન શકાય), `workspace-write` (ફક્ત workspace માં), `danger-full-access` (બધું). Default policy `read-only`; headless/base `workspace-write`.
- **પાંચ પ્રયોગ:** `/etc` માં write → `FS_SANDBOX_DENIED`; escalation માંગ્યું → approval `unavailable` → ના; bash `/etc` માં → backend (`bwrap`) નથી → **command ચાલ્યો જ નહીં**; workspace બહાર read → **સફળ**; ગેરહાજર file → `FS_NOT_FOUND`.
- **Fail closed** = નિયંત્રણ શક્ય ન હોય તો "ના" કહેવું, "ચલો ચલાવી દઈએ" નહીં.

**યાદ-ચાવી "લખવા પર વાડ, વાંચવું ઉઘાડ; શેઠ નથી તો ના, વાડ નથી તો ના."**

#### (6) Data boundary — model provider ને શું જાય છે

દરેક request સાથે `dsh_session_log` (session log નો ભાગ) અને `dsh_plugin_packages` જાય છે, headers માં anonymous user id અને session id. Official API ને session log ન મોકલવો હોય તો `session-log-deepseek` row disable કરો. **Permission અને data બે અલગ પ્રશ્ન છે:** sandbox "શું કરી શકાય" નક્કી કરે, data boundary "શું બહાર જાય".

#### (7) Concurrency

Model એક સાથે ઘણા tool calls આપે તો `isConcurrencySafe` વાળા calls parallel pool માં (default મહત્તમ 10), બાકીના એક-એક. પરિણામો હંમેશા model ના ક્રમમાં ચોપડામાં.

#### (8) Fix નો પુરાવો — ચાર પગલાં

1. નિષ્ફળતા ફરી ઉત્પન્ન કરો. 2. Fix કરો. 3. એ જ પગલાંથી ફરી ચલાવો. 4. Fix ઉલટાવો અને નિષ્ફળતા **પાછી આવે** છે તે બતાવો.

**યાદ-ચાવી "ફરી-સુધાર-ફરી-ઉલટ".**

### નવા ટેકનિકલ શબ્દો — સરળ ગુજરાતીમાં

| શબ્દ | સરળ અર્થ | ઉદાહરણ | યાદ-ચાવી |
|---|---|---|---|
| Debugging | ભૂલનું કારણ શોધવું | trace + session | "ડૉક્ટરી તપાસ" |
| Breakpoint | debugger ને line પર રોકવું | `--inspect-brk` | "થોભો-નિશાન" |
| Retry | નિષ્ફળ request ફરી મોકલવી | `llm/retry` event | "ફરી ફોન" |
| Backoff | દરેક retry પહેલાં વધતી રાહ | 0.5→1→2→4→8 s | "ધીરજ બમણી" |
| Jitter | રાહમાં થોડો random ફેરફાર | 10% | "સૌ એક સાથે ન ફોન કરે" |
| HTTP 429 / 401 / 500 | વધુ માંગ / ઓળખ ખોટી / server ભૂલ | `rate_limit`, `auth_error` | "ભીડ / તાળું / ખામી" |
| SIGINT / SIGTERM | Ctrl+C / સામાન્ય બંધ કરવાનો signal | exit 130 / 0 | "અચાનક / વિનંતી" |
| AbortController | cancel signal આપતો object | `abort()` | "બંધ કરવાનું બટન" |
| Sandbox | side effects ની મર્યાદા | `workspace-write` | "રસોડાની વાડ" |
| Escalation | એક call માટે વધુ ખુલ્લો mode માંગવો | `sandbox_permissions` | "શેઠ પાસે રજા" |
| Approval policy | મંજૂરી પૂછવાની નીતિ | `ask` / `never` | "શેઠને પૂછો કે નહીં" |
| Fail closed | નિયંત્રણ ન હોય તો નકારવું | bash without `bwrap` | "શંકા હોય તો ના" |
| bwrap / Landlock | Linux kernel ની process કેદ | sandbox-local chain | "તાળાવાળું રૂમ" |
| Concurrency | એક સાથે અનેક કામ | parallel tool pool | "અનેક હાથ" |
| Telemetry | ઉપયોગની માહિતી બહાર મોકલવી | OTel, `FEEDBACK_ONLY` | "અહેવાલ" |

### યાદ રાખવાની રીતો

- **"સીધો ચોર ટપાલ સમયે નિયમ હાજર"** — છ debugging સાધન.
- **"સાધનની ભૂલ = ચિઠ્ઠી પાછી; ફોન/દુકાનની ભૂલ = ઓર્ડર બંધ"** — tool-level vs turn-level.
- **"5-અડધી-બમણું-દસ"** અને **"ઓથ કદી નહીં"** — retry.
- **"બંધ-રદ-ફેંક-નોંધ"** — cancellation સાંકળ.
- **"લખવા પર વાડ, વાંચવું ઉઘાડ"** — sandbox ની ખરી સીમા.
- **"ફરી-સુધાર-ફરી-ઉલટ"** — fix નો પુરાવો.

### સામાન્ય ગેરસમજો

| ગેરસમજ | સાચું |
|---|---|
| "Sandbox secrets ને બચાવે છે." | Reads ખુલ્લાં છે; disposable VM/container વાપરો (SAFETY.md). |
| "દરેક provider error retry થાય." | `AUTH` નહીં. |
| "Ctrl+C થી ચોપડો અધૂરો રહે." | `turn/end aborted` durable રીતે લખાય છે. |
| "Headless માં approval prompt આવશે." | કોઈ answerer નથી; escalation હંમેશા નકારાય. |
| "Test pass = fix સાચો." | Fix ઉલટાવો ત્યારે test fail થાય તો જ test fix ને પકડે છે. |

### પુનરાવર્તન કાર્ડ

<details><summary>1. Unknown tool અને invalid args — turn પર શું અસર?</summary>

બંને `isError: true` tool results; step 2 ચાલે; turn `completed`.
</details>

<details><summary>2. Retryable codes કયા, અને કયો નહીં?</summary>

`RATE_LIMIT`, `SERVER`, `TIMEOUT`, `TRANSPORT`, empty response; `AUTH` નહીં.
</details>

<details><summary>3. `server_error,server_error,tool_call_success,success` માં કેટલા calls?</summary>

4 model calls, 2 `llm/retry`, exit 0.
</details>

<details><summary>4. Workspace બહાર `read` — bug કે design?</summary>

Design: "Reads pass through untouched: every mode permits reading".
</details>

<details><summary>5. Headless માં escalation કેમ નકારાય?</summary>

Approval answerer નથી; outcome `unavailable` → fail closed.
</details>

### મિત્રને સમજાવો (3 મિનિટ)

"Sandbox એટલે સુરક્ષિત" — આ વાક્ય અડધું સાચું કેમ છે, તે `read /etc/os-release` ના ઉદાહરણથી મિત્રને સમજાવો, અને સાથે કહો કે બહાર લખવું કેમ રોકાયું.

### આગલા પ્રકરણ સાથે જોડાણ

તમે નિષ્ફળતા ઉત્પન્ન કરવી, નિદાન કરવું, અને fix ને સાબિત કરવો શીખ્યા. પ્રકરણ 6 માં આ જ કુશળતાથી **એક ખરો સુધારો** (Ctrl+C પછીનો ભ્રામક `flush on a closed handle` સંદેશો) problem statement થી regression test અને review notes સુધી લઈ જશો, અને ત્રણ extension માર્ગમાંથી સાચો પસંદ કરશો.

---

પાછળ: [પ્રકરણ 4](04-potano-plugin.md) · આગળ: [પ્રકરણ 6 — Maintainer અને architecture level](06-maintainer-architecture.md)

<!-- citations:begin (generated by tools/refdefs.py) -->
[approval-policy]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/interaction/user-approval/src/index.ts#L68
[batch-execute]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/core/tools/src/batch.ts#L50-L96
[bundle-base-sandbox]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/bundle/base/cordis.patch.yml#L243-L278
[bundle-base-sessionlog]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/bundle/base/cordis.patch.yml#L43-L44
[bundle-base-telemetry]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/bundle/base/cordis.patch.yml#L218-L221
[contracts-notfound]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/core/tools/src/contracts.ts#L291
[fs-sandbox-doc]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/fs/fs-sandbox/src/index.ts#L20-L24
[fs-sandbox-reads]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/fs/fs-sandbox/src/index.ts#L7-L8
[loop-cancel]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/core/agent-loop/src/agent.ts#L191-L201
[loop-maxparallel]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/core/agent-loop/src/index.ts#L295
[loop-maxparallel-default]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/core/agent-loop/src/constants.ts#L6
[loop-request-error]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/core/agent-loop/src/agent.ts#L549-L564
[loop-step]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/core/agent-loop/src/agent.ts#L435-L610
[loop-turn]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/core/agent-loop/src/agent.ts#L327-L433
[pipeline-body]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/core/tools/src/pipeline.ts#L258-L288
[retry-defaults]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/llm/llm/src/retry-policy.ts#L14-L24
[retry-listener]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/llm/llm-retry/src/index.ts#L240
[sandbox-escalation]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/sandbox/sandbox/src/escalation.ts#L200-L204
[sandbox-local-chain]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/sandbox/sandbox-local/src/index.ts#L2
[sandbox-policy]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/sandbox/sandbox-policy/src/index.ts#L134-L138
[sandbox-unavailable]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/sandbox/sandbox/src/index.ts#L139-L150
<!-- citations:end -->
