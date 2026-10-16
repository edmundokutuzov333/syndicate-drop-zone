# Fase 15 — runtime por tiers e loader do modelo promovido

## Escopo

Esta fase define a seleção determinística de qualidade e o carregamento do modelo
publicado pelo contrato de promoção. O runtime deve consumir `manifest.json`, usar
o artefacto visual hashado correspondente ao tier e ligar os lightmaps KTX2 à UV1
sem substituir silenciosamente o modelo promovido por um GLB legado.

## Entregáveis alocados

- `src/features/camping/v3/quality-tier.ts`: perfis ultra/high/mid/low/pano e
  seleção baseada em WebGL2, GPU, memória, mobile, reduced-motion e Save-Data.
- `src/features/camping/v3/quality-tier.test.ts`: cobertura determinística dos
  perfis e dos fallbacks de acessibilidade/rede/dispositivo.
- `src/features/camping/v3/asset-loader.ts`: leitura do manifest, GLTFLoader com
  KTX2/Meshopt, lightmaps por grupo, UV1/UV2 e descarte completo dos recursos.

## Critério de aceitação

O verificador de qualidade deve passar no CI; o carregador deve obter o caminho
visual do `manifest.json`, tolerar ausência de lightmap como fallback não fatal e
não criar ambiente RoomEnvironment. A integração no motor principal e a prova
pública do modelo promovido ficam registadas nos commits seguintes da fase.

## Desvios/decisões

- O tier ultra reutiliza o artefacto visual high quando o contrato não publica uma
  variante ultra separada; mantém o orçamento ultra no pós-processamento.
- A leitura do manifest usa cache-busting apenas para diagnóstico/debug, enquanto
  os GLB/KTX2 continuam sujeitos ao cache normal do CDN.
