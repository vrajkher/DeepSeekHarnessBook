# પ્રકરણ 4 — પોતાનો plugin બનાવો

> 🧭 **નવું:** આ પ્રકરણ અઘરું લાગે તો પહેલાં નીચેનો [સરળ સમજ](#saral-samaj) વિભાગ વાંચો (ઉપમા, નવા શબ્દો, યાદ રાખવાની રીતો). આખા પુસ્તકનો નકશો: [સમગ્ર નકશો](overview-samagra-naksho.md).

> **Level 4.** પહેલાં repository ના ચકાસેલા `greet` tutorial example માં સૌથી નાનો ઉપયોગી ફેરફાર કરીએ.
> પછી એક read-only `csv_compare` tool બનાવીએ, જે બે CSV export સરખાવી matched અને unmatched records આપે — deterministic નિયમો સાથે.

## આ પ્રકરણ પછી તમે શું કરી શકશો

- `defineTool` થી schema-validated tool બનાવી, `Config` schema થી તેને configurable બનાવી શકશો.
- Absolute-path overlay વડે local plugin ને `dsh` માં insert, configure અને disable કરી શકશો.
- Pure logic (CSV parse, compare) ને harness-wiring થી અલગ રાખી, બંને માટે અલગ tests લખી શકશો.
- Determinism ના નિયમો — sorting, duplicates પર guess નહીં, line numbers — લાગુ કરી શકશો.

## 4.1 સરળ સમજ: tool plugin ના ચાર ભાગ

| ભાગ | પ્રશ્ન | `csv_compare` માં |
|---|---|---|
| `inject` | કઈ services વગર ચાલી ન શકે? | `['tools', 'fs']` |
| `Config` | deployment શું બદલી શકે? | `toolName`, `maxBytes` |
| `parameters` | model શું મોકલે? | `left_path`, `right_path`, `key_columns`, `compare_columns?` |
| `output` | canonical value શું, અને model ને text કેવું? | JSON report → `renderReport` text |

**Canonical value** એટલે tool નું સાચું, structured પરિણામ, જે log અને UI માટે રહે; **rendered content** એ model ને દેખાતું text છે. ઉદાહરણ: `read` નું canonical value `{path, lines, totalLines}`, rendered `1: # DeepSeek Harness…` (પ્રકરણ 3).

Repository ના બે નિયમ અહીં સીધા લાગુ પડે છે ([AGENTS.md][agents-conventions]): **No hardcoded tunables in plugins** — deployment પ્રમાણે બદલાતી પસંદગી validated `Config` field હોવી જોઈએ; **Misconfiguration fails loud** — ખોટી config load વખતે જ દેખાવી જોઈએ. ✅

## 4.2 ભાગ A: ચકાસેલા example માં સૌથી નાનો ફેરફાર

Repository ની user guide માં `greet` tool છે ([docs/user/develop/basic/tool.md](https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/docs/user/develop/basic/tool.md)). અમે તેમાં **બે** ફેરફાર કર્યા ([labs/greet/greet.ts](../labs/greet/greet.ts), book lab code):

```ts
// change 1: a schema-validated config with a default
export const Config: z<Config> = z.object({
  greeting: z.string().default('નમસ્તે'),
})

export function apply(ctx: Context, config: Config) {
  ctx.tools.register(defineTool({
    …
    async execute(args) {
      return `${config.greeting}, ${args.name}!` // change 2: use the config value
    },
  }))
}
```

**Overlay** (absolute path ફરજિયાત; પ્રકરણ 2.2). `make-overlay.sh` આ લખે છે:

```yaml
- insert:
    - id: book-greet
      name: '/abs/path/to/tmp/book-labs/greet/greet.ts'
      config:
        greeting: 'કેમ છો'
```

**ચલાવો** (mock model `greet` tool call કરશે):

```bash
O=$(GREETING='કેમ છો' bash tmp/book-labs/greet/make-overlay.sh)
```

```bash
TOOL_NAME=greet TOOL_ARGS='{"name":"Ada"}' SUCCESS_TEXT=done EXTRA_PATCH=$O TASK='Use the greet tool to greet Ada.' bash tmp/book-labs/request-trace/run-mock.sh
```

🧪 Stored `tool/result` text: config વગર `"નમસ્તે, Ada!"`, `greeting: 'કેમ છો'` સાથે `"કેમ છો, Ada!"`; બંને exit 0 ([evidence/greet.err](../evidence/greet.err)).

## 4.3 ભાગ B: `csv_compare` — નિયમો પહેલાં, code પછી

Deterministic એટલે: એ જ input → byte-identical output, અને કોઈ નિર્ણય "અનુમાન" થી નહીં. નિયમો ([labs/csv-inspect/src/compare.ts](../labs/csv-inspect/src/compare.ts)):

1. **Key** = key columns ની trimmed values, U+001F થી જોડેલી.
2. કોઈ પણ બાજુ એક key **એકથી વધુ વાર** આવે તો તે **duplicate**: તેની એક પણ row match નહીં થાય, કારણ કે એક પસંદ કરવી એ guess છે. Group માં **બંને બાજુની** એ key ની lines રહે છે, જેથી સામેની બાજુની એકલી row પણ report માંથી ગાયબ ન થાય.
3. બંને બાજુ બરાબર એક વાર હોય તો **matched**; compare columns સરખા હોય તો identical, નહીં તો differences ની યાદી.
4. બાકીની rows તેમની બાજુએ **unmatched**.
5. ખરાબ row (field count ખોટો, quote બંધ નથી) parser **problem** તરીકે line number સાથે report કરે છે. Header માં ખાલી કે પુનરાવર્તિત column name હોય તો **દરેક** data row `INVALID_HEADER` તરીકે નકારાય છે — નહીં તો એક column ની value બીજીને ચૂપચાપ overwrite કરે.
6. બધી output arrays key, પછી line પ્રમાણે sorted.

**Parser** ([labs/csv-inspect/src/csv.ts](../labs/csv-inspect/src/csv.ts)) RFC 4180 નો નાનો ભાગ સંભાળે છે: comma, double-quoted fields, quote ની અંદર `""`, LF/CRLF, અને UTF-8 BOM. તે ક્યારેય row "સુધારતો" નથી.

### Harness wiring (plugin)

[labs/csv-inspect/src/plugin.ts](../labs/csv-inspect/src/plugin.ts) માંથી મુખ્ય ભાગ:

```ts
export const inject = ['tools', 'fs']

export const Config: z<Config> = z.object({
  toolName: z.string().default('csv_compare'),
  maxBytes: z.natural().default(5 * 1024 * 1024),
})

async function readCsvFile(ctx: Context, exec: ToolExecution, path: string, maxBytes: number) {
  const target = await resolveForCall(ctx, exec, path)
  const info = await ctx.fs.stat(target, exec.signal)
  if (info === undefined) throw new Error(`cannot read "${path}": not found`)
  if (info.type !== 'file') throw new Error(`cannot read "${path}": not a regular file`)
  if (info.size !== undefined && info.size > maxBytes) { throw new Error(…) }
  return parseCsv(await ctx.fs.readText(target, exec.signal))
}
```

ત્રણ design નિર્ણયો:

- **Read-only, seam દ્વારા.** File `node:fs` થી નહીં, `ctx.fs` થી વાંચીએ છીએ. તેથી deployment નો filesystem provider (base માં `dsh-fs-sandbox`) path resolution અને policy નો માલિક રહે છે, અને tool કદી write કરતો નથી.
- **Session directory.** `workingDirectory` service હોય તો path ને session ની current directory માં resolve કરીએ છીએ — upstream `read` tool ની જેમ ([`resolveRegularReadTarget`][read-target]). `workingDirectory` ને `inject` માં ન મૂક્યું, કારણ કે unit test માં તે વગર પણ tool ચાલવો જોઈએ; તેથી `ctx.get('workingDirectory')` optional રીતે વાંચીએ છીએ.
- **`isConcurrencySafe: () => true`.** બે reads, કોઈ write નહીં; executor તેને બીજા read-only calls સાથે parallel ચલાવી શકે ([`executeToolBatch`][batch-execute] નું parallel group).

## Source map: આ ક્રમમાં ખોલો

| ક્રમ | File | Symbol | કેમ |
|---|---|---|---|
| 1 | `docs/user/develop/basic/tool.md` | `greet` | મૂળ ચકાસેલું example |
| 2 | `packages/core/tools/src/schema.ts` | [`defineTool` validation][schema-defineTool-validate] | args ક્યાં validate થાય છે |
| 3 | `packages/fs/tool-fs/src/read-target.ts` | [`resolveRegularReadTarget`][read-target] | path resolution નો upstream નમૂનો |
| 4 | `packages/core/tools/src/batch.ts` | [`executeToolBatch`][batch-execute] | concurrency-safe grouping |
| 5 | `vendor/cordis/src/fiber.ts` | config validation (`resolveConfig`) | ખોટી config ક્યાં પકડાય છે |
| 6 | `labs/csv-inspect/src/*.ts` | `parseCsv`, `compareTables`, `apply` | આપણો code |

## Lab 4 — tests, real turn, config failure, disable

**(1) Pure logic અને integration tests** (harness checkout ના `tmp/book-labs` થી):

```bash
node --import tsx --test csv-inspect/test/*.test.ts
```

🧪 `tests 13, pass 13, fail 0`. Integration test ([plugin.test.ts](../labs/csv-inspect/test/plugin.test.ts)) real `SystemPrompt`, `ToolRuntime`, `NativeToolExecutor`, `LocalFileSystem` plugins ને `await ctx.plugin(...)` થી ક્રમસર mount કરે છે — upstream testkit [`mountAgentLoopTestDependencies`][testkit-mount] ની જેમ — એટલે પ્રકરણ 2 નો race અહીં શક્ય નથી. છેલ્લો test સાબિત કરે છે કે plugin unload થતાં tool registry માંથી tool ગાયબ થાય છે.

**(2) Type check** (harness ની strict settings, built declarations સામે):

```bash
node --max-old-space-size=8192 ../../node_modules/typescript/bin/tsc -p tsconfig.json
```

🧪 exit 0. (ખાતરી માટે અમે જાણીજોઈને એક ખોટી file ઉમેરી — `TS2322` પકડાયો — પછી કાઢી નાખી.)

**(3) Real headless turn:**

```bash
C=$(bash tmp/book-labs/csv-inspect/make-overlay.sh)
```

```bash
TOOL_NAME=csv_compare TOOL_ARGS='{"left_path":"tmp/book-labs/csv-inspect/fixtures/export-a.csv","right_path":"tmp/book-labs/csv-inspect/fixtures/export-b.csv","key_columns":["Ref"]}' EXTRA_PATCH=$C TASK='આ બે CSV export સરખાવો.' bash tmp/book-labs/request-trace/run-mock.sh
```

🧪 exit 0. Model ને ગયેલું tool result ([evidence/csv.err](../evidence/csv.err) અને stored session):

```text
key: Ref; compared: Date, Party, Amount
left rows 5, right rows 4
identical 1, different 1, only-left 1, only-right 1, duplicate keys 1, problems 1
DIFF INV-1002 (left L3, right L3): Amount "8250.50"≠"8250.00"
ONLY-LEFT INV-1003 (L4)
ONLY-RIGHT INV-1005 (L5)
DUPLICATE INV-1004 (left L5, L6; right L4)
PROBLEM left L7 COLUMN_COUNT: expected 4 fields, found 3
```

દરેક line નું મૂળ fixture માં શોધો: `export-a.csv` ની line 7 માં ત્રણ જ fields છે, lines 5–6 એક જ key ધરાવે છે, અને `export-b.csv` ની line 4 એ જ key ની એકલી row છે — તે પણ duplicate group માં દેખાય છે. Test "every input data line appears in exactly one place in the report" આ હિસાબ ચકાસે છે.

**(4) ખોટી config — fail loud.** Overlay માં `maxBytes: -5`. 🧪 ([evidence/csv-badcfg.err](../evidence/csv-badcfg.err)):

```text
dsh: warning: 1 entry did not activate
book-csv-compare (file:///…/csv-inspect/src/plugin.ts): ValidationError: invalid config:
  - $.maxBytes expected number >= 0 but got -5 (at maxBytes)
```

`z.natural()` એ Cordis ના config resolution માં જ નિષ્ફળ થયું; tool register થયો જ નહીં. Required entry ન હોવાથી ફક્ત warning.

**(5) Disable કેવી રીતે કરવો.** ત્રણ રસ્તા, સૌથી નાનાથી:

1. Overlay ન આપો (`--patch` કાઢી નાખો).
2. બીજું overlay, row ને id થી disable કરે:

```yaml
- id: book-csv-compare
  disabled: true
```

3. કાયમ માટે: એ જ row profile ના `cordis.patch.yml` (`$DSH_HOME/profiles/<profile>/cordis.patch.yml`) માં.

🧪 રસ્તો 2 ચકાસ્યો: model એ `csv_compare` call કર્યું ત્યારે result `Error: unknown tool "csv_compare"`, code `UNKNOWN_TOOL` ([evidence/csv-disabled.err](../evidence/csv-disabled.err)).

## આગાહી કસોટી

`export-b.csv` માં `INV-1004` ને **બે વાર** (lines 4 અને 6) કરો, `export-a.csv` જેમ છે તેમ રાખો. **ચલાવતા પહેલાં લખો:** summary ની `duplicateKeys`, `onlyRight`, અને `duplicates` array ની entries (દરેક entry: `key`, `left`, `right`). પછી test માં assertion તરીકે લખી ચકાસો. જવાબ: [પરિશિષ્ટ D — Lab 4](../appendix/D-lab-solutions.md#lab-4).

## નિષ્ફળતા: "tool ચાલે છે, પણ path ખોટી જગ્યાએથી વાંચે છે"

**લક્ષણ.** Unit test માં `export-a.csv` મળે છે, પણ `dsh` turn માં `cannot read "export-a.csv": not found`.

**ટૂંકો નિદાન માર્ગ.**

1. Relative path કોની સામે resolve થાય છે? Test માં `LocalFileSystem { cwd: fixtures }`; `dsh` માં session ની working directory (અમારા runs માં harness checkout નું root).
2. `runtime-context` user message માં લખેલી "Current working directory" જુઓ (પ્રકરણ 1 નું `#10 user/message`).
3. Tool argument માં checkout-relative path આપો (`tmp/book-labs/...`), અથવા absolute path.

## Mastery check

1. `defineTool` એ `parameters` ને શું બનાવે છે, અને args ક્યાં validate થાય છે?
2. `csv_compare` duplicates ને match કેમ નથી કરતો? કયા વ્યવહારિક નુકસાનથી બચાવે છે?
3. `workingDirectory` ને `inject` માં ન મૂકવાનો trade-off શું છે?
4. Plugin unload થતાં tool registry માંથી tool કેમ ગાયબ થાય છે? કયો Cordis ખ્યાલ?
5. Config ખોટી હોય ત્યારે શું થાય છે, અને તે "fail loud" કેમ ગણાય?
6. Tool ને disable કરવાના ત્રણ રસ્તા લખો.

જવાબો: [પરિશિષ્ટ D — પ્રકરણ 4](../appendix/D-lab-solutions.md#ch4).

<a id="saral-samaj"></a>

## સરળ સમજ — પ્રકરણ 4 સાદી ગુજરાતીમાં

> આ વિભાગ નવો ઉમેરેલો છે; ઉપરનું પ્રકરણ જેમ હતું તેમ જ છે. આખો નકશો: [સમગ્ર નકશો](overview-samagra-naksho.md).

### એક વાક્યમાં

**પ્રકરણ 4 = પોતાનો કર્મચારી ભરતી કરવો: પહેલાં જૂના કર્મચારી (`greet`) ને નવી બોલી (configurable greeting) શીખવો, પછી નવો કર્મચારી (`csv_compare`) રાખો, જે બે યાદી સરખાવે — ક્યારેય અનુમાન વગર, ફક્ત વાંચીને, અને દરેક લીટીનો હિસાબ આપીને.**

### ભોજનાલયની ઉપમામાં

નવા કર્મચારીની ભરતી માટે ચાર વસ્તુ નક્કી કરવી પડે:

| ભરતીનો પ્રશ્ન | Plugin માં | `csv_compare` માં |
|---|---|---|
| કયાં સાધન વગર કામ ન કરી શકે? | `inject` | `['tools', 'fs']` |
| માલિક શું બદલી શકે? | `Config` | `toolName`, `maxBytes` |
| ગ્રાહક (model) શું કહી શકે? | `parameters` | `left_path`, `right_path`, `key_columns`, `compare_columns?` |
| કામનું પરિણામ શું, અને ગ્રાહકને શું કહેવું? | `output` (value + render) | JSON report + ટૂંકું text |

**ઉપમા ક્યાં તૂટે છે:** સાચો કર્મચારી શંકા પડે તો અનુમાન કરી લે. આપણો tool **ક્યારેય અનુમાન નથી કરતો**: duplicate key હોય તો match કરતો નથી, ખરાબ header હોય તો row સ્વીકારતો નથી — અને એ બધું report માં કારણ સાથે લખે છે.

### વિષય-વાર ઊંડી સમજ

#### (1) સૌથી નાનો ફેરફાર — `greet`

મૂળ tutorial નો `greet` tool "Hello, Ada!" આપે. અમે **બે** ફેરફાર કર્યા:

1. `Config` schema: `greeting: z.string().default('નમસ્તે')` — config ન આપો તો "નમસ્તે".
2. `execute` માં `config.greeting` વાપર્યું.

Overlay માં `greeting: 'કેમ છો'` આપો તો model ને "કેમ છો, Ada!" મળે. **શીખ:** deployment પ્રમાણે બદલાતી વસ્તુ code માં hardcode ન કરો; validated `Config` field બનાવો (repository નો નિયમ "No hardcoded tunables").

#### (2) Canonical value vs rendered content

- **Canonical value** = tool નું સાચું, structured પરિણામ (JSON report) — ચોપડા અને UI માટે.
- **Rendered content** = model ને દેખાતું ટૂંકું text (`identical 1, different 1, …`).

**ઉપમા:** canonical value = ગોદામનો પૂરો હિસાબ; rendered = ગ્રાહકને આપેલી નાની રસીદ.

#### (3) Deterministic નિયમો — "અનુમાન નહીં, હિસાબ પૂરો"

**Deterministic** એટલે એ જ input → હંમેશા byte-for-byte એ જ output. છ નિયમ:

1. **Key** = key columns ની trimmed values.
2. **Duplicate:** કોઈ પણ બાજુ key એકથી વધુ વાર → એક પણ row match નહીં; group માં **બંને બાજુની** lines (દા.ત. `DUPLICATE INV-1004 (left L5, L6; right L4)`).
3. **Matched:** બંને બાજુ બરાબર એક વાર → compare columns થી identical કે differences.
4. **Unmatched:** બાકીની rows પોતાની બાજુએ.
5. **Problem:** field count ખોટો, quote બંધ નહીં; header માં ખાલી/પુનરાવર્તિત નામ → દરેક data row `INVALID_HEADER`.
6. **Sorted:** બધું key, પછી line પ્રમાણે.

**છેલ્લી ખાતરી (invariant):** દરેક input data line report માં **બરાબર એક જ** જગ્યાએ દેખાય. આ માટે ખાસ test છે.

**યાદ-ચાવી "કી-ડુ-મે-બા-પ્ર-ક્ર":** **કી**, **ડુ**પ્લિકેટ, **મે**ળ, **બા**કી, **પ્ર**શ્ન (problem), **ક્ર**મ — "કીડી મેદાનમાં બાકી પ્રશ્ન ક્રમમાં".

#### (4) Code review માંથી શીખ (Codex ના ત્રણ findings)

PR review માં ત્રણ ખરી ભૂલો પકડાઈ, ત્રણેય "હિસાબ ખૂટે" પ્રકારની:

| ભૂલ | જૂનું વર્તન | સુધારો |
|---|---|---|
| Header માં `Amount,Amount` | બીજો column પહેલાને ચૂપચાપ ઢાંકી દે; ખોટો identical match | આખી file ની rows નકારો (`INVALID_HEADER`) |
| એક બાજુ duplicate, બીજી બાજુ એક row | એકલી row report માંથી ગાયબ | duplicate group માં બંને બાજુની lines |
| (પ્રકરણ 7) `Debit` column જ નથી | ગેરહાજર column = શૂન્ય; ₹900 ગાયબ | configured column ન હોય તો સ્પષ્ટ config error |

**શીખ:** "ચૂપચાપ સાચા દેખાતા" output સૌથી જોખમી છે. દરેક input row નો હિસાબ test થી સાબિત કરો.

#### (5) Harness સાથે જોડાણના ત્રણ નિર્ણય

1. **`ctx.fs` થી વાંચો, `node:fs` થી નહીં** — deployment નો filesystem provider અને sandbox નિયંત્રણમાં રહે; tool કદી write નથી કરતો.
2. **`workingDirectory` optional** — હોય તો session ની directory માં path resolve; ન હોય (unit test) તો પણ tool ચાલે.
3. **`isConcurrencySafe: () => true`** — ફક્ત reads; બીજા read-only calls સાથે parallel ચાલી શકે.

#### (6) Overlay, ખોટી config, અને disable

- **Overlay** absolute path થી row insert કરે.
- **ખોટી config** (`maxBytes: -5`) → `ValidationError … $.maxBytes expected number >= 0` → tool register જ ન થાય → required નથી એટલે ફક્ત warning. **Fail loud.**
- **Disable ના ત્રણ રસ્તા "ન-બી-કા":** overlay **ન** આપો; **બી**જું overlay `disabled: true`; **કા**યમ માટે profile `cordis.patch.yml`. Disable પછી model call કરે તો `UNKNOWN_TOOL`.

### નવા ટેકનિકલ શબ્દો — સરળ ગુજરાતીમાં

| શબ્દ | સરળ અર્થ | ઉદાહરણ | યાદ-ચાવી |
|---|---|---|---|
| `defineTool` | schema-validated tool બનાવતી helper | `defineTool({ name, parameters, output, execute })` | "ભરતી ફોર્મ" |
| Parameters | model મોકલી શકે તે arguments | `left_path` | "ગ્રાહકની માંગ" |
| Config schema | deployment config ની validation | `z.natural().default(...)` | "માલિકના નિયમો" |
| Schemastery (`z`) | config schema library | `z.object({...})` | "નિયમ-ચોપડી" |
| CSV | comma થી અલગ કરેલી કોષ્ટક text file | `Ref,Date,Party,Amount` | "અલ્પવિરામ યાદી" |
| Header | CSV ની પહેલી line, column નામો | `Ref,Amount` | "કોષ્ટકનું માથું" |
| Key column | row ને ઓળખતો column | `Ref` | "ઓળખ નંબર" |
| Deterministic | એ જ input → એ જ output | sorted report | "હંમેશા એ જ જવાબ" |
| Invariant | હંમેશા સાચો રહેવો જોઈએ તે નિયમ | "દરેક line એક જ વાર" | "અટલ નિયમ" |
| Fixture | test માટે તૈયાર નમૂના data | `export-a.csv` | "પ્રેક્ટિસ પેપર" |
| Unit test | એક નાનો ભાગ એકલો ચકાસતો test | `compare.test.ts` | "એક પૈડું તપાસો" |
| Integration test | અનેક ભાગ સાથે ચકાસતો test | `plugin.test.ts` | "આખી સાઇકલ ચલાવો" |
| `node:test` | Node નો બિલ્ટ-ઇન test runner | `node --test` | "ઘરનો પરીક્ષક" |
| Type check (`tsc`) | compile વખતે types ચકાસવા | exit 0 | "લેબલ તપાસ" |
| Fail loud | ખોટી સ્થિતિ તરત, સ્પષ્ટ જણાવવી | `ValidationError` | "બૂમ પાડો, ચૂપ નહીં" |

### યાદ રાખવાની રીતો

- **ભરતીના ચાર પ્રશ્ન "સા-મા-ગ્રા-પ":** **સા**ધન (`inject`), **મા**લિક (`Config`), **ગ્રા**હક (`parameters`), **પ**રિણામ (`output`).
- **"કીડી મેદાનમાં બાકી પ્રશ્ન ક્રમમાં"** — છ deterministic નિયમો.
- **"ન-બી-કા"** — disable ના ત્રણ રસ્તા.
- **"ચૂપ સાચું = ખતરનાક"** — review findings નો સાર.
- **ચિત્ર:** બે ચોપડા બાજુ-બાજુ, વચ્ચે દોરા: એક-એક દોરો = match, ગૂંચવાયેલા દોરા = duplicate group, દોરા વગરની લીટી = unmatched.

### સામાન્ય ગેરસમજો

| ગેરસમજ | સાચું |
|---|---|
| "`defineTool` એકલું tool register કરે." | `ctx.tools.register(...)` જોઈએ. |
| "Duplicate માં પહેલી row match કરી લો." | એ guess છે; group review માટે રોકો. |
| "ખોટી config હોય તો default વાપરશે." | Validation fail; tool register જ નહીં થાય. |
| "Unit test pass = dsh માં ચાલશે." | Path resolution જુદું; headless turn થી પણ ચકાસો. |

### પુનરાવર્તન કાર્ડ

<details><summary>1. Plugin ના ચાર ભાગ?</summary>

`inject`, `Config`, `parameters`, `output` (canonical value + render).
</details>

<details><summary>2. Duplicate key નું હવે report માં શું દેખાય?</summary>

એક group, બંને બાજુની lines સાથે: `DUPLICATE INV-1004 (left L5, L6; right L4)`.
</details>

<details><summary>3. Header માં `Amount,Amount` હોય તો?</summary>

કોઈ row સ્વીકારાતી નથી; `DUPLICATE_HEADER` અને દરેક data row માટે `INVALID_HEADER`.
</details>

<details><summary>4. Tool disable કર્યા પછી model call કરે તો?</summary>

`Error: unknown tool "csv_compare"`, code `UNKNOWN_TOOL`.
</details>

### મિત્રને સમજાવો (3 મિનિટ)

બે દુકાનોની વેચાણ યાદી સરખાવતાં "એક જ bill નંબર બે વાર" આવે ત્યારે કોઈ એક પસંદ કરવી કેમ ખોટું છે, તે મિત્રને audit ના ઉદાહરણથી સમજાવો.

### આગલા પ્રકરણ સાથે જોડાણ

તમારો tool હવે ચાલે છે. પ્રકરણ 5 પૂછે છે: **તૂટે ત્યારે શું?** — unknown tool, ખરાબ arguments, provider ની ભૂલ, અને Ctrl+C. પ્રકરણ 4 નો "ભૂલ crash નથી, `isError` result છે" નિયમ ત્યાં ચારેય નિષ્ફળતામાં સાબિત થશે.

---

પાછળ: [પ્રકરણ 3](03-tools-sessions-adapters.md) · આગળ: [પ્રકરણ 5 — Debugging, permissions અને reliability](05-debugging-permissions-reliability.md)

<!-- citations:begin (generated by tools/refdefs.py) -->
[agents-conventions]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/AGENTS.md#L130-L142
[batch-execute]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/core/tools/src/batch.ts#L50-L96
[read-target]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/fs/tool-fs/src/read-target.ts#L19-L34
[testkit-mount]: https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/test-support/agent-loop-testkit/src/index.ts#L74-L90
<!-- citations:end -->
