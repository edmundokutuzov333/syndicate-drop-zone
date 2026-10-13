#!/usr/bin/env bash
# Source this file from the repository root or any child directory:
#   source scripts/env.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TOOLS_ROOT="\${CAMPING_TOOLS_ROOT:-$HOME/tools}"
export CAMPING_REPO_ROOT="$REPO_ROOT"
for candidate in "$TOOLS_ROOT"/blender/blender-*-linux-x64 "$TOOLS_ROOT"/blender; do
  if [[ -x "$candidate/blender" ]]; then export PATH="$candidate:$PATH"; break; fi
done
for candidate in "$TOOLS_ROOT"/ktx/KTX-Software-*-Linux-x86_64/bin "$TOOLS_ROOT"/ktx/bin; do
  if [[ -x "$candidate/ktx" && -x "$candidate/toktx" ]]; then export PATH="$candidate:$PATH"; break; fi
done
unset SCRIPT_DIR REPO_ROOT TOOLS_ROOT candidate
