#!/usr/bin/env bash
# Write an overlay that inserts the greet tool by absolute path; GREETING overrides the default.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
{
  printf -- "- insert:\n    - id: book-greet\n      name: '%s/greet.ts'\n" "$DIR"
  if [ -n "${GREETING:-}" ]; then printf -- "      config:\n        greeting: '%s'\n" "$GREETING"; fi
} > "$DIR/overlay.generated.yml"
echo "$DIR/overlay.generated.yml"
