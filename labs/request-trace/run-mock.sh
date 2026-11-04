#!/usr/bin/env bash
# Book lab: run one headless dsh task against the keyless mock Messages server.
# Run from the harness checkout root after `pnpm install && pnpm run build`.
#   bash tmp/book-labs/request-trace/run-mock.sh
# Environment knobs: SEQUENCE, TOOL_NAME, TOOL_ARGS, SUCCESS_TEXT, TASK, TITLE=on|off,
# PORT, MOCK_EXTRA (extra mock flags), EXTRA_PATCH (absolute path of one more overlay),
# DSH_ARGS (extra headless flags, e.g. "--session-id session-…"). DSH_HOME persists between runs; delete it for a fresh start.
set -euo pipefail
LAB="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$LAB/../../.." && pwd)"
PORT="${PORT:-8000}"
DEFAULT_TOOL_ARGS='{"file_path":"README.md"}'
TOOL_ARGS="${TOOL_ARGS:-$DEFAULT_TOOL_ARGS}"
export DSH_HOME="${DSH_HOME:-$ROOT/tmp/book-home}"
mkdir -p "$DSH_HOME"

# Overlay paths must be absolute: a patch file does not change the profile directory.
cat > "$LAB/overlay.generated.yml" <<YAML
- insert:
    - id: book-trace-events
      name: '$LAB/trace-events.ts'
YAML
# TITLE=on keeps the base bundle's LLM title generator, which makes one extra model call.
if [ "${TITLE:-off}" = "off" ]; then
  printf -- "- id: session-title-llm\n  disabled: true\n" >> "$LAB/overlay.generated.yml"
fi

# Two scripted responses: first a tool call, then text. The tool arguments are the
# exact JSON a model would send to the real 'read' tool.
pnpm --silent run mock:llm --port "$PORT" --api-key mock-key \
  --sequence "${SEQUENCE:-tool_call_success,success}" \
  --tool-name "${TOOL_NAME:-read}" --tool-arguments "$TOOL_ARGS" \
  ${MOCK_EXTRA:-} \
  --success-text "${SUCCESS_TEXT:-README નો સાર: DeepSeek Harness એ plugin આધારિત agent harness છે.}" \
  > "$LAB/mock.jsonl" &
MOCK=$!
trap 'kill $MOCK 2>/dev/null || true' EXIT
for _ in $(seq 1 50); do grep -q '"ready"' "$LAB/mock.jsonl" 2>/dev/null && break; sleep 0.2; done

cd "$ROOT"
DEEPSEEK_BASE_URL="http://127.0.0.1:$PORT/v1" DEEPSEEK_API_KEY=mock-key DSH_TELEMETRY_DISABLED=1 \
  pnpm --silent dsh --profile headless --patch "$LAB/overlay.generated.yml" ${EXTRA_PATCH:+--patch "$EXTRA_PATCH"} ${DSH_ARGS:-} \
  "${TASK:-આ repositoryનું README વાંચીને ગુજરાતી સાર આપો.}" && status=0 || status=$?
echo "dsh exit: $status" >&2
exit "$status"
