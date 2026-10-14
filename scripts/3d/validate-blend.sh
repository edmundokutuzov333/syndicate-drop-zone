#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
[ ! -f scripts/3d/env.sh ] || source scripts/3d/env.sh
[ ! -f scripts/env.sh ] || source scripts/env.sh
BLENDER_BIN="${BLENDER_BIN:-blender}"
command -v "$BLENDER_BIN" >/dev/null 2>&1 || { echo "Blender not found: $BLENDER_BIN" >&2; exit 2; }
test -s art/xoyens-studio.blend || { echo "Missing art/xoyens-studio.blend" >&2; exit 2; }
"$BLENDER_BIN" -b art/xoyens-studio.blend --python-exit-code 1 -P scripts/blender/validate_blend.py -- docs/camping-v3/scene-bible.json
