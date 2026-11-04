# પરિશિષ્ટ D — Lab solutions અને mastery check ના જવાબો

દરેક જવાબમાં ચિહ્ન: 🧪 = અમે ચલાવ્યું, ✅ = source વાંચીને, ⚠️ = તર્ક/અનુમાન. ચલાવેલા outputs [evidence/](../evidence/) માં છે.

---

<a id="lab-0"></a>

## Lab 0 — આગાહી: `apply` throw કરે ત્યારે

**જવાબ 🧪:** process **exit 0** સાથે પૂરું થાય છે અને **કંઈ છપાતું નથી**. Tutorial કહે છે "the process dies with your error", પણ pinned commit પર એવું થતું નથી. Loader entry failure `ctx.logger.error(error)` થી log કરે છે, અને `vendor/cordis/bin.js` કોઈ log exporter mount કરતું નથી. Book launcher `bin-with-logs.ts` સાથે:

```text
[E] hello Error: apply exploded
[entry] ./hello.ts -> FAILED
```

<a id="ch0"></a>

## પ્રકરણ 0 — mastery check

1. **Agent** એ loop છે (`ReactLoopAgent`: model → tool → model). **Harness** એ આખું તંત્ર છે: loop + tools + session log + permissions + adapters + UI. ઉદાહરણ: headless profile ના 101 config rows માંથી agent loop ફક્ત એક row (`agent-loop`) છે. 🧪
2. `node --import tsx/esm apps/cli/src/bin.ts` (root `package.json` નો `scripts.dsh`). ✅
3. Runtime પર **કંઈ નહીં** (type-only import ભૂંસાઈ જાય છે). Compile વખતે `dsh-tools` ના declaration merges — દા.ત. `ctx.tools` અને `'tools/result'` event ના types — scope માં આવે છે. ✅
4. WSL2 અને Windows filesystem વચ્ચેની I/O ધીમી છે, અને Git/install/build I/O-heavy છે; development guide checkout ને Linux filesystem માં રાખવા કહે છે. ✅
5. અમારા run માં `node ../../vendor/cordis/bin.js` (tsx વગર) પણ **exit 0, કંઈ છપાયું નહીં**. 🧪 Book launcher ને Node ના native type stripping થી ચલાવ્યો ત્યારે કારણ દેખાયું: `ERR_MODULE_NOT_FOUND: Cannot find package '@deepseek-ai/cordis' imported from …/tmp/…` 🧪 — `tmp/` માંથી workspace packages ફક્ત tsx લાગુ કરતા tsconfig `paths` થી જ resolve થાય છે. ⚠️ (bare launcher ના silent run નું ચોક્કસ internal કારણ અમે trace કર્યું નથી; સંભવિત — Include plugin પોતે `tmp/` ના base URL થી resolve ન થયું અને error logger માં ગયો.)

---

<a id="lab-1"></a>

## Lab 1 — આગાહી: `TITLE=on` અને બે-entry script

**જવાબ 🧪** ([evidence/three-calls-title-on-exhausted.err](../evidence/three-calls-title-on-exhausted.err)):

| પ્રશ્ન | જવાબ |
|---|---|
| Model calls | **8**: agent step 1 (tool call), title request (scripted `success` ખાઈ ગયો), agent step 2 → script exhausted (HTTP 500) → 5 retries |
| stdout | ખાલી |
| stderr છેલ્લી line | `dsh: SERVER: mock script exhausted` |
| Exit | 1 |
| સમય | આશરે 16 સેકન્ડ — retry backoff (≈0.5, 1, 1.9, 3.9, 8.2 s) |

શીખ: "README ઉદાહરણ = 2 calls" ફક્ત title row બંધ હોય ત્યારે સાચું છે. Base bundle નો `session-title-first-prompt-llm` દરેક નવા session માં એક auxiliary call (`purpose: session-title`) કરે છે. Script માં ત્રીજો `success` ઉમેરો તો run સફળ થાય છે (5/5 runs, પ્રકરણ 6). ⚠️ આ arrival order પર આધારિત છે: title request બીજો પહોંચે છે; mock server નું cursor બધા callers વચ્ચે shared છે (README ની "Known limitations").

<a id="ch1"></a>

## પ્રકરણ 1 — mastery check

