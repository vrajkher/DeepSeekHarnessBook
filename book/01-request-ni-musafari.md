# પ્રકરણ 1 — એક requestની આખી મુસાફરી

> **Level 1.** આખા પ્રકરણમાં એક જ ઉદાહરણ: **"આ repositoryનું README વાંચીને ગુજરાતી સાર આપો."**
> આપણે તેને terminal થી લઈને બે model calls, એક `read` tool call અને final answer સુધી, code ની દરેક માલિકી સાથે અનુસરીશું.

## આ પ્રકરણ પછી તમે શું કરી શકશો

- `pnpm dsh --profile headless "…"` થી final answer સુધીના દરેક પગલાનો **માલિક file અને symbol** બતાવી શકશો.
- **Turn** અને **step** વચ્ચેનો તફાવત સમજાવી, બતાવી શકશો કે README ઉદાહરણમાં એક turn અને બે steps કેમ છે.
- કઈ માહિતી **session log માં stored** થાય છે અને કઈ ફક્ત **live streamed** થાય છે તે અલગ કરી શકશો.
- API key વગર, scripted mock provider સામે આખી મુસાફરી ચલાવી, દરેક event ને timestamp સાથે જોઈ શકશો.

## 1.1 સરળ સમજ: turn, step, અને બે calls

**Turn** એટલે user ના એક સંદેશથી શરૂ થઈ "હવે કંઈ બાકી નથી" ત્યાં સુધીનું આખું કામ. ઉદાહરણ: README વાળું આખું કામ એક turn છે.

**Step** એટલે **એક model request + તે request એ માંગેલા tools**. Architecture doc ની વ્યાખ્યા: "A step is one model request plus the tools it calls. A turn is zero or more steps" ([docs/architecture.md — Turn flow][arch-turnflow]). ✅

README ઉદાહરણમાં:

1. **Step 1:** model ને પૂછ્યું → model એ જવાબમાં text નહીં, `read` tool call આપ્યો → harness એ `read({"file_path":"README.md"})` ચલાવ્યું.
2. **Step 2:** tool નું પરિણામ ઉમેરીને model ને **ફરી** પૂછ્યું → model એ ગુજરાતી સાર લખ્યો, કોઈ tool નહીં → turn પૂરો.

તેથી **બે model calls**. (એક અપવાદ છે — base bundle ત્રીજો call પણ કરી શકે છે. તે આ પ્રકરણની આગાહી કસોટી છે.)

## 1.2 Sequence diagram: બંને model calls

```mermaid
sequenceDiagram
  autonumber
  participant CLI as headless runner
  participant Agent as ReactLoopAgent
  participant Session as Session log
  participant Prompt as ctx.systemPrompt
  participant LLM as ctx.llm → DeepSeekAdapter
  participant API as Provider (/v1/messages)
  participant Tools as ctx.tools → executor → pipeline
  participant Read as read tool → ctx.fs
  CLI->>Agent: agents.create(), agent.followup(task)
  Agent->>Session: turn/start
  Agent->>Prompt: assemble(tool schemas, sections)
  Agent->>Session: step/start, system/message, user/message ×4, request/header, request/context
  Agent->>LLM: stream(request #1)
  LLM->>API: POST /messages (stream: true)
  API-->>LLM: SSE: tool_use read
  LLM-->>Agent: StreamChunk* (live: agent/assistant-stream)
  Agent->>Session: assistant/message [tool-call read]
  Agent->>Tools: execute({calls})
  Tools->>Session: tool/call
  Tools->>Read: execute({file_path:"README.md"})
  alt tool success
    Read-->>Tools: {path, lines, totalLines}
  else tool failure (unknown tool, invalid args, not found, sandbox)
    Tools-->>Tools: "Error: …" with isError true
  end
  Tools->>Session: tool/result
  Agent->>Session: step/end, step/start
  Agent->>LLM: stream(request #2, includes tool_result)
  LLM->>API: POST /messages
  API-->>LLM: SSE: text
  Agent->>Session: assistant/message [text], step/end, turn/end completed
  CLI-->>CLI: print final text, exit 0
```

