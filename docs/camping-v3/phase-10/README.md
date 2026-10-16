# Fase 10 · Zonas esquerda e direita

Estado: implementação iniciada, não certificada.

O Scene Bible v3 já define os elementos `left.mural_print`, `left.roller_white`, `left.flag_yen`, `left.sofa_tufted`, `right.shelf_unit` e `right.painting`. O construtor `scripts/blender/build_sides.py` instancia os elementos `left.*` e `right.*` a partir desse contrato.

## Gate de validação da fonte

Depois de construir e guardar o ficheiro Blender real:

```bash
blender -b art/xoyens-studio.blend -P scripts/blender/validate_phase10.py -- art/xoyens-studio.phase10.report.json
```

O relatório valida a presença dos seis elementos, malhas associadas e datablocks dos materiais exigidos. As dimensões medidas são registadas para auditoria, mas não são tratadas como prova de fidelidade por si só.

## Ainda por demonstrar

- execução real do validador em Blender 4.5.x;
- verificação geométrica dos detalhes do sofá, bandeira, estante e fixações;
- capturas visuais comparadas com a referência;
- gate CI da Fase 10 e verificação do modelo servido em produção;
- certificação e actualização posterior do estado.

A fase pode avançar para trabalho subsequente sem declarar estes gates como aprovados. Não altera IDs de artista, contratos backend, colliders ou o GLB público.
