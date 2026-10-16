#!/usr/bin/env bash
# Shared cross-platform Blender installer, with the pinned KTX toolchain retained on Linux x86_64.
set -euo pipefail
cd "$(dirname "$0")/.."
bash scripts/3d/install-blender.sh
[ ! -f scripts/3d/env.sh ] || source scripts/3d/env.sh
[ ! -f scripts/env.sh ] || source scripts/env.sh
OS="$(uname -s)"; ARCH="$(uname -m)"
if [[ "$OS" != Linux || "$ARCH" != x86_64 ]]; then
  echo "Blender installed. KTX-Software installation is skipped on $OS-$ARCH; it is not required for Phase 04."
  exit 0
fi
KTX_VERSION="${KTX_VERSION:-4.4.2}"
TOOLS_ROOT="${CAMPING_TOOLS_ROOT:-$HOME/tools}"
KTX_ROOT="$TOOLS_ROOT/ktx"
ARCHIVE="KTX-Software-$KTX_VERSION-Linux-x86_64.tar.bz2"
URL="https://github.com/KhronosGroup/KTX-Software/releases/download/v$KTX_VERSION/$ARCHIVE"
EXPECTED_SHA256="a8781bad05f9624edbf910b7f258cd0a4ba7d3e63b49ecc0a0ab440bf6a0a245"
KTX_BIN_DIR="$KTX_ROOT/KTX-Software-$KTX_VERSION-Linux-x86_64/bin"
mkdir -p "$KTX_ROOT"
if [[ ! -x "$KTX_BIN_DIR/ktx" || ! -x "$KTX_BIN_DIR/toktx" ]]; then
  TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
  curl --fail --location --retry 3 --retry-all-errors "$URL" -o "$TMP/$ARCHIVE"
  ACTUAL="$(sha256sum "$TMP/$ARCHIVE" | awk '{print $1}')"
  [[ "$ACTUAL" == "$EXPECTED_SHA256" ]] || { echo "KTX SHA-256 mismatch." >&2; exit 2; }
  tar -xjf "$TMP/$ARCHIVE" -C "$KTX_ROOT"
fi
[[ -x "$KTX_BIN_DIR/ktx" && -x "$KTX_BIN_DIR/toktx" ]] || { echo "KTX tools missing after extraction." >&2; exit 2; }
export PATH="$KTX_BIN_DIR:$PATH"
ktx --version
toktx --version
if [[ -n "${GITHUB_PATH:-}" ]]; then printf '%s\n' "$(dirname "$(command -v ktx)")" >> "$GITHUB_PATH"; fi
