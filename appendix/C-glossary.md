# પરિશિષ્ટ C — ગુજરાતી–English glossary

દરેક term નો પહેલો ઉપયોગ જે પ્રકરણમાં થયો છે તે છેલ્લી column માં છે. Code identifiers હંમેશા English માં જ રહે છે.

| English term | ગુજરાતી અર્થ | નક્કર ઉદાહરણ | પ્રકરણ |
|---|---|---|---|
| AI model | text/tool call બનાવતું ગણિતીય મોડેલ | `deepseek-flash` | 0 |
| Model provider | model ને HTTP API દ્વારા ઉપલબ્ધ કરાવતી સેવા | DeepSeek official API | 0 |
| Agent | model ↔ tools નો loop, કામ પૂરું થાય ત્યાં સુધી | `ReactLoopAgent` | 0 |
| Harness | agent ચલાવવાનું આખું તંત્ર | `dsh` | 0 |
| Plugin | service/tool/listener ઉમેરતો, unload પર પાછો ખેંચાતો ભાગ | `@deepseek-ai/dsh-tool-fs` | 0 |
| Commit / SHA | Git ઇતિહાસનું નામવાળું snapshot | `fcc0ad4…` | 0 |
| Workspace (pnpm) | એક repository માં ઘણાં packages | `packages/<group>/<pkg>` | 0 |
| Corepack | `packageManager` મુજબ સાચો pnpm લાવતું tool | `corepack enable` | 0 |
| Type stripping / tsx | TypeScript ને build વગર ચલાવવું | `node --import tsx …` | 0 |
| Declaration merging | બીજા package ના interface માં fields ઉમેરવા | `ctx.tools` ના types | 0 |
| Discriminated union | `kind`/`type` field થી આકાર નક્કી થતો union | `{ kind: 'enter' } \| { kind: 'reject' }` | 0 |
| AbortSignal | ચાલુ કામ રદ કરવાનો signal | `signal.throwIfAborted()` | 0 |
| Turn | user input થી "કંઈ બાકી નથી" સુધીનું કામ | README ઉદાહરણ = 1 turn | 1 |
| Step | એક model request + તેના tools | README ઉદાહરણ = 2 steps | 1 |
| Inbox | agent ને મળેલા, હજી claim ન થયેલા messages | `agent.followup(...)` | 1 |
| Session log | append-only events ની ટકાઉ યાદી | `session.v4.jsonl.zstd` | 1 |
| Session event | log માં લખાતી એક હકીકત | `tool/call`, `turn/end` | 1 |
| Live event | ફક્ત process માં, log માં નહીં | `agent/assistant-stream` | 1 |
| Waterfall | `next()` વાળી middleware જેવી listener સાંકળ | `agent/pre-step`, `llm/stream` | 1 |
| Request header | log માં provider/model/tools ની નોંધ | `request/header reason=initial` | 1 |
| Mock provider | key વગર scripted જવાબ આપતો server | `dsh-llm-mock-server` | 1 |
| Startup | process શરૂ થતાં plugin tree બનવું | `boot()` | 2 |
| Profile | bundles + user patch નું નામવાળું composition | `headless` | 2 |
| Bundle | config rows + code નું વિતરણ સ્વરૂપ | `dsh-base` | 2 |
| Patch / overlay | row ને id થી બદલતી કે ઉમેરતી YAML | `--patch overlay.yml` | 2 |
| Context | services રાખતો Cordis object | `ctx` | 2 |
| Service | context પર નામવાળી capability | `ctx.tools` | 2 |
| Dependency Injection | plugin ને જરૂરી service runtime દ્વારા મળવી | `inject = ['tools']` | 2 |
| Effect | undo કરી શકાય તેવી નોંધણી | `ctx.tools.register(...)` disposer | 2 |
| Fiber | mounted plugin નું runtime અને lifecycle | `PENDING`, `ACTIVE`, `FAILED` | 2 |
| Pending entry | જરૂરી service ની રાહ જોતી row | `waiting for service: fs` | 2 |
| Required entry | inactive હોય તો startup નિષ્ફળ | `agent-loop` | 2 |
| Scope | registrations ને agent identity સાથે tag કરતો context | `createScope` | 2 |
| Race condition | પરિણામ ચાલવાના ક્રમ પર આધાર રાખે | tutorial ch.7 executor | 2 |
| Capability seam | Definition + Provider + Consumer વાળી બદલી શકાય તેવી capability | `ctx.fs` | 3 |
| Tool executor | tool batch ચલાવતો provider | `NativeToolExecutor` | 3 |
| Tool pipeline | pre-execute → guards → execute → post-execute | `ToolExecutionPipeline` | 3 |
| Canonical value | tool નું structured સાચું પરિણામ | `{path, lines, totalLines}` | 3 |
| Adapter | harness અને provider wire format વચ્ચેનો અનુવાદક | `DeepSeekAdapter` | 3 |
| SSE (Server-Sent Events) | HTTP પર એક-દિશાનો event stream | `data: {...}` lines | 3 |
| StreamChunk | provider-neutral stream ટુકડો | `text-delta`, `finish` | 3 |
| Request extension | provider-specific વધારાનો body field | `dsh_session_log` | 3 |
| Surface | model history બનાવતા log nodes | `user/message`, `tool/result` | 3 |
| Resume | persisted session માં નવો turn | `--session-id` | 3 |
| Config schema | config ને validate કરતું schema | `z.natural().default(...)` | 4 |
| Fail loud | ખોટી config/state તરત, સ્પષ્ટ રીતે નિષ્ફળ | `ValidationError … $.maxBytes` | 4 |
| Deterministic | એ જ input → એ જ output | sorted report | 4 |
| Breakpoint | debugger ને line પર રોકવું | `--inspect-brk` | 5 |
| Retry / backoff | નિષ્ફળ request ને વધતા અંતરે ફરી મોકલવો | 0.5 s → 1 s → 2 s … | 5 |
| Sandbox mode | side effects ની મર્યાદા | `workspace-write` | 5 |
| Approval policy | મંજૂરી પૂછવાની નીતિ | `ask` / `never` | 5 |
| Escalation | એક call માટે વધુ ખુલ્લો mode માંગવો | `sandbox_permissions` | 5 |
| Fail closed | નિયંત્રણ ન હોય ત્યારે નકારવું | bash without `bwrap` | 5 |
| Concurrency-safe | બીજા calls સાથે parallel ચાલી શકે | `isConcurrencySafe: () => true` | 5 |
| Regression test | ભૂલ પાછી ન આવે તેની ખાતરી કરતો test | `teardown-flush.spec.ts` | 6 |
| Golden file | અપેક્ષિત output ની સ્થિર નકલ | `expected-report.txt` | 7 |
| Bank reconciliation | bank statement અને ચોપડાની entries જોડવી | `reconcile_bank_tally` | 7 |
| Paise | રકમનો integer એકમ (₹1 = 100 paise) | `12345650` = ₹1,23,456.50 | 7 |
| Connected component | graph માં એકબીજા સાથે જોડાયેલા nodes નું જૂથ | ambiguous group | 7 |
| Property-based test | ઘણાં random inputs પર નિયમ ચકાસતો test | `fast-check` | 7 |