| Diagram node | Owner file | Symbol |
|---|---|---|
| headless runner | `packages/bundle/headless/src/index.ts` | [`run`][headless-run], [`agents.create`][headless-create], [`agent.followup`][headless-followup] |
| ReactLoopAgent | `packages/core/agent-loop/src/agent.ts` | [`turn`][loop-turn], [`preStep`][loop-preStep], [`step`][loop-step] |
| Session log | `packages/core/session/src/index.ts` | [`Session.append`][session-append], [`deriveMessages`][session-derive] |
| ctx.systemPrompt | `packages/core/system-prompt/src/index.ts` | `assemble` (called from [`preStep`][loop-preStep]) |
| ctx.llm → DeepSeekAdapter | `packages/llm/llm/src/index.ts`, `packages/llm/llm-deepseek/src/adapter.ts` | [`prepareCall`][llm-prepareCall], [`stream`][llm-stream], [`fetch /messages`][deepseek-fetch] |
| ctx.tools → executor → pipeline | `packages/core/tools/src/{index,batch,pipeline}.ts`, `packages/core/tool-executor-native/src/index.ts` | [`execute`][tools-execute], [`executeToolBatch`][batch-execute], [`prepare`][pipeline-prepare] / [`dispatch`][pipeline-dispatch] |
| read tool | `packages/fs/tool-fs/src/read.ts` | [`applyReadTool`][read-tool] |

Solid arrow = call direction; dashed arrow = returned data. `alt` box બંને tool branch બતાવે છે: નિષ્ફળતા પણ **tool/result** બને છે અને step 2 ચાલે જ છે (પ્રકરણ 5 માં ચારેય નિષ્ફળતા ખરેખર ચલાવીશું). 🧪

## 1.3 Entry point: `dsh` નો દરવાજો

`pnpm dsh …` એ root `package.json` નો script છે: `"dsh": "node --import tsx/esm apps/cli/src/bin.ts"`. ✅

[`runCli`][cli-runCli] arguments parse કરે છે અને `invocation.mode` પર `switch` કરે છે. `'profile'` mode માં તે `runProfile(...)` બોલાવે છે. Input: argv; output: કંઈ નહીં (side effect: આખી app boot થાય). પ્રકરણ 2 આ boot ને line-by-line ખોલશે. અહીં એટલું જાણો કે **headless profile** ના અંતે `headless-runner` નામની config row mount થાય છે ([headless patch][bundle-headless]):

```yaml
    - id: headless-runner
      name: '@deepseek-ai/dsh-headless'
      inject: [headlessStartup]
      config:
        task: !!js ctx.headlessStartup.task
```

(repository code; `!!js` એટલે YAML માં JavaScript expression, જે plugin context સામે evaluate થાય છે.)

## 1.4 Turn શરૂ થાય તે પહેલાં: Agent બનાવવો

Headless plugin `inject = ['agentDefaultModel', 'agents', 'sessions']` જાહેર કરે છે ([source][headless-inject]) — એટલે આ ત્રણ services ન હોય ત્યાં સુધી તે ચાલતો જ નથી. પછી [`run`][headless-run]:

1. task વાંચે છે (ખાલી હોય તો error: `a task is required, for example: dsh --profile headless "run the tests"`).
2. default model selection લે છે (base bundle: provider `deepseek-official`, model `deepseek-flash`). ✅
3. નવો Session id `session-<uuid>` બનાવી [`agents.create({ sessionId, meta: { cwd }, … })`][headless-create] બોલાવે છે.
4. Task ને user message તરીકે મોકલે છે ([source][headless-followup]):

```ts
      agent.followup(createUserMessage({
        content: [{ type: 'text', text: task }],
        source: { kind: 'user' },
      }))
```

5. `agent.whenIdle()` ની રાહ જુએ છે, `sessions.flush(...)` કરે છે, final text છાપે છે, અને `io.exit(0 અથવા 1)` માંગે છે.

`followup` input ને **inbox** માં મૂકે છે અને driver ને જગાડે છે. Driver એટલે [`kick`][loop-kick]: `while (await this.turn()) {}`.

