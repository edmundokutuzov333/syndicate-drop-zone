#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
SCENE_BIBLE="${SCENE_BIBLE:-docs/camping-v3/scene-bible.json}"
BLEND_OUT="${1:-art/xoyens-studio.blend}"
RAW_OUT="${2:-art/out/xoyens-studio.raw.glb}"
BLENDER_BIN="${BLENDER_BIN:-blender}"
command -v "$BLENDER_BIN" >/dev/null 2>&1 || { echo "Blender not found. Run npm run 3d:toolchain:install first." >&2; exit 2; }
test -s "$SCENE_BIBLE" || { echo "Scene Bible missing: $SCENE_BIBLE" >&2; exit 2; }
python3 -m py_compile scripts/blender/*.py
node scripts/fetch-cc0-materials.mjs --download
node scripts/validate-pbr-materials.mjs --write-licenses
node scripts/validate-pbr-materials.mjs
mkdir -p "$(dirname "$BLEND_OUT")" "$(dirname "$RAW_OUT")"
"$BLENDER_BIN" --version
# Deterministic initial build from factory startup.
"$BLENDER_BIN" -b --factory-startup --python-exit-code 1 -P scripts/blender/build_all.py -- "$SCENE_BIBLE" "$BLEND_OUT"
test -s "$BLEND_OUT" || { echo "Blender produced no source file: $BLEND_OUT" >&2; exit 3; }
# Reopen the saved source in a separate process. Factory startup must not be used here.
"$BLENDER_BIN" -b "$BLEND_OUT" --python-exit-code 1 -P scripts/blender/validate_blend.py -- "$SCENE_BIBLE"
test -s "${BLEND_OUT%.blend}.report.json" || { echo "Build report missing next to $BLEND_OUT" >&2; exit 3; }
"$BLENDER_BIN" -b "$BLEND_OUT" --python-exit-code 1 -P scripts/blender/export_glb.py -- "$RAW_OUT"
test -s "$RAW_OUT" || { echo "GLB export missing: $RAW_OUT" >&2; exit 3; }
node scripts/verify-glb-contract.mjs "$RAW_OUT" "$SCENE_BIBLE"
