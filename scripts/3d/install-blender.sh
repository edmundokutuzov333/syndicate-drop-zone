#!/usr/bin/env bash
# Installs Blender 4.5.14 with the official SHA-256 manifest.
set -euo pipefail
VERSION="${BLENDER_VERSION:-4.5.14}"
SERIES="${VERSION%.*}"
DEST="${BLENDER_HOME:-$HOME/tools}"
BASE="https://download.blender.org/release/Blender${SERIES}"
OS="$(uname -s)"; ARCH="$(uname -m)"
die(){ echo "ERROR: $*" >&2; exit 1; }
case "${OS}-${ARCH}" in
 Linux-x86_64) FILE="blender-${VERSION}-linux-x64.tar.xz" ;;
 Darwin-arm64) FILE="blender-${VERSION}-macos-arm64.dmg" ;;
 Darwin-x86_64) FILE="blender-${VERSION}-macos-x64.dmg" ;;
 *) die "Unsupported platform ${OS}-${ARCH}; use Linux x64, macOS, WSL2, or Docker." ;;
esac
TARGET="${DEST}/blender-${VERSION}"
if [ "$OS" = Linux ]; then BIN="${TARGET}/blender"; else BIN="${TARGET}/Blender.app/Contents/MacOS/Blender"; fi
mkdir -p "${DEST}/_dl"
if [ ! -x "$BIN" ] || ! "$BIN" --version 2>/dev/null | head -1 | grep -Fq "Blender ${VERSION}"; then
 ARCHIVE="${DEST}/_dl/${FILE}"; SUMS="${DEST}/_dl/blender-${VERSION}.sha256"
 echo "Downloading Blender ${VERSION} for ${OS}-${ARCH}..."
 curl -fL --retry 5 --retry-delay 3 -o "$ARCHIVE" "${BASE}/${FILE}" || die "download failed; check DNS/network or use Docker/Codespaces."
 curl -fsSL --retry 3 -o "$SUMS" "${BASE}/blender-${VERSION}.sha256" || die "could not get official checksum manifest."
 EXPECTED="$(grep -F "$FILE" "$SUMS" | grep -Eo '[[:xdigit:]]{64}' | head -1 || true)"
 [ -n "$EXPECTED" ] || die "checksum not found in official manifest."
 if command -v sha256sum >/dev/null 2>&1; then ACTUAL="$(sha256sum "$ARCHIVE" | awk '{print $1}')"; else ACTUAL="$(shasum -a 256 "$ARCHIVE" | awk '{print $1}')"; fi
 [ "$EXPECTED" = "$ACTUAL" ] || die "SHA-256 mismatch."
 echo "Verified SHA-256: ${ACTUAL}"
 rm -rf "$TARGET"; mkdir -p "$TARGET"
 if [ "$OS" = Linux ]; then
   tar -xJf "$ARCHIVE" -C "$DEST"; EXTRACTED="${DEST}/blender-${VERSION}-linux-x64"
   [ -x "${EXTRACTED}/blender" ] || die "unexpected extraction path."
   rm -rf "$TARGET"; mv "$EXTRACTED" "$TARGET"
 else
   MOUNT="$(mktemp -d)"; hdiutil attach -nobrowse -readonly -mountpoint "$MOUNT" "$ARCHIVE" >/dev/null
   cp -R "$MOUNT/Blender.app" "$TARGET/"; hdiutil detach "$MOUNT" >/dev/null
   xattr -dr com.apple.quarantine "$TARGET/Blender.app" 2>/dev/null || true
 fi
fi
[ -x "$BIN" ] || die "Blender binary not found: ${BIN}"
"$BIN" --version | head -1 | grep -Fq "Blender ${VERSION}" || die "installed version mismatch."
if [ "$OS" = Linux ] && command -v ldd >/dev/null 2>&1; then MISSING="$(ldd "$BIN" 2>/dev/null | grep 'not found' || true)"; [ -z "$MISSING" ] || echo "Missing libraries (install the Ubuntu system dependencies documented in RECOVERY.md):\n$MISSING"; fi
cat > "$(dirname "$0")/env.sh" <<ENV
export BLENDER_BIN="${BIN}"
export PATH="$(dirname "$BIN"):\$PATH"
ENV
echo "Installed: ${BIN}"
echo "Run: source scripts/3d/env.sh"
