#!/usr/bin/env bash
# Write an overlay that inserts csv_compare by absolute path; prints the overlay path.
# Disable the tool again by deleting the overlay, or by adding `disabled: true` to the row.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
cat > "$DIR/overlay.generated.yml" <<YAML
- insert:
    - id: book-csv-compare
      name: '$DIR/src/plugin.ts'
      config:
        maxBytes: 1048576
YAML
echo "$DIR/overlay.generated.yml"