## 1.5 `turn()`: turn ક્યાં શરૂ થાય અને ક્યાં પૂરો થાય

[`ReactLoopAgent.turn`][loop-turn] (lines 327–433) નું હાડપિંજર, **સરળ teaching pseudocode** તરીકે:

```ts
// teaching pseudocode — real code: packages/core/agent-loop/src/agent.ts#L327-L433
session.append('turn/start', { turn })                 // turn અહીં શરૂ
while (true) {
  const decision = await preStep(target, { turn, step }) // inbox claim + prompt + agent/pre-step
  session.append('step/start', { turn, step })
  const stepEnd = await step(decision)                  // model call + tools
  session.append('step/end', { turn, step })
  if (turnEnds && inbox.nextStep.length === 0) break    // કંઈ બાકી નથી
  target = 'next-step'
}
// finally:
session.append('turn/end', { turn, reason })            // turn અહીં પૂરો — error હોય તો પણ
```

ત્રણ વાત ધ્યાનમાં રાખો:

- **`turn/start`** એ [line 336][loop-turn-start] પર, પહેલો step શરૂ થાય **તે પહેલાં** લખાય છે.
- **`turn/end`** એ `finally` block માં ([line 422][loop-turn-end]) લખાય છે, તેથી error, abort કે success — દરેક રસ્તે turn બંધ થાય છે. Reason `completed`, `error`, `aborted`, `blocked`, કે `max-tokens` હોય છે.
- Step નિષ્ફળ જાય અને કોઈ tool call નું પરિણામ બાકી હોય, તો loop [`toolRecovery.results()`][loop-recovery] વડે ખૂટતા `tool/result` લખે છે, જેથી log માં દરેક call ને જવાબ મળે.

## 1.6 `preStep()`: prompt અને tools ભેગા કરવા

[`preStep`][loop-preStep] દરેક proposed step માટે:

1. `this.inbox.claim(target, turn)` — inbox માંથી user message લે છે.
2. `this.model.current()` — model selection; ન હોય તો સ્પષ્ટ error.
3. `this.loopCtx.tools.resolve({ agent, modelSelection, signal })` — આ step માં કયા tools દેખાશે.
4. `this.loopCtx.systemPrompt.assemble(...)` — system prompt sections + tool schemas.
5. `this.dispatch.waterfall('agent/pre-step', …)` — plugins ને message બદલવાની કે step નકારવાની તક. Default (છેલ્લું) વર્તન: claimed messages + runtime context સાથે `{ kind: 'enter' }`.

**Waterfall** એટલે middleware ની જેમ listener ની સાંકળ; દરેક listener એ `next()` બોલાવવું પડે, નહીં તો સાંકળ ત્યાં જ અટકે ([Cordis primer — dispatch modes][primer-dispatch]). ✅

## 1.7 `step()`: model request બનાવવો, મોકલવો, પરિણામ સાચવવું

[`step`][loop-step] (lines 435–610) એક `while (true)` છે, કારણ કે retry એ જ step ની અંદર થાય છે. એક attempt માં:

**(a) Adapter બાંધવો.** [`prepareRequest`][loop-prepareRequest] પહેલાં `agent/request` waterfall ચલાવે છે, પછી `this.loopCtx.llm.prepareCall(...)`. આ step નો provider/model અહીં બદલી શકાતો નથી — બદલે તો loop error ફેંકે છે.

**(b) Model-visible input log કરવો.** System prompt `system/message` તરીકે, અને પહેલા attempt માં દરેક entered message `user/message` તરીકે append થાય છે ([source][loop-admit]):

```ts
      if (firstAttempt) {
        for (const message of decision.messages) {
          if (message.source.kind === 'runtime-context') {
            if (context !== undefined && !contextAdmitted) {
              this.session.append('user/message', context, { surfaceOp: 'append' })
```

Repository નો નિયમ છે: "**Model-visible ⟺ logged**" — model સુધી પહોંચતું બધું session log માંથી ફરી બનાવી શકાય તેવું હોવું જોઈએ ([AGENTS.md][agents-conventions]). ✅

