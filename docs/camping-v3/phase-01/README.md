# Fase 01 · Linha de base, instrumentação e harness de fidelidade

## Implementado no código
- API de diagnóstico `window.__SDT3D__` disponível apenas com `?debug3d=1`.
- `ready`, `freeze()`, `metrics()`, `setPose(id)` e `referenceMatch()`.
- Sete poses determinísticas: entrada, produção, fotografia, esquerda, direita, tecto e chão.
- Captura equirectangular do renderer com restauração do estado anterior do renderer em `finally`.
- Comparação CIE Lab por 24 sectores × 3 bandas de elevação.
- Métricas baseadas em `renderer.info`.
- Referência sectorial com SHA-256 do ficheiro original.
- Overlay de QA gated por `?debug3d=1&refmatch=1`.

## Pendente para fechar a fase
1. Copiar o PNG original para `docs/camping-v3/reference/studio-pano.png` sem o publicar em `public/`.
2. Executar o checker do GLB e registar o stdout fresco em `baseline-glb.txt`.
3. Gerar 21 capturas (7 poses × 3 tiers reais), rever visualmente e aprovar os goldens. O runtime actual ainda declara apenas o perfil high; não etiquetar capturas repetidas como tiers diferentes.
4. Correr lint, suite unitária, build e Playwright num runner funcional. A API de jobs do GitHub devolveu execuções falhadas sem passos, e o workspace Lovable recusou execução por falta de créditos.
5. Actualizar este estado com links para a execução, capturas e score real.

## Critério de saída
A Fase 01 só pode passar a concluída quando os cinco pontos acima tiverem evidência. A existência da API, por si só, não certifica a baseline nem a fidelidade visual.
