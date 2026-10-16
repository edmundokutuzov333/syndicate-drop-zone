# Fase 16 — pipeline de cor, pós-processamento e luzes físicas

## Entregáveis

- `src/features/camping/v3/render-pipeline.ts` configura saída sRGB, render target
  HalfFloat e a cadeia RenderPass → bloom → AGX → vignette → noise → SMAA.
- `src/features/camping/v3/lights-runtime.ts` converte lúmens/Kelvin para luzes
  físicas Three.js com identificação estável e descarte seguro.

## Decisões

- O renderer fica em `NoToneMapping`; a conversão AGX ocorre uma única vez no
  `EffectPass`, evitando dupla transformação de exposição.
- Bloom, SMAA e noise são opcionais por tier; o pipeline mantém sempre o RenderPass
  e o tone mapping para que low/pano tenham uma saída previsível.
- A integração no `CampingStudioEngine` deve substituir progressivamente o
  `RoomEnvironment` pelo IBL equirect baked da fase 13. A prova de referência,
  FPS e draw calls será anexada ao relatório público depois do commit de integração.
