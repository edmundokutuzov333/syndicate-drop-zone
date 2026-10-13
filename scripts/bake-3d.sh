#!/usr/bin/env bash
# Entrada estável declarada na Fase 02; o bake real é entregue nas Fases 04 e 13.
set -euo pipefail
BLEND_FILE="${1:-${CAMPING_BLEND_FILE:-art/xoyens-studio.blend}}"
OUT_DIR="${2:-${CAMPING_BAKE_DIR:-art/bake}}"
TIER="${3:-${CAMPING_BAKE_TIER:-high}}"

if [[ ! -f "$BLEND_FILE" ]]; then
  echo "Cena Blender em falta: $BLEND_FILE. A fonte da verdade é criada na Fase 04; nenhum bake foi executado." >&2
  exit 2
fi
if [[ ! -f scripts/blender/bake_lightmaps.py ]]; then
  echo "scripts/blender/bake_lightmaps.py ainda não está no repositório; o bake pertence à Fase 13." >&2
  exit 2
fi
case "$TIER" in high|mid|ultra) ;; *) echo "Tier inválido: $TIER (high, mid ou ultra)" >&2; exit 2 ;; esac
source scripts/env.sh
exec blender -b "$BLEND_FILE" -P scripts/blender/bake_lightmaps.py -- "$OUT_DIR" "$TIER"
