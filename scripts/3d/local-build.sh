#!/usr/bin/env bash
# One build route for local, Docker, Codespaces, GitLab and GitHub Actions.
set -uo pipefail
cd "$(dirname "$0")/../.."
OUT=art/_delivery; mkdir -p "$OUT/logs"; : > "$OUT/exit-codes.txt"
PHASE="${CAMPING_PHASE:-9}"
PHASE_PADDED="$(printf '%02d' "$PHASE")"
N=1; FAILED=0
{ echo "commit: $(git rev-parse HEAD 2>/dev/null || echo unknown)"; echo "branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"; echo "dirty_files: $(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')"; echo "platform: $(uname -a)"; echo "node: $(node --version 2>&1)"; echo "npm: $(npm --version 2>&1)"; echo "python3: $(python3 --version 2>&1)"; echo "date_utc: $(date -u +%FT%TZ)"; echo "requested_blender_bin: ${BLENDER_BIN:-auto-detect}"; echo "ci: ${CI:-false}"; echo "runner_os: ${RUNNER_OS:-local}"; echo "runner_arch: ${RUNNER_ARCH:-$(uname -m)}"; } > "$OUT/environment.txt"
step(){ local name="$1"; shift; local informational=0; if [ "${1:-}" = "--informational" ]; then informational=1; shift; fi; local log code; log="$OUT/logs/$(printf '%02d' "$N")-${name}.log"; N=$((N+1)); echo "RUN ${name}"; "$@" 2>&1 | tee "$log"; code=${PIPESTATUS[0]}; printf '%s=%s\n' "$name" "$code" >> "$OUT/exit-codes.txt"; if [ "$code" -ne 0 ]; then if [ "$informational" -eq 1 ]; then echo "INFO: ${name} failed (exit ${code})."; else FAILED=$((FAILED+1)); echo "FAILED ${name} (exit ${code})"; fi; fi; return 0; }
step doctor --informational node scripts/3d/doctor.mjs
if ! node -e "import('./scripts/3d/doctor.mjs').then(m=>process.exit(m.findBlender()?.version===m.BLENDER_VERSION?0:1)).catch(()=>process.exit(1))"; then step install-blender bash scripts/3d/install-blender.sh; fi
# shellcheck disable=SC1091
[ -f scripts/3d/env.sh ] && . scripts/3d/env.sh
step doctor-after-install --informational node scripts/3d/doctor.mjs
step npm-install npm install --legacy-peer-deps --no-audit --no-fund
step recovery-tests node --test scripts/3d/recovery.test.mjs
step py-compile python3 -m py_compile scripts/blender/*.py
step validate npm run 3d:validate
if [ "${CAMPING_PHASE:-9}" -ge 9 ]; then step brand-assets node scripts/fetch-brand-assets.mjs; fi
step blend npm run 3d:blend
if [ "$CAMPING_PHASE" -ge 10 ]; then BLENDER_BIN="$(command -v blender)"; step phase10-check "$BLENDER_BIN" -b art/xoyens-studio.blend --python-exit-code 1 -P scripts/blender/validate_phase10.py -- art/xoyens-studio.phase10.report.json; fi
if [ "$CAMPING_PHASE" -ge 11 ]; then BLENDER_BIN="$(command -v blender)"; step phase11-check "$BLENDER_BIN" -b art/xoyens-studio.blend --python-exit-code 1 -P scripts/blender/validate_phase11.py -- art/xoyens-studio.phase11.report.json; fi
if [ "$CAMPING_PHASE" -ge 12 ]; then
 BLENDER_BIN="$(command -v blender)"
 step phase12-uv2 "$BLENDER_BIN" -b art/xoyens-studio.blend --python-exit-code 1 -P scripts/blender/phase12_lightmaps.py -- --apply art/xoyens-studio.phase12.apply-report.json
 step phase12-reopen-check "$BLENDER_BIN" -b art/xoyens-studio.blend --python-exit-code 1 -P scripts/blender/validate_phase12.py -- art/out/phase12-mesh-areas.json art/xoyens-studio.phase12.report.json
 step phase12-plan node scripts/plan-lightmaps.mjs --input art/out/phase12-mesh-areas.json --scene-bible docs/camping-v3/scene-bible.json --output docs/camping-v3/phase-12/lightmap-plan.md --json-output art/xoyens-studio.phase12.plan.json
fi
if [ "$CAMPING_PHASE" -ge 13 ]; then
  BLENDER_BIN="${BLENDER_BIN:-$(command -v blender)}"
  step phase13-bake "$BLENDER_BIN" -b art/xoyens-studio.blend --python-exit-code 1 -P scripts/blender/bake_lightmaps.py -- art/_delivery/phase-13/bake all
  step phase13-report-copy cp art/xoyens-studio.phase13.report.json art/_delivery/phase-13/bake-report.json
  step phase13-bake-verify node scripts/3d/verify-lightmap-bakes.mjs --root . --report art/_delivery/phase-13/bake-report.json
  step phase13-bake-tests node --test scripts/3d/phase13-bake.test.mjs
fi
if [ "${CAMPING_PHASE:-9}" -ge 9 ]; then

  BLENDER_BIN="${BLENDER_BIN:-$(command -v blender)}"
  step phase09-check "$BLENDER_BIN" -b art/xoyens-studio.blend --python-exit-code 1 -P scripts/blender/validate_phase09.py -- art/xoyens-studio.phase09.report.json
  step phase09-capture env LIBGL_ALWAYS_SOFTWARE=1 "$BLENDER_BIN" -b art/xoyens-studio.blend --python-exit-code 1 -P scripts/blender/capture_phase09.py -- art/_delivery/phase-09
fi
step blend-check npm run 3d:blend:validate
step frontend-model bash scripts/3d/build-frontend-model.sh
# The optimized candidate is now at the canonical public URL. Run the same
# frontend gates required by the superprompt before the publish job can commit it.
# Formatting-only Prettier findings are warnings; semantic ESLint violations remain blocking.
step frontend-lint npm run lint
step frontend-tests npm run test
step frontend-build npm run build
step package node scripts/3d/pack-delivery.mjs --phase="${CAMPING_PHASE:-9}"
step verify node scripts/3d/verify-delivery.mjs . docs/camping-v3/scene-bible.json --phase="${CAMPING_PHASE:-9}"
step package node scripts/3d/pack-delivery.mjs --phase="${CAMPING_PHASE:-9}"
FINAL_CODE=0
node scripts/3d/verify-delivery.mjs . docs/camping-v3/scene-bible.json --phase="${CAMPING_PHASE:-9}" --check-exit-codes || FINAL_CODE=$?
if [ "$FINAL_CODE" -ne 0 ]; then FAILED=$((FAILED+1)); echo "Phase ${PHASE_PADDED} not certified (final verifier exit ${FINAL_CODE})."; fi
echo "===== EXIT CODES ====="; cat "$OUT/exit-codes.txt"
find "$OUT" -maxdepth 1 -type f \( -name "phase${PHASE_PADDED}-delivery-*.zip" -o -name "phase${PHASE_PADDED}-delivery-*.tar.gz" -o -name "phase${PHASE_PADDED}-delivery-*.sha256" \) -exec ls -lh {} \; 2>/dev/null || true
if [ "$FAILED" -eq 0 ] && [ "$FINAL_CODE" -eq 0 ]; then echo "Fase ${PHASE_PADDED} certificável"; exit 0; fi
echo "${FAILED} required step(s) failed; Phase ${PHASE_PADDED} remains open. Evidence packaged when present."
exit 1
