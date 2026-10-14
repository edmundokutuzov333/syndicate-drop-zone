#!/usr/bin/env bash
# Bake entry point; actual lightmap bake is implemented in the later lighting phase.
set -euo pipefail
cd "$(dirname "$0")/.."
BLEND_FILE="${1:-${CAMPING_BLEND_FILE:-art/xoyens-studio.blend}}"
OUT_DIR="${2:-${CAMPING_BAKE_DIR:-art/bake}}"
TIER="${3:-${CAMPING_BAKE_TIER:-high}}"
if [[ ! -f "$BLEND_FILE" ]]; then echo "Blender source missing: $BLEND_FILE; no bake was executed." >&2; exit 2; fi
if [[ ! -f scripts/blender/bake_lightmaps.py ]]; then echo "scripts/blender/bake_lightmaps.py is not present yet; bake belongs to Phase 13." >&2; exit 2; fi
case "$TIER" in high|mid|ultra) ;; *) echo "Invalid tier: $TIER (high, mid, ultra)" >&2; exit 2 ;; esac
[ ! -f scripts/3d/env.sh ] || source scripts/3d/env.sh
[ ! -f scripts/env.sh ] || source scripts/env.sh
BLENDER_BIN="${BLENDER_BIN:-blender}"
command -v "$BLENDER_BIN" >/dev/null 2>&1 || { echo "Blender not found: $BLENDER_BIN" >&2; exit 2; }
exec "$BLENDER_BIN" -b "$BLEND_FILE" --python-exit-code 1 -P scripts/blender/bake_lightmaps.py -- "$OUT_DIR" "$TIER"
