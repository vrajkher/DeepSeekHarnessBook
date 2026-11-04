# પરિશિષ્ટ H — Chapter status અને resume notes

"Verified" એટલે: પ્રકરણના દરેક command અને output આ પુસ્તક લખતી વખતે pinned commit પર ચલાવ્યા છે (અથવા ⚠️ ચિહ્ન સાથે સ્પષ્ટ લખ્યું છે કે નથી ચલાવ્યા), દરેક source link [`tools/citations.py`](../tools/citations.py) થી બન્યો છે, અને [`tools/verify_book.py`](../tools/verify_book.py) pass થાય છે.

| પ્રકરણ | Draft | Verified | ⚠️ બાકી |
|---|---|---|---|
| 0 પાયો અને પ્રથમ run | ✔ | ✔ | Windows + WSL2 path |
| 1 એક requestની મુસાફરી | ✔ | ✔ | real provider |
| 2 Cordis અને plugin architecture | ✔ | ✔ | upstream Cordis repository નું અલગ inspection |
| 3 Tools, sessions, adapters | ✔ | ✔ | — |
| 4 પોતાનો plugin | ✔ | ✔ | — |
| 5 Debugging, permissions, reliability | ✔ | ✔ | interactive debugger; kernel sandbox enforcement |
| 6 Maintainer અને architecture | ✔ | ✔ | latency કારણનું profiling |
| 7 અંતિમ પ્રોજેક્ટ | ✔ | ✔ | Tally connector (extension design જ) |
| પરિશિષ્ટ A–H | ✔ | ✔ | — |

## Resume notes (નવી session માટે)

- **Pinned source:** `git worktree add --detach <dir> fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159` — line numbers આ tree પરથી જ.
- **Citations ફરી બનાવવા:** `python3 tools/citations.py <dir> > appendix/citations.generated.md` અને પછી `python3 tools/refdefs.py book/*.md appendix/*.md`.
- **નવો commit pin કરવો હોય તો:** `tools/citations.py` માં `SHA` બદલો, generator ચલાવો — જે pattern ન મળે તે નિષ્ફળ થશે, અને એ જ પ્રકરણો ફરી ચકાસવાનાં છે. પછી બધા labs (`run-mock.sh` runs, tests) ફરી ચલાવી `evidence/` બદલો.
- **આગળ લખવા જેવા વિષયો** (coverage map ના ○): compaction, subagents, MCP, PTC executor, Web UI/Typert remote API, SDK/ACP.
