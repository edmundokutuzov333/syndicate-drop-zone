#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
command -v docker >/dev/null 2>&1 || { echo "Install Docker Desktop/Engine first." >&2; exit 2; }
docker build --platform linux/amd64 -t syndicate-blender-ci -f docker/blender-ci/Dockerfile .
docker run --rm --platform linux/amd64 -v "$PWD":/work -w /work syndicate-blender-ci bash scripts/3d/local-build.sh
