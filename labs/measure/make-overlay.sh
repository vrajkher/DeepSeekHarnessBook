#!/usr/bin/env bash
# Write an overlay that inserts the metrics plugin by absolute path; prints the overlay path.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
printf -- "- insert:\n    - id: book-metrics\n      name: '%s/metrics.ts'\n" "$DIR" > "$DIR/overlay.generated.yml"
echo "$DIR/overlay.generated.yml"