**(c) Request derive અને freeze.** [`buildRequest`][loop-buildRequest] `request/header` (provider, model, tools) અને `request/context` (context window) log કરે છે, પછી `session.deriveMessages()` થી model history બનાવી તેને `deepFreeze` કરે છે ([source][loop-derive]). એટલે model ને મોકલાતી history **log માંથી** આવે છે, memory ના કોઈ અલગ array માંથી નહીં.

**(d) Stream.** [Source][loop-stream]:

```ts
        const stream = preparedCall?.stream(request) ?? this.loopCtx.llm.stream(request)
        signal.throwIfAborted()
        live.start()
        started = true
        for await (const chunk of stream) {
          signal.throwIfAborted()
          live.push(chunk)
        }
```

દરેક chunk `agent/assistant-stream` નામના **live** event તરીકે publish થાય છે, durable log માં નહીં.

**(e) Settle.** Stream સફળ પૂરો થાય તો આખો compact stream એક `assistant/message` event માં embed થાય છે ([source][loop-assistant-message]). નિષ્ફળ થાય તો `assistant/attempt` લખાય અને `agent/request-error` waterfall retry નક્કી કરે ([source][loop-request-error]).

**(f) Tools.** [Source][loop-tools-execute]:

```ts
        const toolCalls = message.content.filter(block => block.type === 'tool-call')
        if (toolCalls.length === 0) return { kind: 'completed' }
        …
          const result = await this.loopCtx.tools.execute({
            calls: toolCalls, signal, agent: this, log: { turn, step },
            maxParallelToolCalls, toolSet: decision.toolSet,
          })
          …
          return result.concluded ? { kind: 'completed' } : null
```

Tool calls હોય તો step `null` પાછું આપે છે — "turn પૂરો નથી". તેથી `turn()` નો loop step 2 શરૂ કરે છે. Step 2 માં model text આપે અને tool call નહીં, એટલે `{ kind: 'completed' }` → turn બંધ.

## 1.8 Tool call ની અંદર (ટૂંકમાં; વિગત પ્રકરણ 3)

`ctx.tools.execute` પસંદ કરેલા **executor** ને કામ સોંપે છે ([`selectExecutor`][tools-selectExecutor]). Base bundle `tool-executor-native` mount કરે છે ([rows][bundle-base-tools]), જે [`executeToolBatch`][batch-execute] ચલાવે છે: arguments JSON parse, `tool/call` log, pipeline (`tools/pre-execute` → guards → `tools/execute` → tool body → `tools/post-execute`), અને છેલ્લે `tool/result` log.

`read` tool ([`applyReadTool`][read-tool]) `ctx.fs` પાસે path resolve કરાવે છે, file વાંચે છે, અને line-numbered text પાછું આપે છે.

## 1.9 શું stored થાય છે અને શું ફક્ત streamed?

| માહિતી | ક્યાં | ટકાઉ? |
|---|---|---|
| `turn/start`, `step/start`, `system/message`, `user/message`, `request/header`, `request/context`, `assistant/message`, `tool/call`, `tool/result`, `step/end`, `turn/end` | Session log (`session/event` દ્વારા broadcast, JSONL file માં persisted) | ✅ હા |
| `assistant/attempt` (નિષ્ફળ/retry થયેલ attempt નો stream) | Session log | ✅ હા, પણ model history માં નહીં |
| `agent/assistant-stream` start/chunk/end frames | process-local live event | ❌ ના; chunk frames transient છે |
| `agent/status`, `agent/inbox/*` live notifications | live event | ❌ ના |

સ્રોત: architecture doc નું turn flow ✅ અને અમારો ચલાવેલો trace 🧪. Durable/live નો નિયમ: "Session events are durable facts appended to the log … Agent events (`agent/*`) carry a live `Agent`" ([architecture.md][arch-turnflow]).

## Source map: આ ક્રમમાં ખોલો

