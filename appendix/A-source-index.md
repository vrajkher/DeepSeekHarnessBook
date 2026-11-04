# પરિશિષ્ટ A — Source index

આખા પુસ્તકની દરેક pinned citation એક જ generated table માં છે: [citations.generated.md](citations.generated.md). તે [`tools/citations.py`](../tools/citations.py) થી બને છે; દરેક entry file + start pattern થી શોધાય છે, તેથી કોઈ line number હાથે લખાયો નથી. Pattern ન મળે તો generator નિષ્ફળ થાય છે.

Pinned commit: `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159`. Permalink base: `https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/`.

નીચે subsystem પ્રમાણે ગોઠવેલો ટૂંકો નકશો છે (ids generated table ના `id` column સાથે મેળ ખાય છે).

## Launch અને startup (પ્રકરણ 0, 2)

| id | File | Symbol |
|---|---|---|
| `cli-runCli` | `apps/cli/src/bin.ts` | `runCli` |
| `cli-runProfile` | `apps/cli/src/profile-boot.ts` | `runProfile` |
| `cli-composeProfile` | same | `composeProfile` |
| `boot-readProfilePatches` | `packages/boot/app-boot/src/profile-context.ts` | `readProfilePatches` |
| `boot-boot` | `packages/boot/app-boot/src/index.ts` | `boot` |
| `boot-mountRootInclude` | same | `mountRootInclude` |
| `boot-required` | same | `requiredStartupEntryIds` |
| `boot-audit` | same | `auditStartupEntries` |
| `bundle-base*`, `bundle-headless` | `packages/bundle/*/cordis.patch.yml` | config rows |

## Cordis (vendored, પ્રકરણ 2)

| id | File | Symbol |
|---|---|---|
| `cordis-bin` | `vendor/cordis/bin.js` | tutorial launcher |
| `cordis-service` | `vendor/cordis/src/service.ts` | `Service` constructor |
| `cordis-provide` | `vendor/cordis/src/reflect.ts` | `ReflectService.provide` |
| `cordis-fiberstate`, `cordis-getstate`, `cordis-effect` | `vendor/cordis/src/fiber.ts` | `FiberState`, `_getState`, `Fiber.effect` |
| `cordis-plugin` | `vendor/cordis/src/registry.ts` | `RegistryService.plugin` |
| `cordis-on`, `cordis-waterfall` | `vendor/cordis/src/events.ts` | `on`, `waterfall` |
| `loader-entry-error` | `vendor/loader/src/config/entry.ts` | entry failure logging |
| `vendor-manifest`, `vendor-mods` | `vendor/README.md` | version, local modifications |

## Agent loop અને session (પ્રકરણ 1, 3)

| id | File | Symbol |
|---|---|---|
| `headless-*` | `packages/bundle/headless/src/index.ts` | `run`, `agents.create`, `followup`, `flush`, `fail`, `apply` |
| `loop-*` | `packages/core/agent-loop/src/agent.ts` | `ReactLoopAgent`, `kick`, `turn`, `preStep`, `step`, `prepareRequest`, `buildRequest`, `cancel` |
| `agent-events`, `agent-stream-frame` | `packages/core/agent/src/runtime-types.ts` | `agent/*` events, `AssistantStreamFrame` |
| `session-*` | `packages/core/session/src/{index,types}.ts` | `Session.append`, `deriveMessages`, `SessionStore.flush`, `SurfaceEventType` |
| `persistence-closed` | `packages/session/session-persistence/src/errors.ts` | `SessionHandleClosedError` |

## Tools અને filesystem (પ્રકરણ 3, 4, 5)

| id | File | Symbol |
|---|---|---|
| `tools-*`, `setExecutor` | `packages/core/tools/src/index.ts` | `execute`, `selectExecutor`, `guard`, `setExecutor` |
| `batch-*` | `packages/core/tools/src/batch.ts` | `executeToolBatch`, `parseArguments` |
| `pipeline-*` | `packages/core/tools/src/pipeline.ts` | `prepare`, `dispatch`, `dispatchToolBody`, `toolErrorResult`, `executionMode` |
| `schema-defineTool-validate` | `packages/core/tools/src/schema.ts` | `defineTool` args validation |
| `native-executor` | `packages/core/tool-executor-native/src/index.ts` | `NativeToolExecutor` |
| `read-*`, `toolfs-*` | `packages/fs/tool-fs/src/*.ts` | `applyReadTool`, `parseReadArgs`, `resolveRegularReadTarget`, escalation schema |
| `fs-abstract`, `fs-sandbox-*` | `packages/fs/fs/src/index.ts`, `packages/fs/fs-sandbox/src/index.ts` | `FileSystem`, sandbox policy |

## LLM (પ્રકરણ 3, 5)

| id | File | Symbol |
|---|---|---|
| `llm-*` | `packages/llm/llm/src/{index,types}.ts` | `LlmRuntime`, `registerAdapter`, `prepareCall`, `stream`, `StreamChunk` |
| `deepseek-*` | `packages/llm/llm-deepseek/src/*.ts` | `DeepSeekAdapter`, `generate`, `fetch`, `serialize`, `translate`, `parseSse`, `DEEPSEEK_BASE_URL` |
| `retry-*` | `packages/llm/llm/src/retry-policy.ts`, `packages/llm/llm-retry/src/index.ts` | defaults, `agent/request-error` listener |
| `sessionlog-register` | `packages/session/session-log-deepseek/src/index.ts` | `dsh_session_log` extension |

## Sandbox અને approval (પ્રકરણ 5)

| id | File | Symbol |
|---|---|---|
| `sandbox-policy` | `packages/sandbox/sandbox-policy/src/index.ts` | `SandboxPolicyService` |
| `sandbox-unavailable`, `sandbox-escalation` | `packages/sandbox/sandbox/src/{index,escalation}.ts` | `SandboxUnavailableError`, escalation outcomes |
| `sandbox-local-chain` | `packages/sandbox/sandbox-local/src/index.ts` | runner chain |
| `approval-policy` | `packages/interaction/user-approval/src/index.ts` | `ApprovalPolicy` |

## Docs અને test support

| id | File |
|---|---|
| `arch-turnflow`, `arch-where` | `docs/architecture.md` |
| `primer-dispatch` | `docs/cordis-primer.md` |
| `tutorial-07` | `docs/cordis-tutorial/07-into-the-harness.md` |
| `agents-conventions` | `AGENTS.md` |
| `mock-tool-call`, `mock-record` | `packages/test-support/llm-mock-server/src/index.ts` |
| `testkit-mount` | `packages/test-support/agent-loop-testkit/src/index.ts` |
