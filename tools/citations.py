#!/usr/bin/env python3
"""Book tool: compute commit-pinned permalinks for every cited symbol.

Usage: python3 tools/citations.py <pinned harness checkout> > appendix/citations.generated.md

Each entry names a file, a start pattern (the first line containing it), and either an
end pattern (searched after the start) or a line count. The script fails if any pattern
is missing, so a stale citation cannot be generated silently.
"""
import sys, pathlib

SHA = 'fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159'
BASE = f'https://github.com/deepseek-ai/deepseek-harness/blob/{SHA}'

# id, path, symbol shown to readers, start pattern, end pattern or +N lines
ENTRIES = [
    ('cli-runCli', 'apps/cli/src/bin.ts', 'runCli', 'export async function runCli', '+49'),
    ('cli-runProfile', 'apps/cli/src/profile-boot.ts', 'runProfile', 'export async function runProfile', '+82'),
    ('cli-composeProfile', 'apps/cli/src/profile-boot.ts', 'composeProfile', 'composeProfile(', '+20'),
    ('boot-boot', 'packages/boot/app-boot/src/index.ts', 'boot', 'export async function boot(', '+66'),
    ('boot-mountRootInclude', 'packages/boot/app-boot/src/index.ts', 'mountRootInclude', 'export async function mountRootInclude', '+54'),
    ('boot-required', 'packages/boot/app-boot/src/index.ts', 'requiredStartupEntryIds', 'const requiredStartupEntryIds', '+11'),
    ('boot-audit', 'packages/boot/app-boot/src/index.ts', 'auditStartupEntries', 'export async function auditStartupEntries', '+14'),
    ('cordis-bin', 'vendor/cordis/bin.js', 'Cordis launcher', 'const ctx = new Context()', '+9'),
    ('bundle-base', 'packages/bundle/base/cordis.patch.yml', 'dsh-base rows', '- insert:', '+3'),
    ('bundle-base-tools', 'packages/bundle/base/cordis.patch.yml', 'tools + native executor rows', '- id: tools', '+5'),
    ('bundle-base-llm', 'packages/bundle/base/cordis.patch.yml', 'llm-deepseek row', '- id: llm-deepseek', '+1'),
    ('bundle-base-sandbox', 'packages/bundle/base/cordis.patch.yml', 'sandbox-policy + approval rows', '- id: sandbox-policy', '+35'),
    ('bundle-base-title', 'packages/bundle/base/cordis.patch.yml', 'session-title-llm row', '- id: session-title-llm', '+11'),
    ('bundle-base-sessionlog', 'packages/bundle/base/cordis.patch.yml', 'session-log-deepseek row', '- id: session-log-deepseek', '+1'),
    ('bundle-headless', 'packages/bundle/headless/cordis.patch.yml', 'headless patch', '- id: system-prompt', '+37'),
    ('headless-inject', 'packages/bundle/headless/src/index.ts', 'inject', 'export const inject', '+0'),
    ('headless-run', 'packages/bundle/headless/src/index.ts', 'run', 'async function run(ctx', '+133'),
    ('headless-create', 'packages/bundle/headless/src/index.ts', 'agents.create', '? (await agents.create({', '+7'),
    ('headless-followup', 'packages/bundle/headless/src/index.ts', 'agent.followup', 'agent.followup(createUserMessage', '+13'),
    ('headless-flush', 'packages/bundle/headless/src/index.ts', 'sessions.flush', 'await sessions.flush(agent.session)', '+9'),
    ('headless-fail', 'packages/bundle/headless/src/index.ts', 'fail', 'function fail(io', '+5'),
    ('headless-apply', 'packages/bundle/headless/src/index.ts', 'apply', 'export function apply(ctx', '+9'),
    ('loop-class', 'packages/core/agent-loop/src/agent.ts', 'ReactLoopAgent', 'export class ReactLoopAgent', '+0'),
    ('loop-cancel', 'packages/core/agent-loop/src/agent.ts', 'cancel', '  cancel(cause', '+10'),
    ('loop-kick', 'packages/core/agent-loop/src/agent.ts', 'kick', 'private async kick', '+14'),
    ('loop-preStep', 'packages/core/agent-loop/src/agent.ts', 'preStep', 'private async preStep', '+35'),
    ('loop-turn', 'packages/core/agent-loop/src/agent.ts', 'turn', 'private async turn()', '+106'),
    ('loop-turn-start', 'packages/core/agent-loop/src/agent.ts', "append('turn/start'", "this.session.append('turn/start'", '+0'),
    ('loop-step-start', 'packages/core/agent-loop/src/agent.ts', "append('step/start'", "this.session.append('step/start'", '+0'),
    ('loop-recovery', 'packages/core/agent-loop/src/agent.ts', 'toolRecovery.results', 'toolRecovery.results()', '+9'),
    ('loop-turn-end', 'packages/core/agent-loop/src/agent.ts', "append('turn/end'", "this.session.append('turn/end'", '+0'),
    ('loop-step', 'packages/core/agent-loop/src/agent.ts', 'step', 'private async step(', '+175'),
    ('loop-admit', 'packages/core/agent-loop/src/agent.ts', 'user/message admission', 'if (firstAttempt) {', '+15'),
    ('loop-stream', 'packages/core/agent-loop/src/agent.ts', 'stream loop', 'const stream = preparedCall?.stream(request)', '+8'),
    ('loop-request-error', 'packages/core/agent-loop/src/agent.ts', 'agent/request-error', "'agent/request-error'", '+15'),
    ('loop-assistant-message', 'packages/core/agent-loop/src/agent.ts', 'assistant/message', 'const message = createAssistantMessage({', '+20'),
    ('loop-tools-execute', 'packages/core/agent-loop/src/agent.ts', 'tools.execute', 'const toolCalls = message.content.filter', '+15'),
    ('loop-prepareRequest', 'packages/core/agent-loop/src/agent.ts', 'prepareRequest', 'private async prepareRequest', '+42'),
    ('loop-buildRequest', 'packages/core/agent-loop/src/agent.ts', 'buildRequest', 'private buildRequest', '+89'),
    ('loop-derive', 'packages/core/agent-loop/src/agent.ts', 'deriveMessages in buildRequest', 'const boundaryMessages = session.deriveMessages()', '+17'),
    ('agentloop-inject', 'packages/core/agent-loop/src/index.ts', 'AgentLoop inject', "static inject = ['agents'", '+0'),
    ('agent-events', 'packages/core/agent/src/runtime-types.ts', 'agent/* event declarations', "'agent/status'(this", '+110'),
    ('agent-stream-frame', 'packages/core/agent/src/runtime-types.ts', 'AssistantStreamFrame', 'export type AssistantStreamFrame', '+33'),
    ('session-class', 'packages/core/session/src/index.ts', 'Session', 'export class Session {', '+0'),
    ('session-event-decl', 'packages/core/session/src/index.ts', "'session/event'", "'session/event'(this", '+0'),
    ('session-append', 'packages/core/session/src/index.ts', 'append', '  append<T extends SessionEventType>(', '+30'),
    ('session-derive', 'packages/core/session/src/index.ts', 'deriveMessages', '  deriveMessages(): Message[] {', '+22'),
    ('session-store', 'packages/core/session/src/index.ts', 'SessionStore', 'export class SessionStore extends Service', '+0'),
    ('session-flush', 'packages/core/session/src/index.ts', 'flush', '  async flush(session: Session)', '+18'),
    ('session-types-tool', 'packages/core/session/src/types.ts', "'tool/call'", "'tool/call': {", '+0'),
    ('tools-selectExecutor', 'packages/core/tools/src/index.ts', 'selectExecutor', 'private selectExecutor', '+12'),
    ('tools-execute', 'packages/core/tools/src/index.ts', 'execute', 'async execute(input: ToolBatchInput)', '+2'),
    ('tools-guard', 'packages/core/tools/src/index.ts', 'guard', '  guard(guard: ToolGuard)', '+2'),
    ('tools-events', 'packages/core/tools/src/events.ts', "'tools/execute'", "'tools/execute'(this", '+0'),
    ('batch-execute', 'packages/core/tools/src/batch.ts', 'executeToolBatch', 'export async function executeToolBatch', '+46'),
    ('batch-parse', 'packages/core/tools/src/batch.ts', 'parseArguments', 'function parseArguments', '+7'),
    ('pipeline-prepare', 'packages/core/tools/src/pipeline.ts', 'prepare', 'async prepare(input', '+46'),
    ('pipeline-body', 'packages/core/tools/src/pipeline.ts', 'dispatchToolBody', 'private async dispatchToolBody', '+30'),
    ('pipeline-dispatch', 'packages/core/tools/src/pipeline.ts', 'dispatch', 'async dispatch(exec: ToolRunContext)', '+31'),
    ('pipeline-errorResult', 'packages/core/tools/src/pipeline.ts', 'toolErrorResult', 'function toolErrorResult', '+8'),
    ('schema-defineTool-validate', 'packages/core/tools/src/schema.ts', 'defineTool validation', 'async execute(args: unknown, exec: ToolRunContext)', '+4'),
    ('contracts-notfound', 'packages/core/tools/src/contracts.ts', 'ToolNotFoundError', 'export class ToolNotFoundError', '+0'),
    ('native-executor', 'packages/core/tool-executor-native/src/index.ts', 'NativeToolExecutor', 'export class NativeToolExecutor', '+27'),
    ('toolfs-inject', 'packages/fs/tool-fs/src/index.ts', 'tool-fs inject', 'export const inject', '+0'),
    ('read-tool', 'packages/fs/tool-fs/src/read.ts', 'applyReadTool', 'export function applyReadTool', '+95'),
    ('read-parse', 'packages/fs/tool-fs/src/read.ts', 'parseReadArgs', 'export function parseReadArgs', '+7'),
    ('read-target', 'packages/fs/tool-fs/src/read-target.ts', 'resolveRegularReadTarget', 'export async function resolveRegularReadTarget', '+15'),
    ('fs-abstract', 'packages/fs/fs/src/index.ts', 'FileSystem', 'export abstract class FileSystem', '+0'),
    ('fs-sandbox-doc', 'packages/fs/fs-sandbox/src/index.ts', 'SandboxedFileSystem policy', "Per-call policy: `read-only`", '+4'),
    ('sandbox-policy', 'packages/sandbox/sandbox-policy/src/index.ts', 'SandboxPolicyService', 'export class SandboxPolicyService', '+4'),
    ('approval-policy', 'packages/interaction/user-approval/src/index.ts', 'ApprovalPolicy', 'export type ApprovalPolicy', '+0'),
    ('llm-runtime', 'packages/llm/llm/src/index.ts', 'LlmRuntime', 'export class LlmRuntime', '+0'),
    ('llm-registerAdapter', 'packages/llm/llm/src/index.ts', 'registerAdapter', '  registerAdapter(providers', '+0'),
    ('llm-prepareCall', 'packages/llm/llm/src/index.ts', 'prepareCall', '  async prepareCall(\n', '+0'),
    ('llm-stream', 'packages/llm/llm/src/index.ts', 'stream / llm/stream waterfall', '  stream(options: GenerateOptions): AsyncIterable<StreamChunk> {', '+15'),
    ('llm-stream-decl', 'packages/llm/llm/src/index.ts', "'llm/stream'", "'llm/stream'(this", '+0'),
    ('deepseek-adapter', 'packages/llm/llm-deepseek/src/adapter.ts', 'DeepSeekAdapter', 'export class DeepSeekAdapter', '+0'),
    ('deepseek-generate', 'packages/llm/llm-deepseek/src/adapter.ts', 'generate', 'private async * generate', '+25'),
    ('deepseek-fetch', 'packages/llm/llm-deepseek/src/adapter.ts', 'fetch /messages', 'const response = await fetch(', '+28'),
    ('deepseek-baseurl', 'packages/llm/llm-deepseek/src/config.ts', 'DEEPSEEK_BASE_URL', "const BASE_URL_ENV = 'DEEPSEEK_BASE_URL'", '+0'),
    ('deepseek-apikey', 'packages/llm/llm-deepseek-api-key/src/config.ts', 'apiKeyEnv', "apiKeyEnv: z.string()", '+0'),
    ('retry-listener', 'packages/llm/llm-retry/src/index.ts', "agent/request-error listener", "ctx.on('agent/request-error'", '+0'),
    ('sessionlog-register', 'packages/session/session-log-deepseek/src/index.ts', 'dsh_session_log', "ctx.deepseekLlmApiExtensions.register('dsh_session_log'", '+0'),
    ('persistence-closed', 'packages/session/session-persistence/src/errors.ts', 'SessionHandleClosedError', 'export class SessionHandleClosedError', '+10'),
    ('mock-tool-call', 'packages/test-support/llm-mock-server/src/index.ts', 'tool_call_success', "case 'tool_call_success':", '+8'),
    ('mock-record', 'packages/test-support/llm-mock-server/src/index.ts', 'MockLlmRequestRecord', 'export interface MockLlmRequestRecord', '+17'),
    ('testkit-mount', 'packages/test-support/agent-loop-testkit/src/index.ts', 'mountAgentLoopTestDependencies', 'export async function mountAgentLoopTestDependencies', '+16'),
    ('cordis-service', 'vendor/cordis/src/service.ts', 'Service constructor', '  constructor(protected ctx: Context, name: string) {', '+17'),
    ('cordis-provide', 'vendor/cordis/src/reflect.ts', 'ReflectService.provide', '  provide(name: string, value?: any, check?: () => boolean) {', '+20'),
    ('cordis-fiberstate', 'vendor/cordis/src/fiber.ts', 'FiberState', 'export const enum FiberState', '+7'),
    ('cordis-getstate', 'vendor/cordis/src/fiber.ts', '_getState', '  private _getState() {', '+5'),
    ('cordis-effect', 'vendor/cordis/src/fiber.ts', 'Fiber.effect', "  effect(execute: () => Effect, label = 'anonymous'): any {", '+24'),
    ('cordis-plugin', 'vendor/cordis/src/registry.ts', 'RegistryService.plugin', '  plugin(plugin: Plugin, config?: any', '+14'),
    ('cordis-on', 'vendor/cordis/src/events.ts', 'EventsService.on', '  on(name: string | symbol, listener', '+0'),
    ('cordis-waterfall', 'vendor/cordis/src/events.ts', 'EventsService.waterfall', '  waterfall(...args: any[]) {', '+0'),
    ('vendor-mods', 'vendor/README.md', 'local modification V6', '- **V6 ·', '+0'),
    ('boot-readProfilePatches', 'packages/boot/app-boot/src/profile-context.ts', 'readProfilePatches', 'export function readProfilePatches', '+11'),
    ('loader-entry-error', 'vendor/loader/src/config/entry.ts', 'logger.error on entry failure', 'this.ctx.logger.error(error)', '+0'),
    ('scope-create', 'packages/core/scope/src/index.ts', 'createScope', 'export function createScope', '+16'),
    ('scope-target', 'packages/core/scope/src/index.ts', 'scopeTarget', 'export function scopeTarget', '+0'),
    ('scope-chain', 'packages/core/scope/src/index.ts', 'scopeChainOf', 'export function scopeChainOf', '+0'),
    ('setExecutor', 'packages/core/tools/src/index.ts', 'setExecutor', '  setExecutor(', '+0'),
    ('llm-streamchunk', 'packages/llm/llm/src/types.ts', 'StreamChunk', 'export type StreamChunk =', '+12'),
    ('deepseek-translate', 'packages/llm/llm-deepseek/src/translate.ts', 'translate', 'export async function* translate', '+0'),
    ('deepseek-finish', 'packages/llm/llm-deepseek/src/translate.ts', 'finish reason mapping', "case 'end_turn': case 'stop_sequence'", '+2'),
    ('deepseek-sse', 'packages/llm/llm-deepseek/src/sse.ts', 'parseSse', 'export async function* parseSse', '+0'),
    ('deepseek-serialize', 'packages/llm/llm-deepseek/src/serialize.ts', 'serialize', 'export function serialize(', '+0'),
    ('headless-flags', 'packages/bundle/headless/src/startup.ts', 'headless options', ".option('--json'", '+5'),
    ('read-output', 'packages/fs/tool-fs/src/read.ts', 'read output.render', '      render: (args, value) => {', '+14'),
    ('pipeline-materialize', 'packages/core/tools/src/pipeline.ts', 'output validation', 'const violations = validateJsonSchemaValue(tool.output.schema, detached', '+0'),
    ('session-surface-types', 'packages/core/session/src/types.ts', 'SurfaceEventType', 'export type SurfaceEventType =', '+5'),
    ('tutorial-07', 'docs/cordis-tutorial/07-into-the-harness.md', 'tutorial chapter 7 composition', "- name: '@deepseek-ai/dsh-system-prompt'", '+3'),
    ('primer-dispatch', 'docs/cordis-primer.md', 'dispatch modes table', '| Mode | Awaited?', '+6'),
    ('arch-turnflow', 'docs/architecture.md', 'Turn flow', '## Turn flow', '+30'),
    ('arch-where', 'docs/architecture.md', 'Where new behavior goes', '## Where new behavior goes', '+26'),
    ('agents-conventions', 'AGENTS.md', 'Conventions', '## Conventions', '+12'),
    ('vendor-manifest', 'vendor/README.md', 'Cordis vendored version', '| `cordis/` |', '+0'),
]