| ક્રમ | File | Symbol | Input → Output (side effect) |
|---|---|---|---|
| 1 | `apps/cli/src/bin.ts` | [`runCli`][cli-runCli] | argv → (profile boot) |
| 2 | `packages/bundle/headless/src/index.ts` | [`run`][headless-run] | task → stdout text, exit code |
| 3 | `packages/core/agent-loop/src/agent.ts` | [`kick`][loop-kick] → [`turn`][loop-turn] | inbox → `turn/*` events |
| 4 | same | [`preStep`][loop-preStep] | claimed messages → enter/reject decision |
| 5 | same | [`step`][loop-step] | decision → `assistant/*`, `tool/*` events |
| 6 | same | [`buildRequest`][loop-buildRequest] | log → frozen `GenerateOptions` |
| 7 | `packages/llm/llm/src/index.ts` | [`stream`][llm-stream] | request → `llm/stream` waterfall → adapter |
| 8 | `packages/llm/llm-deepseek/src/adapter.ts` | [`fetch /messages`][deepseek-fetch] | body → HTTP SSE |
| 9 | `packages/core/tools/src/batch.ts` | [`executeToolBatch`][batch-execute] | tool calls → results |
| 10 | `packages/fs/tool-fs/src/read.ts` | [`applyReadTool`][read-tool] | `file_path` → numbered lines |

## Lab 1 — key વગર આખી મુસાફરી જુઓ

**વિચાર.** Repository માં `@deepseek-ai/dsh-llm-mock-server` છે: Messages-compatible HTTP/SSE server, જે દરેક request માટે scripted વર્તન આપે છે ([`tool_call_success`][mock-tool-call]). DeepSeek adapter ને `DEEPSEEK_BASE_URL` થી તેની તરફ વાળી શકાય છે ([`BASE_URL_ENV`][deepseek-baseurl]). Script: પહેલો request → `read` tool call; બીજો → ગુજરાતી text.

**તૈયારી** (harness checkout ના root માં, `pnpm install && pnpm run build` પછી):

```bash
cp -r <book>/labs tmp/book-labs
```

**ચલાવો:**

```bash
bash tmp/book-labs/request-trace/run-mock.sh
```

આ script ([labs/request-trace/run-mock.sh](../labs/request-trace/run-mock.sh)) ત્રણ કામ કરે છે: mock server ને port 8000 પર `--sequence tool_call_success,success` સાથે શરૂ કરે છે; એક overlay લખે છે જે observer plugin [`trace-events.ts`](../labs/request-trace/trace-events.ts) ને **absolute path** થી insert કરે છે અને `session-title-llm` row ને disable કરે છે; અને પછી `pnpm dsh --profile headless --patch <overlay> "આ repositoryનું README વાંચીને ગુજરાતી સાર આપો."` ચલાવે છે.

**અપેક્ષિત stdout** (🧪 exit 0):

```text
README નો સાર: DeepSeek Harness એ plugin આધારિત agent harness છે.
```

ધ્યાન: આ text mock server એ `--success-text` થી આપ્યો છે. Lab **plumbing** ચકાસે છે, model ની ગુણવત્તા નહીં.

**અપેક્ષિત stderr** (અમારો run, [evidence/two-calls.err](../evidence/two-calls.err) માંથી ટૂંકાવીને):

```text
[trace +  132ms] session/event #4 turn/start {"turn":1}
[trace +  239ms] session/event #6 step/start {"turn":1,"step":1}
[trace +  243ms] session/event #7 system/message
[trace +  244ms] session/event #8 user/message
[trace +  245ms] session/event #9 user/message
[trace +  246ms] session/event #10 user/message
[trace +  246ms] session/event #11 user/message
[trace +  248ms] session/event #12 request/header
[trace +  249ms] session/event #13 request/context
[trace +  250ms] llm/stream call #1 deepseek-official/deepseek-flash messages=5 tools=[bash,create_goal,edit,…]
[trace +  250ms] live  stream start turn=1 step=1
[trace +  306ms] session/event #16 assistant/message
[trace +  307ms] live  stream end chunks=7 -> assistant/message #16
[trace +  308ms] session/event #17 tool/call name=read arguments={"file_path":"README.md"}
[trace +  319ms] tools/result read isError=false chars=3175
[trace +  321ms] session/event #18 tool/result
[trace +  321ms] session/event #19 step/end {"turn":1,"step":1}
[trace +  340ms] session/event #20 step/start {"turn":1,"step":2}
[trace +  342ms] llm/stream call #2 deepseek-official/deepseek-flash messages=7 tools=[bash,create_goal,edit,…]
[trace +  359ms] session/event #22 assistant/message
[trace +  359ms] live  stream end chunks=13 -> assistant/message #22
[trace +  359ms] session/event #23 step/end {"turn":1,"step":2}
[trace +  360ms] session/event #24 turn/end reason={"kind":"completed"}
[trace +  402ms] dispose: total llm/stream calls = 2
```