1. **Turn:** પહેલો input claim થાય ત્યાંથી "કંઈ બાકી નથી" ત્યાં સુધી. **Step:** એક model request + તેના tools. README ઉદાહરણ: 1 turn, 2 steps. ✅🧪
2. `finally` ને લીધે દરેક `turn/start` ને reason સાથે `turn/end` મળે છે — error, abort કે success. Resume અને replay આ જોડ પર આધાર રાખે છે; interrupted run માં પણ `turn/end {"kind":"aborted"}` લખાયો. ✅🧪
3. System, 4 user messages (task, `agent-instructions`, `runtime-context`, `skill-catalog`), assistant (tool-call), tool result. 🧪
4. Chunk frames process-local અને transient છે; `assistant/message` durable છે અને compact stream embed કરે છે. Replay, fork, resume durable settlement વાંચે છે. ✅
5. `null` ("concluded નથી"). `turn()` માં `turnEnds` `null` રહે છે, તેથી loop `target = 'next-step'` સાથે બીજો step શરૂ કરે છે. ✅
6. `session.deriveMessages()` (`buildRequest` માં). "Model-visible ⟺ logged" — દરેક request log માંથી ફરી બની શકે; fork/resume/telemetry એ જ log વાપરે છે. ✅

---

<a id="lab-2"></a>

## Lab 2 — આગાહી: `working-directory` disable

**જવાબ 🧪** ([evidence/no-working-directory.err](../evidence/no-working-directory.err)):

1. **16** entries — 18 કરતાં ઓછી. `working-directory` પોતે disabled છે (inactive ગણાતી નથી), અને `fs` હાજર હોવાથી `ptc-runtime` હવે active છે.
2. `tool-fs … pending (waiting for service: workingDirectory)` — હવે ફક્ત એક service.
3. Startup fatal **નથી** (કોઈ required entry નહીં). અમારા run નો exit 1 unreachable provider (`TRANSPORT`) ને લીધે હતો.

<a id="ch2"></a>

## પ્રકરણ 2 — mastery check

