#!/usr/bin/env bash
set -euo pipefail
command -v yq >/dev/null || { echo "yq not found. Install: brew install yq"; exit 1; }

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

fail=0
for svcdir in docs/services/*; do
  [ -d "$svcdir" ] || continue
  svc="$(basename "$svcdir")"
  echo "Validating $svc ..."
  yq '.' "$svcdir/kg.yaml" >/dev/null || { echo "  ❌ Invalid YAML: $svcdir/kg.yaml"; fail=1; }
  yq '.' "$svcdir/change-map.yaml" >/dev/null || { echo "  ❌ Invalid YAML: $svcdir/change-map.yaml"; fail=1; }

  # Warn if any declared glob has zero matches
  while IFS= read -r pattern; do
    # expand relative to repo root
    matches=$(compgen -G "$pattern" 2>/dev/null || true)
    if [ -z "$matches" ]; then
      echo "  ⚠️  Pattern matches nothing: $pattern"
    fi
  done < <(yq -r '.files[]? // empty' "$svcdir/kg.yaml" 2>/dev/null || true)

done

[ "$fail" -eq 0 ] && echo "✅ docs OK" || { echo "❌ docs validation failed"; exit 1; }
