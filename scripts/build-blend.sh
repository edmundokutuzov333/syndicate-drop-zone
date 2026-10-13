#!/usr/bin/env bash
set -euo pipefail
BLEND_OUT="\${1:-art/xoyens-studio.blend}"
RAW_OUT="\${2:-art/out/xoyens-studio.raw.glb}"
BLENDER_BIN="\${BLENDER_BIN:-blender}"

command -v "$BLENDER_BIN" >/dev/null 2>&1 || {
  echo "Blender não encontrado. Execute npm run 3d:toolchain:install primeiro." >&2
  exit 2
}
python3 -m py_compile scripts/blender/*.py
mkdir -p "$(dirname "$BLEND_OUT")" "$(dirname "$RAW_OUT")"
"$BLENDER_BIN" --background --python-expr "import bpy; print('Blender', bpy.app.version_string); print('engine', bpy.context.scene.render.engine)" >/dev/null
"$BLENDER_BIN" -b -P scripts/blender/build_all.py -- docs/camping-v3/scene-bible.json "$BLEND_OUT"
"$BLENDER_BIN" -b "$BLEND_OUT" -P scripts/blender/validate_blend.py -- docs/camping-v3/scene-bible.json
"$BLENDER_BIN" -b "$BLEND_OUT" -P scripts/blender/export_glb.py -- "$RAW_OUT"
node scripts/verify-glb-contract.mjs "$RAW_OUT" docs/camping-v3/scene-bible.json
