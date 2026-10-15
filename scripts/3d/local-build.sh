#!/usr/bin/env bash
# One build route for local, Docker, Codespaces, GitLab and GitHub Actions.
set -uo pipefail
cd "$(dirname "$0")/../.."
OUT=art/_delivery; mkdir -p "$OUT/logs"; : > "$OUT/exit-codes.txt"
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
if [ "${CAMPING_PHASE:-8}" -ge 9 ]; then step brand-assets node scripts/fetch-brand-assets.mjs; fi
step blend npm run 3d:blend
if [ "${CAMPING_PHASE:-8}" -ge 9 ]; then
  BLENDER_BIN="${BLENDER_BIN:-$(command -v blender)}"
  step phase09-check "$BLENDER_BIN" -b art/xoyens-studio.blend --python-exit-code 1 -P scripts/blender/validate_phase09.py -- art/xoyens-studio.phase09.report.json
  step phase09-capture env LIBGL_ALWAYS_SOFTWARE=1 "$BLENDER_BIN" -b art/xoyens-studio.blend --python-exit-code 1 -P scripts/blender/capture_phase09.py -- art/_delivery/phase-09
fi
step blend-check npm run 3d:blend:validate
step frontend-model bash scripts/3d/build-frontend-model.sh
node scripts/3d/pack-delivery.mjs --phase="${CAMPING_PHASE:-8}" || true
step verify node scripts/3d/verify-delivery.mjs . docs/camping-v3/scene-bible.json --phase="${CAMPING_PHASE:-8}"
node scripts/3d/pack-delivery.mjs --phase="${CAMPING_PHASE:-8}" || true
FINAL_CODE=0
node scripts/3d/verify-delivery.mjs . docs/camping-v3/scene-bible.json --phase="${CAMPING_PHASE:-8}" --check-exit-codes || FINAL_CODE=$?
if [ "$FINAL_CODE" -ne 0 ]; then FAILED=$((FAILED+1)); echo "Phase 04 not certified (final verifier exit ${FINAL_CODE})."; fi
echo "===== EXIT CODES ====="; cat "$OUT/exit-codes.txt"
find "$OUT" -maxdepth 1 -type f \( -name 'phase04-delivery-*.zip' -o -name 'phase04-delivery-*.tar.gz' -o -name 'phase04-delivery-*.sha256' \) -exec ls -lh {} \; 2>/dev/null || true
if [ "$FAILED" -eq 0 ] && [ "$FINAL_CODE" -eq 0 ]; then echo "Fase 04 certificável"; exit 0; fi
echo "${FAILED} required step(s) failed; Phase 04 remains open. Evidence packaged when present."
exit 1