**અવલોકનો જે તમારે જાતે ચકાસવાના છે:**

1. `llm/stream call` બરાબર **2** વાર. Call #1 માં `messages=5` (1 system + 4 user), call #2 માં `messages=7` (+ assistant tool-call + tool result).
2. ચાર `user/message` કેમ? Stored session ખોલો:

```bash
node tmp/book-labs/request-trace/print-session.mjs "$(find tmp/book-home/sessions -name 'session.v*.jsonl*' | head -1)"
```

અમને મળ્યું ([evidence/two-calls.session.txt](../evidence/two-calls.session.txt)): `source={"kind":"user"}` (તમારું task), `agent-instructions` (checkout ના `AGENTS.md` માંથી workspace instructions), `runtime-context` (current working directory વગેરે), અને `skill-catalog`. 🧪
3. Session file નું નામ `session.v4.jsonl.zstd` — format version 4, zstd-compressed JSONL. Folder નામ cwd પરથી બને છે.
4. `chunks=7` અને `chunks=13` એ live frames છે; file માં ફક્ત committed `assistant/message` છે, જેમાં compact stream embedded છે.

**Wire પર ખરેખર શું ગયું?** [`capture-wire.ts`](../labs/request-trace/capture-wire.ts) એ mock server ને in-process ચલાવી દરેક request body નો સાર લખે છે. અમારું પરિણામ ([evidence/wire.json](../evidence/wire.json)): call #1 માં `messageRoles: ["user"]` — ચારેય logged user messages **એક** wire `user` message ના ચાર text blocks બન્યા; call #2 માં `["user","assistant","user"]`, અને છેલ્લા user message માં `tool_result` block. બંને request માં 25 tools અને `dsh_session_log` field હતાં. 🧪 (પ્રકરણ 3 અને 5 માં આ field પર પાછા આવીશું.)

## આગાહી કસોટી

`TITLE=on` (base bundle નો LLM title generator ચાલુ) અને default script `tool_call_success,success` સાથે ચલાવો:

```bash
TITLE=on bash tmp/book-labs/request-trace/run-mock.sh
```

**ચલાવતા પહેલાં લખો:** (1) કુલ કેટલા `llm/stream` calls થશે? (2) stdout માં શું આવશે? (3) exit code? (4) run કેટલો સમય લેશે — 1 સેકન્ડથી ઓછો કે વધુ?