def find(lines, pattern, start=0):
    if '\n' in pattern:
        first = pattern.split('\n')[0]
        for i in range(start, len(lines)):
            if lines[i].rstrip('\n') == first.rstrip():
                return i
    for i in range(start, len(lines)):
        if pattern in lines[i]:
            return i
    return -1

def main():
    root = pathlib.Path(sys.argv[1])
    out = ['| id | symbol | file | lines | permalink |', '|---|---|---|---|---|']
    failed = 0
    for cid, path, symbol, start_pat, end in ENTRIES:
        lines = (root / path).read_text(encoding='utf-8').splitlines()
        s = find(lines, start_pat)
        if s < 0:
            print(f'MISSING start {cid}: {start_pat!r} in {path}', file=sys.stderr); failed += 1; continue
        e = s + int(end[1:]) if end.startswith('+') else find(lines, end, s + 1)
        if e < 0 or e >= len(lines):
            print(f'BAD end {cid} in {path}', file=sys.stderr); failed += 1; continue
        a, b = s + 1, e + 1
        anchor = f'L{a}' if a == b else f'L{a}-L{b}'
        out.append(f'| `{cid}` | `{symbol}` | `{path}` | {a}–{b} | [{path}#{anchor}]({BASE}/{path}#{anchor}) |')
    print('\n'.join(out))
    if failed:
        sys.exit(1)

if __name__ == '__main__':
    main()
