#!/usr/bin/env bash
# Write an overlay that inserts reconcile_bank_tally by absolute path; prints the overlay path.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
printf -- "- insert:\n    - id: book-reconcile\n      name: '%s/src/plugin.ts'\n      config:\n        windowDays: 3\n" "$DIR" > "$DIR/overlay.generated.yml"
echo "$DIR/overlay.generated.yml"
