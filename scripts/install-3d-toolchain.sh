#!/usr/bin/env bash
# Reproducible Linux x86_64 installer for CAMPING V3 tooling.
# Versions are pinned intentionally; update only with a reviewed decision.
set -euo pipefail

BLENDER_VERSION="${BLENDER_VERSION:-4.5.14}"
KTX_VERSION="${KTX_VERSION:-4.4.2}"
TOOLS_ROOT="${CAMPING_TOOLS_ROOT:-$HOME/tools}"
BLENDER_ROOT="$TOOLS_ROOT/blender"
KTX_ROOT="$TOOLS_ROOT/ktx"
BLENDER_ARCHIVE="blender-$BLENDER_VERSION-linux-x64.tar.xz"
BLENDER_BASE="https://download.blender.org/release/Blender4.5"
KTX_ARCHIVE="KTX-Software-$KTX_VERSION-Linux-x86_64.tar.bz2"
KTX_URL="https://github.com/KhronosGroup/KTX-Software/releases/download/v$KTX_VERSION/$KTX_ARCHIVE"
KTX_SHA256="a8781bad05f9624edbf910b7f258cd0a4ba7d3e63b49ecc0a0ab440bf6a0a245"

if [[ "$(uname -s)" != "Linux" || "$(uname -m)" != "x86_64" ]]; then
  echo "Este instalador automático suporta Linux x86_64 (CI). Em macOS/ARM, instale Blender >=4.2 e KTX-Software >=4.4 manualmente e use scripts/env.sh." >&2
  exit 2
fi
command -v curl >/dev/null || { echo "curl é obrigatório." >&2; exit 2; }
command -v sha256sum >/dev/null || { echo "sha256sum é obrigatório." >&2; exit 2; }
mkdir -p "$BLENDER_ROOT" "$KTX_ROOT"

blender_ok() {
  command -v blender >/dev/null 2>&1 || return 1
  local version major minor
  version="$(blender --version 2>/dev/null | sed -nE '1s/^Blender ([0-9]+\.[0-9]+\.[0-9]+).*/\1/p')"
  [[ -n "$version" ]] || return 1
  major="${version%%.*}"
  minor="${version#*.}"; minor="${minor%%.*}"
  (( major > 4 || (major == 4 && minor >= 2) ))
}

BLENDER_BIN="$BLENDER_ROOT/blender-$BLENDER_VERSION-linux-x64/blender"
if [[ ! -x "$BLENDER_BIN" ]]; then
  TMP_DIR="$(mktemp -d)"
  trap 'rm -rf "$TMP_DIR"' EXIT
  echo "A transferir Blender $BLENDER_VERSION..."
  curl --fail --location --retry 3 --retry-all-errors "$BLENDER_BASE/$BLENDER_ARCHIVE" -o "$TMP_DIR/$BLENDER_ARCHIVE"
  curl --fail --location --retry 3 --retry-all-errors "$BLENDER_BASE/blender-$BLENDER_VERSION.sha256" -o "$TMP_DIR/blender.sha256"
  CHECKSUM_LINE="$(grep -F "$BLENDER_ARCHIVE" "$TMP_DIR/blender.sha256" | head -n 1 || true)"
  EXPECTED="$(printf '%s\n' "$CHECKSUM_LINE" | grep -Eo '[[:xdigit:]]{64}' | head -n 1 || true)"
  [[ -n "$EXPECTED" ]] || { echo "Não foi possível extrair SHA-256 do manifesto oficial Blender." >&2; exit 2; }
  ACTUAL="$(sha256sum "$TMP_DIR/$BLENDER_ARCHIVE" | awk '{print $1}')"
  [[ "$ACTUAL" == "$EXPECTED" ]] || { echo "SHA-256 do Blender não coincide." >&2; exit 2; }
  tar -xJf "$TMP_DIR/$BLENDER_ARCHIVE" -C "$BLENDER_ROOT"
fi

if [[ ! -x "$BLENDER_BIN" ]]; then
  BLENDER_BIN="$(find "$BLENDER_ROOT" -maxdepth 3 -type f -name blender -perm -u+x -print -quit || true)"
fi
if [[ -x "$BLENDER_BIN" ]]; then export PATH="$(dirname "$BLENDER_BIN"):$PATH"; fi

KTX_BIN_DIR="$KTX_ROOT/KTX-Software-$KTX_VERSION-Linux-x86_64/bin"
if [[ ! -x "$KTX_BIN_DIR/ktx" || ! -x "$KTX_BIN_DIR/toktx" ]]; then
  TMP_DIR="$(mktemp -d)"
  trap 'rm -rf "$TMP_DIR"' EXIT
  echo "A transferir KTX-Software $KTX_VERSION..."
  curl --fail --location --retry 3 --retry-all-errors "$KTX_URL" -o "$TMP_DIR/$KTX_ARCHIVE"
  ACTUAL="$(sha256sum "$TMP_DIR/$KTX_ARCHIVE" | awk '{print $1}')"
  [[ "$ACTUAL" == "$KTX_SHA256" ]] || { echo "SHA-256 do KTX-Software não coincide com a release v$KTX_VERSION." >&2; exit 2; }
  tar -xjf "$TMP_DIR/$KTX_ARCHIVE" -C "$KTX_ROOT"
fi

if [[ -x "$KTX_BIN_DIR/ktx" && -x "$KTX_BIN_DIR/toktx" ]]; then
  export PATH="$KTX_BIN_DIR:$PATH"
else
  KTX_BIN_DIR="$(find "$KTX_ROOT" -type f -name ktx -perm -u+x -printf '%h\n' -quit || true)"
  [[ -n "$KTX_BIN_DIR" && -x "$KTX_BIN_DIR/toktx" ]] || { echo "Não foram encontrados os binários ktx e toktx após extrair KTX-Software." >&2; exit 2; }
  export PATH="$KTX_BIN_DIR:$PATH"
fi

command -v blender >/dev/null || { echo "Blender não está acessível no PATH." >&2; exit 2; }
command -v ktx >/dev/null || { echo "KTX CLI 'ktx' não está acessível no PATH." >&2; exit 2; }
command -v toktx >/dev/null || { echo "KTX CLI 'toktx' não está acessível no PATH." >&2; exit 2; }
blender --version
toktx --version
ktx --version

if [[ -n "${GITHUB_PATH:-}" ]]; then
  printf '%s\n' "$(dirname "$(command -v blender)")" >> "$GITHUB_PATH"
  printf '%s\n' "$(dirname "$(command -v ktx)")" >> "$GITHUB_PATH"
fi
echo "Toolchain base instalada. Para uma shell interactiva, execute: source scripts/env.sh"
