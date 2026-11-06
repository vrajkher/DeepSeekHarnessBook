# DeepSeek Harness: કોલેજથી Expert Developer સુધી

એક ગુજરાતી પુસ્તક, જે software ચલાવીને, સાચો code trace કરીને, વર્તન બદલીને અને પરિણામ ચકાસીને શીખવે છે.

- **વિષય:** [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) — Cordis પર બનેલું "everything-is-a-plugin" agent harness.
- **Pinned commit:** [`fcc0ad4`](https://github.com/deepseek-ai/deepseek-harness/tree/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159) (`master`, version 0.2.2-rc.1, 2026-11-04). દરેક source link આ commit પર pinned છે.
- **વાચક:** basic programming જાણતો college graduate, જેણે ક્યારેય agent harness બનાવ્યું કે બદલ્યું નથી.
- **API key જરૂરી નથી.** બધી labs repository ના keyless mock provider સાથે ચાલે છે.

> **Verification marks:** ✅ pinned source વાંચીને ચકાસ્યું · 🧪 આ પુસ્તક લખતી વખતે ચલાવીને ચકાસ્યું · ⚠️ ચકાસ્યું નથી.
> Repository ની [SAFETY.md](https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/SAFETY.md) પહેલાં વાંચો: આ developer-preview software model-generated commands ચલાવી શકે છે.

## "Top 1%" નો અર્થ આ પુસ્તકમાં

લક્ષ્ય તરીકે "world top 1% developer"; માપ તરીકે અવલોકી શકાય તેવી કુશળતા: architecture સમજાવવું, request ને source માં trace કરવું, plugin બનાવવો, failures diagnose કરવી, વર્તન માપવું, અને સ્પષ્ટ design rationale સાથે well-tested ફેરફાર રજૂ કરવો. વિગત: [mastery rubric](appendix/E-mastery-rubric.md).

## વિષયસૂચિ

> **નવું:** દરેક પ્રકરણના અંતે **"સરળ સમજ"** વિભાગ છે — સાદી ગુજરાતી, ભોજનાલયની ઉપમા, નવા ટેકનિકલ શબ્દોની સમજ, યાદ રાખવાની રીતો અને પુનરાવર્તન કાર્ડ. શરૂઆત [સમગ્ર નકશો](book/overview-samagra-naksho.md) થી કરો.

| Level | પ્રકરણ | મુખ્ય lab |
|---|---|---|
| — | **[સમગ્ર નકશો — આખું પુસ્તક એક નજરે](book/overview-samagra-naksho.md)** (પહેલાં આ વાંચો) | આઠ પ્રકરણોનું જોડાણ, એક ઉપમા, યાદ-ચાવીઓ |
| 0 | [પાયો અને પ્રથમ run](book/00-paayo-ane-pratham-run.md) | key વગર પહેલો Cordis plugin |
| 1 | [એક requestની આખી મુસાફરી](book/01-request-ni-musafari.md) | README ઉદાહરણ: 2 model calls, `read` tool, દરેક event |
| 2 | [Cordis અને plugin architecture](book/02-cordis-plugin-architecture.md) | `--dump-config`, ખૂટતી service, tutorial race |
| 3 | [Tools, sessions અને model adapters](book/03-tools-sessions-adapters.md) | `read` tool અંદરથી, wire capture, interrupted session resume |
| 4 | [પોતાનો plugin બનાવો](book/04-potano-plugin.md) | `greet` ફેરફાર, read-only `csv_compare` tool |
| 5 | [Debugging, permissions અને reliability](book/05-debugging-permissions-reliability.md) | ચાર failures, પાંચ sandbox પ્રયોગ |
| 6 | [Maintainer અને architecture level](book/06-maintainer-architecture.md) | metrics, headless teardown contribution |
| 7 | [અંતિમ પ્રોજેક્ટ અને mastery પરીક્ષા](book/07-antim-project-mastery.md) | bank ↔ Tally reconciliation, debugging challenge |

### પરિશિષ્ટ

- [A — Source index](appendix/A-source-index.md) (પૂર્ણ generated table: [citations.generated.md](appendix/citations.generated.md))
- [B — Command reference](appendix/B-command-reference.md)
- [C — ગુજરાતી–English glossary](appendix/C-glossary.md)
- [D — Lab solutions અને mastery check જવાબો](appendix/D-lab-solutions.md)
- [E — Mastery rubric](appendix/E-mastery-rubric.md)
- [F — Coverage map](appendix/F-coverage-map.md)
- [G — Verification log](appendix/G-verification-log.md) (environment, workarounds, docs-vs-code તફાવતો)
- [H — Chapter status અને resume notes](appendix/H-status.md)

## દરેક પ્રકરણનું માળખું

1. આ પ્રકરણ પછી તમે શું કરી શકશો.
2. English technical terms સાથે સરળ ગુજરાતી સમજ.
3. Source map: ક્રમમાં ખોલવાના pinned links અને symbols.
4. Input, output અને side effects સમજાવતા ટૂંકા code excerpts — **repository code**, **teaching pseudocode**, અને **book lab code** હંમેશા અલગ લખેલા.
5. Commands અને અપેક્ષિત અવલોકનો સાથે એક reproducible lab.
6. જવાબ જાહેર થાય તે પહેલાંની એક આગાહી કસોટી.
7. એક failure case અને તેનું ટૂંકું નિદાન.
8. Mastery check — જવાબો [પરિશિષ્ટ D](appendix/D-lab-solutions.md) માં અલગ.

## Repository layout (આ પુસ્તકનું)

| Folder | શું છે |
|---|---|
| `book/` | પ્રકરણ 0–7 |
| `appendix/` | પરિશિષ્ટ A–H અને generated citation table |
| `labs/` | પુસ્તક-માલિકીનો code (upstream નહીં): plugins, tests, fixtures, scripts — [labs/README.md](labs/README.md) |
| `evidence/` | આ પુસ્તક માટે ચલાવેલા runs નાં sanitized outputs |
| `tools/` | citations generator, reference-link writer, book verifier |

## Labs ઝડપથી શરૂ કરો

```bash
git clone https://github.com/deepseek-ai/deepseek-harness.git && cd deepseek-harness
```

```bash
git checkout --detach fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159 && corepack enable && pnpm install && pnpm run build
```

```bash
cp -r <this-book>/labs tmp/book-labs && bash tmp/book-labs/request-trace/run-mock.sh
```

અપેક્ષિત છેલ્લી stdout line: `README નો સાર: DeepSeek Harness એ plugin આધારિત agent harness છે.` (mock provider નો scripted text).

## License

આ પુસ્તકનો text અને `labs/` નો code આ repository ના [LICENSE](LICENSE) હેઠળ છે. DeepSeek Harness ના quoted excerpts અને `labs/cordis-basics/tool-logger.ts` upstream MIT license હેઠળ છે.