જવાબ અને અમારો trace: [પરિશિષ્ટ D — Lab 1](../appendix/D-lab-solutions.md#lab-1).

## નિષ્ફળતા: stdout ખાલી, `dsh: TRANSPORT: DeepSeek Messages transport failed`

**લક્ષણ.** Lab script વગર સીધું `pnpm dsh --profile headless "…"` ચલાવ્યું, `DEEPSEEK_BASE_URL` set કર્યું નથી, અને network public API સુધી પહોંચતું નથી.

**ટૂંકો નિદાન માર્ગ.**

1. Stderr ની પહેલી lines જુઓ. અમારા sandbox માં: `model listing from https://api.deepseek.com/models failed … using the bundled catalog` અને પછી `dsh: TRANSPORT: DeepSeek Messages transport failed`. 🧪 ([evidence/nofs.err](../evidence/nofs.err) ના અંતે)
2. `TRANSPORT` code adapter ના [`generate`][deepseek-generate] માંથી આવે છે: `fetch` પોતે નિષ્ફળ ગયું, provider એ HTTP error આપી નથી.
3. Base URL ક્યાંથી આવે છે? [`DEEPSEEK_BASE_URL`][deepseek-baseurl] env, નહીં તો public API. Lab માટે તેને mock તરફ વાળો.

## Mastery check

1. Turn અને step ની વ્યાખ્યા લખો, અને README ઉદાહરણમાં બંનેની સંખ્યા કહો.
2. `turn/end` `finally` block માં કેમ છે? તેનાથી કઈ ખાતરી મળે છે?
3. Call #2 માં `messages=7` ના સાત messages કયા?
4. `agent/assistant-stream` chunk frames અને `assistant/message` વચ્ચે replay ની દૃષ્ટિએ શું ફરક છે?
5. Step 1 tool call પછી `step()` શું return કરે છે, અને `turn()` તેનો અર્થ શું કરે છે?
6. Model history કઈ function થી બને છે, અને તે memory ના કોઈ અલગ array ને બદલે log માંથી કેમ બને છે?

જવાબો: [પરિશિષ્ટ D — પ્રકરણ 1](../appendix/D-lab-solutions.md#ch1).

---

પાછળ: [પ્રકરણ 0](00-paayo-ane-pratham-run.md) · આગળ: [પ્રકરણ 2 — Cordis અને plugin architecture](02-cordis-plugin-architecture.md)

<!-- citations:begin (generated by tools/refdefs.py) -->
[agents-conventions]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/AGENTS.md#L130-L142
[arch-turnflow]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/docs/architecture.md#L81-L111
[batch-execute]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/core/tools/src/batch.ts#L50-L96
[bundle-base-tools]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/bundle/base/cordis.patch.yml#L511-L516
[bundle-headless]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/bundle/headless/cordis.patch.yml#L9-L46
[deepseek-baseurl]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/llm/llm-deepseek/src/config.ts#L119
[deepseek-fetch]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/llm/llm-deepseek/src/adapter.ts#L142-L170
[deepseek-generate]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/llm/llm-deepseek/src/adapter.ts#L65-L90
[headless-create]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/bundle/headless/src/index.ts#L389-L396
[headless-followup]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/bundle/headless/src/index.ts#L420-L433
[headless-inject]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/bundle/headless/src/index.ts#L45
[headless-run]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/bundle/headless/src/index.ts#L322-L455
[llm-stream]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/llm/llm/src/index.ts#L1170-L1185
[loop-admit]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/core/agent-loop/src/agent.ts#L463-L478
[loop-assistant-message]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/core/agent-loop/src/agent.ts#L566-L586
[loop-derive]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/core/agent-loop/src/agent.ts#L728-L745
[loop-kick]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/core/agent-loop/src/agent.ts#L268-L282
[loop-recovery]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/core/agent-loop/src/agent.ts#L376-L385
[loop-request-error]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/core/agent-loop/src/agent.ts#L549-L564
[loop-step]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/core/agent-loop/src/agent.ts#L435-L610
[loop-stream]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/core/agent-loop/src/agent.ts#L490-L498
[loop-tools-execute]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/core/agent-loop/src/agent.ts#L586-L601
[loop-turn]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/core/agent-loop/src/agent.ts#L327-L433
[loop-turn-end]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/core/agent-loop/src/agent.ts#L422
[loop-turn-start]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/core/agent-loop/src/agent.ts#L336
[mock-tool-call]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/test-support/llm-mock-server/src/index.ts#L586-L594
[pipeline-dispatch]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/core/tools/src/pipeline.ts#L295-L326
[pipeline-prepare]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/core/tools/src/pipeline.ts#L190-L236
[primer-dispatch]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/docs/cordis-primer.md#L19-L25
[read-tool]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/fs/tool-fs/src/read.ts#L68-L163
[session-append]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/core/session/src/index.ts#L806-L836
[session-derive]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/core/session/src/index.ts#L999-L1021
[tools-execute]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/core/tools/src/index.ts#L375-L377
<!-- citations:end -->
