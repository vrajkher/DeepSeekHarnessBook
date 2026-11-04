# પરિશિષ્ટ E — Mastery rubric

"Top 1% developer" એ લક્ષ્ય છે, માપ નથી. આ rubric તેને **અવલોકી શકાય તેવી કુશળતા** માં ફેરવે છે. દરેક પંક્તિ માટે પુરાવો — link, command output, test, કે diagram — જરૂરી છે. ફક્ત "મને ખબર છે" ગણાય નહીં.

## સ્તર

| સ્કોર | નામ | અર્થ |
|---|---|---|
| 0 | શરૂઆત | મદદ વગર કરી શકતા નથી |
| 1 | માર્ગદર્શિત | પુસ્તક ખુલ્લું રાખી કરી શકો |
| 2 | સ્વતંત્ર | મદદ વગર, pinned commit પર |
| 3 | Maintainer | બીજી commit પર પણ, ફેરફાર ઓળખી, બીજાને સમજાવી શકો |

## Dimensions

| # | કુશળતા | 2 (સ્વતંત્ર) માટે પુરાવો | 3 (maintainer) માટે વધારાનો પુરાવો | પ્રકરણ |
|---|---|---|---|---|
| 1 | Setup અને pin | clone, pin, install, build — output સાથે; pin ચકાસો | નવા commit પર setup ના ફેરફારો શોધી નોંધો | 0 |
| 2 | Architecture સમજાવવું | 5 મિનિટમાં profile → bundle → rows → services → loop સમજાવો, links સાથે | Cordis vs Harness ની સીમા ખોટી હોય તેવું ઉદાહરણ ઓળખો | 2 |
| 3 | Request trace | README ઉદાહરણનો sequence diagram, દરેક node નો file/symbol, trace output સાથે | ત્રીજો (title) call અને retries diagram માં ઉમેરો | 1 |
| 4 | Stored vs streamed | stored log અને live frames ની યાદી, `print-session` output સાથે | resume પછી history કેમ સાચી રહે છે તે source થી બતાવો | 1, 3 |
| 5 | Plugin બનાવવો | config + tests + overlay + disable સાથેનો tool | plugin ને capability seam (Definition/Provider/Consumer) માં ફેરવો | 4, 7 |
| 6 | Failures diagnose | ચારેય failure class reproduce કરી, દરેકનો code અને source line | નવી failure (દા.ત. `max_tokens`) જાતે reproduce કરી સમજાવો | 5 |
| 7 | Permissions | પાંચ sandbox પ્રયોગ, fail-closed અને "reads open" પુરાવા સાથે | deployment માટે threat model લખો (SAFETY.md આધારિત) | 5 |
| 8 | Measurement | metrics plugin, 5+ runs, median, અને મર્યાદાઓ | profiler થી latency નું કારણ સાબિત કે ખોટું કરો | 6 |
| 9 | Contribution | problem → repro → root cause → patch → regression test (fail/pass) → review notes | upstream conventions (snapshot, PR description, labels) સાથે PR તૈયાર | 6 |
| 10 | Final project | reconciliation golden report, invariant test, debugging challenge નો solution test | Tally connector seam નું interface + fake provider + tests | 7 |

## પાસ થવાના નિયમ

- **Level 7 પૂર્ણ:** બધી 10 dimensions માં ઓછામાં ઓછું 2, અને 5, 6, 9 માં 3.
- કોઈ dimension માં 0 હોય તો આગળના પ્રકરણ પર જતાં પહેલાં તે પ્રકરણનો lab ફરી કરો.

## Self-check checklist (પરીક્ષા પહેલાં)

- [ ] `git log -1` pinned SHA બતાવે છે.
- [ ] `run-mock.sh` બે `llm/stream` calls અને `turn/end completed` બતાવે છે.
- [ ] `--dump-config` માં 101 rows; `tools`, `agent-loop`, `fs-sandbox` નું મૂળ layer ખબર છે.
- [ ] Labs: `tests 20, pass 20`; `tsc` exit 0.
- [ ] Contribution patch: test patch વગર fail, સાથે pass.
- [ ] Reconciliation golden report હાથથી ગણેલી totals સાથે મેળ ખાય છે.
- [ ] Debugging challenge માટેનો test bug સાથે fail થાય છે.

## Evaluator માટે સૂચના

જવાબ "બરાબર" છે કે નહીં તે આ પુસ્તકના અમારા outputs સાથે સરખાવીને નહીં, પણ **reproducible પુરાવા** થી નક્કી કરો. Timing જુદી પડે (machine ભિન્ન), પણ counts, codes, events ના પ્રકાર અને ક્રમ, અને golden report સરખાં હોવાં જોઈએ.
