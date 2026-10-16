#!/usr/bin/env bash
# Convert the certified Blender model into the canonical asset consumed by /camping.
set -euo pipefail
cd "$(dirname "$0")/../.."

bash scripts/install-3d-toolchain.sh
[ ! -f scripts/3d/env.sh ] || . scripts/3d/env.sh
KTX_VERSION=$(printenv KTX_VERSION || printf '4.4.2')
TOOLS_ROOT=$(printenv CAMPING_TOOLS_ROOT || printf '%s' "$HOME/tools")
KTX_BIN="$TOOLS_ROOT/ktx/KTX-Software-$KTX_VERSION-Linux-x86_64/bin"
if [ -d "$KTX_BIN" ]; then export PATH="$KTX_BIN:$PATH"; fi
command -v ktx >/dev/null
command -v toktx >/dev/null

mkdir -p art/out/optimized
node scripts/build-3d.mjs art/out/xoyens-studio.raw.glb art/out/optimized
node scripts/verify-glb-contract.mjs art/out/optimized/xoyens-studio.high.glb docs/camping-v3/scene-bible.json --frontend-optimized
node scripts/verify-glb-contract.mjs art/out/optimized/xoyens-studio.mid.glb docs/camping-v3/scene-bible.json --frontend-optimized
node scripts/verify-glb-contract.mjs art/out/optimized/xoyens-studio.low.glb docs/camping-v3/scene-bible.json --frontend-optimized
node scripts/3d/promote-frontend-model.mjs art/out/optimized/xoyens-studio.high.glb public/models/camping/xoyens-studio.glb public/models/camping/xoyens-studio.model.json docs/camping-v3/scene-bible.json
node scripts/verify-glb-contract.mjs public/models/camping/xoyens-studio.glb docs/camping-v3/scene-bible.json --frontend-optimized
node scripts/check-3d-budgets.mjs public/models/camping/xoyens-studio.glb high
if [ "${CAMPING_PHASE:-9}" -ge 14 ]; then
  test -s art/out/xoyens-studio.colliders.glb
  cp art/out/xoyens-studio.colliders.glb public/models/camping/xoyens-studio.colliders.glb
  node scripts/3d/write-public-model-manifest.mjs --phase "${CAMPING_PHASE}" \
    --optimized-dir art/out/optimized \
    --collider art/out/xoyens-studio.colliders.glb \
    --canonical public/models/camping/xoyens-studio.glb \
    --canonical-collider public/models/camping/xoyens-studio.colliders.glb \
    --public-dir public/models/camping \
    --scene-bible docs/camping-v3/scene-bible.json
fi