1. Startup: `runProfile` → `boot` → `mountRootInclude` → `auditStartupEntries`. Request: `ReactLoopAgent.turn`/`step`. ✅
2. Bundles (`dsh.profile.bundles` ક્રમ) → profile `cordis.patch.yml` → `$DSH_HOME/cordis.patch.yml` → `--patch` (argv ક્રમ) → telemetry switch. પાછળનું layer જીતે, એટલે તમારું `--patch`. ✅
3. `ReflectService.provide` throw કરે છે: `service "<name>" has been registered at <fiber>`. ✅
4. `agent-loop` અને `tool-executor-native` [`requiredStartupEntryIds`](https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/boot/app-boot/src/index.ts#L946-L957) માં છે; `systemPrompt` વગર `tools` આવતું નથી, તેથી બંને pending → `StartupError`. `fs` ના consumers required નથી → warning. ✅🧪
5. Executor **service નથી**; તે `ctx.tools.setExecutor(...)` થી registration છે. `inject` ફક્ત services ની રાહ જોઈ શકે છે, અને tutorial નો demo call `apply` માં તરત ચાલે છે. ✅🧪
6. ઊંધા ક્રમમાં (LIFO): પાછળથી બનેલી નોંધણી — જે પહેલાંની પર આધાર રાખી શકે — પહેલાં undo થાય. ✅

---

<a id="lab-3"></a>

## Lab 3 — આગાહી: directory ને `read`

**જવાબ 🧪** ([evidence/read-directory.err](../evidence/read-directory.err)): `Error: cannot read "<harness>/packages": not a regular file`; `error: {"name":"FsError","code":"FS_NOT_REGULAR_FILE"}`; turn `completed`.

<a id="ch3"></a>

## પ્રકરણ 3 — mastery check

1. Schema: `ToolArgsError`, code `INVALID_ARGS`. Value: `parseReadArgs` નું સામાન્ય `Error` (દા.ત. `offset must be a positive integer`) — `HarnessError` ન હોવાથી `info` code નથી. Filesystem: `FsError` codes `FS_NOT_FOUND`, `FS_NOT_REGULAR_FILE`. ✅🧪
2. `Error: <message>` text સાથે `isError: true`. `info` (`name`, `code`) `tool/result` event ના `error` field માં રહે છે — routing/telemetry માટે; model-facing content ફક્ત text છે (`toolErrorResult`). ✅
3. ઉપર (loop, tools, session): ફક્ત `GenerateOptions` અને `StreamChunk`. નીચે (adapter): wire format, connection, auth — session log નહીં. ✅
4. દરેક model request ને બધા plugins જોઈ/લપેટી શકે — દા.ત. trace અને metrics plugins, loop બદલ્યા વગર. ✅🧪
5. Log source of truth છે; ખરાબ event પછી flush વખતે નહીં, append વખતે જ પકડાય. ✅
6. Turn 1 નો `user/message`, ખાલી `assistant/attempt`, `step/end`, અને `turn/end {"kind":"aborted","reason":{"kind":"disposed"}}`. 🧪

---

<a id="lab-4"></a>

## Lab 4 — આગાહી: right side માં પણ duplicate

**જવાબ 🧪:**

```json
{"duplicateKeys":2,"onlyRight":1,
 "duplicates":[{"side":"left","key":["INV-1004"],"lines":[5,6]},
               {"side":"right","key":["INV-1004"],"lines":[4,6]}],
 "onlyRight":[{"key":["INV-1005"],"line":5}]}
```

<a id="ch4"></a>

## પ્રકરણ 4 — mastery check

1. JSON Schema (model ને જાય છે); args `defineTool` ના `execute` wrapper માં `validate(args)` થી validate થાય છે, tool body પહેલાં. ✅
2. એક duplicate પસંદ કરવી એ guess છે; ખોટી pair ખોટું "reconciled" બતાવે — audit માં છુપાયેલી ભૂલ. ⚠️
3. ફાયદો: `workingDirectory` વગરની compositions (અમારા tests) માં પણ tool ચાલે. નુકસાન: Cordis load-order guarantee નથી; `dsh` માં સેવા હાજર ન હોય તો path process cwd સામે resolve થાય. ⚠️
4. `register()` effect છે; plugin unload થતાં disposer ચાલે છે ("registrations are effects"). Test 5 એ સાબિત કરે છે. ✅🧪
5. Cordis config resolution (`z.natural()`) load વખતે જ `ValidationError: … $.maxBytes expected number >= 0 but got -5` — tool register જ થતો નથી; ખોટી config ચૂપચાપ default બનતી નથી. 🧪
6. Overlay ન આપો; `disabled: true` વાળું બીજું overlay; profile `cordis.patch.yml` માં એ જ row. 🧪 (બીજો રસ્તો)

---

<a id="lab-5"></a>

## Lab 5 — આગાહી: બે `server_error` પછી સફળતા

**જવાબ 🧪** ([evidence/server-error-twice.err](../evidence/server-error-twice.err)): **4** model calls, **2** `llm/retry` events, exit **0**, આશરે 1.8 s (dsh ની અંદર; mock શરૂ કરવા સહિત wall time ≈5.8 s). `SERVER` retryable codes માં છે.

<a id="ch5"></a>

## પ્રકરણ 5 — mastery check

1. બંને સામાન્ય `tool/result` (`isError: true`) બને છે; step નિષ્ફળ થતો નથી, તેથી step 2 model ને સુધારવાની તક આપે છે. 🧪
2. Retryable codes: `RATE_LIMIT`, `SERVER`, `TIMEOUT`, `TRANSPORT`, empty response — `AUTH` નથી ([retry-policy.ts](https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/llm/llm/src/retry-policy.ts#L14-L24)). ✅🧪
3. Launcher નું `process.on('SIGINT', () => interrupt(130))` (`runProfile`). `turn/end` loop ના `finally` માં લખાય છે, cancellation પછી પણ. ✅🧪
4. Design: "Reads pass through untouched: every mode permits reading" અને "This is containment, not a security boundary" (`dsh-fs-sandbox`). ✅🧪
5. Headless માં approval answerer નથી; outcome `unavailable` → "requires approval, but no approval channel is available" (fail closed). 🧪
6. `volatile()` config field restart/remount વગર બદલાય છે (Loader નું volatile update path; vendor V22). ✅

---

<a id="lab-6"></a>

## Lab 6 — આગાહી: metrics + `csv_compare`

**જવાબ 🧪** ([evidence/measure-csv.jsonl](../evidence/measure-csv.jsonl), 3 runs): `modelCalls` 2, `toolCalls` 1, `csv_compare` 9.66 / 13.39 / 10.29 ms — `read` (8.3–11.4 ms) જેટલું જ. બે નાની files parallel (`Promise.all`) માં વંચાય છે અને parse નાનું છે; 3 samples પરથી "વધુ/ઓછું" કહી શકાય નહીં. ⚠️

<a id="ch6"></a>

## પ્રકરણ 6 — mastery check

1. Config: `session-title-llm` disable. Plugin: `metrics.ts`, `csv_compare`. Core patch: headless teardown fix. 🧪
2. Around-dispatch: tool body અને અંદરના wrappers; `tools/pre-execute` policy, approval, guards, post-execute નહીં. ✅
3. વધુ samples; CPU profile; mock ને બીજા process/machine પર (અથવા real provider) — અને બીજા variables સ્થિર. ⚠️
4. Fiber state એ **runner plugin** નું lifetime છે; `signal` એ Agent ના turn નું. User ફક્ત turn cancel કરે અને app ચાલુ રહે, ત્યારે runner એ report કરવું જ જોઈએ; ફક્ત tree teardown માં report launcher નો છે. ⚠️ (design તર્ક)
5. Test fix ને જ પકડે છે તેનો એકમાત્ર પુરાવો; નહીં તો test કંઈ પણ સાબિત ન કરે. 🧪
6. SIGINT પર terminal JSON line હવે નથી (પહેલાં ભ્રામક `error`). વિકલ્પ: `{"type":"interrupted"}` terminal event — additive, docs + tests સાથે અલગ PR. ⚠️

---

<a id="lab-7"></a>

## Lab 7 — આગાહી: `window_days: 0`

**જવાબ 🧪:** matched 3 (bank L2↔L2 R1, L3↔L3 R1, **L5↔L5 R2**), ambiguous **0**, unmatched bank 2 (L4, L6), unmatched tally 4 (L4, L6, L7, L8); matched amount ₹18,749.50; unexplained −₹15,659.00. શીખ: window ઘટાડતાં ambiguous (Desai/Rana) match બન્યો — ફક્ત Desai એ જ દિવસે — અને 1 દિવસ અલગ Mehta બે unmatched બન્યા. Window એ business નિર્ણય છે, "વધુ સાચું" નહીં.

<a id="ch7"></a>

## પ્રકરણ 7 — walkthrough અને mastery check

**Walkthrough (7.6):**

1. Regex `^(\d+)(?:\.(\d{1,2}))?$` commas કાઢ્યા પછી; `Number(rupees) * 100 + Number(decimals.padEnd(2,'0'))` — integer arithmetic; `Number.isSafeInteger` check. ✅
2. Uppercase: description case-insensitive duplicate શોધ. Balance બાકાત: duplicate rows નું running balance જુદું હોય (fixture L7/L8: 1,29,090.50 vs 1,35,190.50). ✅
3. `components(bank, tally, linked)` predicate લે છે; R1 નું predicate reference+amount, R2 નું amount+window. ✅
4. Bank line `n` ને `2n` અને Tally ને `2n+1` — એક જ total order, collision વગર, bank પહેલાં. ✅
5. `COLUMN_COUNT` rows `table.rows` માં નથી પણ file ની physical data rows છે; totals file ને પ્રતિબિંબિત કરે. ✅

**Mastery check:**

1. Bank: credit = in; Tally bank ledger: debit = in. `normalizeRow` નો `sign` (bank `+1`, Tally `−1`) × `(credit − debit)`. ✅
2. Input ક્રમ પર આધાર ("first-come"). Test: "two bank rows competing for one Tally row are ambiguous, not first-come". 🧪
3. Report માં દરેક input row નો હિસાબ રહે છે ("every input row appears in exactly one result" test); ચૂપચાપ skip ખોટો "બધું મેળ ખાય છે" દેખાવ આપે. 🧪
4. Read-only ની ખાતરી type level પર; provider ગમે તે હોય, consumer લખી જ ન શકે; review સરળ. ⚠️ (design)
5. કોઈ fixture/test માં એ જ રકમ, ઊંધી દિશા, window ની અંદર — એવી જોડ નહોતી. 🧪

<a id="challenge"></a>

## Debugging challenge — સમજૂતી

**Bug:** R2 predicate `b.amount === t.amount` ને બદલે `Math.abs(b.amount) === Math.abs(t.amount)` — money-in અને money-out સરખી રકમ હોય તો match. 🧪 Bug સાથે 10/10 tests pass; solution test `sign.test.ts` bug સાથે `actual: ['matched']` (fail), fix સાથે pass.

**શીખ:** tests rules પરથી લખો, ફક્ત fixtures પરથી નહીં — દરેક rule ની દરેક શરત (amount, **sign**, window, uniqueness) માટે એક negative case. Repository ની devDependencies માં `fast-check` છે; property-based test ("કોઈ match માં બંને amounts નું sign સરખું હોય") આ વર્ગની ભૂલ આપોઆપ શોધે. ⚠️ (અમે property test લખ્યો નથી.)
