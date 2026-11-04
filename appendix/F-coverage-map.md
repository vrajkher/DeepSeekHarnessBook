# પરિશિષ્ટ F — Coverage map

Pinned commit ના મુખ્ય subsystems અને પુસ્તકમાં તેમનું સ્થાન. **Depth:** ●●● = source trace + lab; ●● = source trace; ● = ઉલ્લેખ/નકશો; ○ = આવરી લીધું નથી.
**Status:** 🧪 runtime-verified, ✅ source-verified, ⚠️ docs-only/unverified.

| Subsystem (folder) | ભૂમિકા | પ્રકરણ | Depth | Status |
|---|---|---|---|---|
| `apps/cli` | `dsh` launcher, profile boot, signals | 0, 1, 2, 5 | ●●● | 🧪 |
| `packages/boot/app-boot` | profile composition, startup audit | 2 | ●●● | 🧪 |
| `packages/bundle/base`, `headless` | default composition, one-shot runner | 1, 2, 5, 6 | ●●● | 🧪 |
| `vendor/cordis`, `loader`, `include` | Context, services, fibers, effects, events, YAML | 0, 2 | ●●● | 🧪 (vendored copy) |
| `packages/core/agent-loop` | turn/step driver | 1, 5 | ●●● | 🧪 |
| `packages/core/agent` | Agent interface, `agent/*` events | 1, 5 | ●● | ✅ |
| `packages/core/session` | append-only log, surface, derive | 1, 3 | ●●● | 🧪 |
| `packages/session/session-persistence*` | JSONL generations, handles | 3, 6 | ●● | 🧪 |
| `packages/core/tools`, `tool-executor-native` | registry, batch, pipeline | 1, 3, 4, 5 | ●●● | 🧪 |
| `packages/core/system-prompt` | prompt sections, tool schemas | 1, 3 | ● | ✅ |
| `packages/core/scope` | per-agent registrations | 2 | ●● | ✅ |
| `packages/fs/fs`, `fs-sandbox`, `tool-fs` | filesystem seam, mutation fence, `read` | 3, 4, 5 | ●●● | 🧪 |
| `packages/llm/llm`, `llm-deepseek*` | adapter seam, DeepSeek Messages adapter | 1, 3 | ●●● | 🧪 (mock provider) |
| `packages/llm/llm-retry` | retry on `agent/request-error` | 5 | ●●● | 🧪 |
| `packages/sandbox/*` | sandbox policy, local runners, escalation | 5 | ●● | 🧪 (no `bwrap` host) |
| `packages/interaction/user-approval`, `permission-presets` | approval, presets | 5 | ●● | 🧪 (headless, no answerer) |
| `packages/session/session-log-deepseek` | `dsh_session_log` upload | 3, 5 | ●● | 🧪 (wire capture) |
| `packages/session/session-title*` | title generation (extra model call) | 1, 6 | ●● | 🧪 |
| `packages/test-support/llm-mock-server`, `agent-loop-testkit` | keyless testing | 1, 4, 5, 6 | ●●● | 🧪 |
| `packages/shell/*` (`tool-bash`, `bash-sandbox`) | shell tool and confinement | 5 | ● | 🧪 (fail-closed only) |
| `packages/telemetry`, `session-telemetry-otel` | OTel feedback export | 5 | ● | ✅ |
| `packages/compaction/*` | context compaction | — | ○ | — |
| `packages/subagent/*`, `team/*` | delegated agents, agent teams | 2 (pending cascade only) | ● | 🧪 |
| `packages/mcp/*` | external MCP tools | — | ○ | — |
| `packages/core/tool-executor-ptc`, `ptc-runtime` | programmatic tool calling | — | ○ | — |
| `packages/skill/*` | skill catalog | 1 (`skill-catalog` message) | ● | 🧪 |
| `packages/host`, `client`, `api/*`, `apps/web` | Web UI, Typert remote API | — | ○ | build only 🧪 |
| `apps/desktop`, `desktop-host` | Electron app | — | ○ | build only 🧪 |
| `packages/sdk`, `python/`, `packages/acp` | SDK, Python, ACP | — | ○ | — |
| `packages/workflow`, `jobs`, `schedule`, `goal`, `plan` | workflows, background jobs | — | ○ | — |

## પુસ્તક-માલિકીના labs ↔ upstream seams

| Lab | Upstream seam | Test status |
|---|---|---|
| `request-trace/trace-events.ts` | `session/event`, `agent/assistant-stream`, `llm/stream`, `tools/result` | 🧪 used in every run |
| `csv-inspect` | `ctx.tools` + `ctx.fs` | 🧪 13/13 tests, e2e turn |
| `measure/metrics.ts` | `llm/stream`, `tools/execute` | 🧪 5+5 runs |
| `contribution/headless-teardown.patch` | `dsh-headless` runner | 🧪 136/136 suite, 100% coverage, lint, tsc |
| `reconcile` | `ctx.tools` + `ctx.fs` | 🧪 12/12 tests + challenge test, e2e turn |
| `cordis-basics` | Loader, logger, tool executor | 🧪 |

ઓછું આવરી લીધેલું (○) એ ઇરાદાપૂર્વક છે: પુસ્તકનો request path headless profile છે. આગળ વધવા માટે repository ના `docs/subsystems/*.md` અને `docs/cookbook/*.md` એ જ commit પર વાંચો.
