# પ્રકરણ 5 — Debugging, permissions અને reliability

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
