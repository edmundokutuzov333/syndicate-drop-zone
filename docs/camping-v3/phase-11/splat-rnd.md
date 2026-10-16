# Fase 11 · Trilho de I&D Gaussian Splats

Estado: **não avaliado**. Esta nota não representa uma execução de benchmark nem uma aprovação.

## Gate obrigatório para considerar splats

- Licença e termos de utilização comercial confirmados.
- Peso final ≤ 25 MB.
- Pelo menos 45 FPS no tier `mid` em browser real, com ambiente e hardware registados.
- `referenceMatchScore` pelo menos 8 pontos acima da malha nos sectores-herói.
- Splats usados apenas como camada visual. A malha arquitectónica continua responsável por colisões e interacção.

Não há nesta passagem artefacto splat, prova de licença, medição de FPS ou score A/B reproduzível. Portanto, não integrar splats no runtime nem afirmar superioridade visual. A execução principal continua com a malha e os seus colliders.

## Validação dos props orgânicos

```bash
blender -b art/xoyens-studio.blend -P scripts/blender/validate_phase11.py -- art/xoyens-studio.phase11.report.json
```

O validador mede triângulos por `elementId`, exige os limites da Scene Bible e regista UVs, materiais e metadados de fonte. Não comprova por si só de-light, ORM completo, alphaTest/alphaToCoverage, translucidez ou fidelidade visual; estes gates exigem inspecção e testes adicionais.
