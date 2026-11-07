# વાર્તા આવૃત્તિ — "હાર્નેસ ભોજનાલય"

ધોરણ 12 ના વિદ્યાર્થી માટે DeepSeek Harness, એક ચાલુ વાર્તા તરીકે. દરેક દ્રશ્યમાં પાંચ ભાગ છે: **કથા** (વાર્તા), **ટેકનિકલ નામ** (સાચો શબ્દ), **ક્યાં** (file અને symbol), **કેવી રીતે** (code શું કરે), અને **શા માટે** (design નું કારણ). સાથે "ઉપમા ક્યાં તૂટે છે" અને "Expert નજર" boxes છે.

વાર્તા સરળ છે, પણ ટેકનિકલ ચોકસાઈ મુખ્ય પુસ્તક જેટલી જ છે: દરેક દ્રશ્ય pinned commit `fcc0ad4` ના code અને અમે ચલાવેલા run ના ચોપડા (session log) સાથે જોડાયેલું છે.

| વાર્તા | વિષય | મુખ્ય પુસ્તકમાં ઊંડા જાઓ |
|---|---|---|
| [1 — "હાર્નેસ ભોજનાલય"નો પહેલો દિવસ](01-bhojanalay-no-pehlo-divas.md) | આખું harness એક દિવસમાં: startup, ઓર્ડર, બે model calls, `read` tool, ચોપડો | [0](../book/00-paayo-ane-pratham-run.md), [1](../book/01-request-ni-musafari.md), [2](../book/02-cordis-plugin-architecture.md) |
| [2 — HR મેનેજરની ડાયરી](02-hr-manager-ni-diary.md) | Cordis: ચિઠ્ઠીઓનો ક્રમ (layers), `--dump-config`, services, `inject`, fiber states, effects, events, startup audit, scope | [2](../book/02-cordis-plugin-architecture.md) |
| [3 — કોઠાર, દુભાષિયો અને ચોપડો અંદરથી](03-kothar-dubhashiyo-chopdo.md) | capability seam, `read` tool, ત્રણ ભૂલ, pipeline, adapter wire, `StreamChunk`, session append/surface, persistence, resume | [3](../book/03-tools-sessions-adapters.md) |
| [4 — પહેલી ભરતી](04-paheli-bharti.md) | પોતાનો tool: `greet`, `csv_compare`, deterministic નિયમો, tests, overlay, fail loud, disable | [4](../book/04-potano-plugin.md) |
| [5 — કટોકટીનો દિવસ](05-katokati-no-divas.md) | unknown tool, invalid args, provider errors અને retry, SIGINT, sandbox, approval, data boundary, concurrency | [5](../book/05-debugging-permissions-reliability.md) |
| [6 — ભોજનાલયમાં સુધારો](06-bhojanalay-ma-sudharo.md) | config vs plugin vs core, metrics માપ, headless teardown contribution, regression test, review notes | [6](../book/06-maintainer-architecture.md) |
| [7 — સાંજનો હિસાબ](07-sanj-no-hisab.md) | bank–Tally reconciliation, નિયમ V1–U1, golden report, debugging challenge, connector design, **અંત-થી-અંત નકશો**, mastery પરીક્ષા | [7](../book/07-antim-project-mastery.md) |

આગળની વાર્તાઓ (આયોજન): 2 HR મેનેજરની ડાયરી (Cordis) · 3 કોઠાર, દુભાષિયો અને ચોપડો અંદરથી · 4 પહેલી ભરતી (પોતાનો tool) · 5 કટોકટીનો દિવસ (failures, sandbox) · 6 ભોજનાલયમાં સુધારો (contribution) · 7 સાંજનો હિસાબ (reconciliation).

**હવે સાતેય વાર્તા તૈયાર છે.** ઉપરનું આયોજન પૂર્ણ થયું. ક્રમ: 1 → 2 → … → 7; વાર્તા 7 ના અંતે આખા ભોજનાલયનો **અંત-થી-અંત નકશો** છે, જે સાતેય વાર્તાને એક request ની સફરમાં જોડે છે.

## રંગોની ચાવી (artifact આવૃત્તિમાં)

Published artifact માં દરેક ભાગનું લેબલ પોતાના રંગમાં દેખાય છે, જેથી નજર તરત ઓળખે કે આ વાર્તા છે કે ટેકનિકલ સત્ય:

| લેબલ | રંગ | અર્થ |
|---|---|---|
| **કથા** | નારંગી | વાર્તાનો ભાગ |
| **ટેકનિકલ નામ** | વાદળી | સાચો શબ્દ |
| **ક્યાં** | ટીલ (લીલો-વાદળી) | file અને symbol |
| **કેવી રીતે** | જાંબલી | code શું કરે |
| **શા માટે** | લીલો | design નું કારણ |
| **ઉપમા ક્યાં તૂટે છે** | લાલ | વાર્તાની મર્યાદા |
| **Expert નજર** | સોનેરી | ઊંડી વિગત |
| **ચોપડામાં / Terminal માં** | રાખોડી | ચલાવેલો પુરાવો |
| **યાદ-ચાવી** | ગુલાબી | યાદ રાખવાની રીત |
