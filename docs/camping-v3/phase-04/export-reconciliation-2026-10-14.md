# Fase 04: reconciliação da exportação Blender/GLB
Actualizado: 2026-10-14
Branch de referência: main
Fonte de evidência: relatório real do Blender 4.5.14 LTS e GLB produzido no run [38527906358](https://github.com/edmundokutuzov333/syndicate-drop-zone/actions/runs/38527906358).

## Diferenças confirmadas

| Métrica | Cena Blender | GLB visual anterior | Explicação |
|---|---:|---:|---|
| Objectos mesh | 371 | 359 | Os 12 objectos da colecção \`COL_colliders\` eram excluídos deliberadamente do GLB visual. São proxies de colisão, não geometria de apresentação. |
| Materiais | 43 | 38 | Cinco datablocks de material existiam na biblioteca Blender, mas não eram referenciados por primitivas exportadas. O exportador glTF remove materiais não utilizados. |

O relatório Blender regista \`collectionObjects.COL_colliders = 12\`. A inspecção do GLB visual confirmou zero nós com nome \`COL_*\`. Portanto, a diferença de 12 malhas corresponde aos proxies de colisão, não a doze malhas visuais perdidas.

Os cinco materiais que não aparecem no GLB são:

| Material | Uso declarado no Scene Bible | Motivo de ausência no GLB visual |
|---|---|---|
| \`ceramic_red\` | \`prod.headphones\`, caneca vermelha | Não está atribuído a uma primitiva exportada na construção actual. |
| \`glass_mirror\` | \`prod.frame_mirror\`, superfície de espelho | Não existe uma primitiva exportada com este material atribuído. |
| \`led_panel_emissive\` | \`photo.led_panel_1\`, painel LED | A geometria actual usa materiais base; o material emissivo não está ligado a uma primitiva exportada. |
| \`led_warm_emissive\` | \`prod.plank_wall\`, fitas LED | A intenção está declarada, mas não existe uma primitiva exportada com este material atribuído. |
| \`print_official_xoyens\` | \`left.flag_yen\`, símbolo impresso | A superfície impressa ainda não está aplicada como geometria/material exportado; não foi inventado um logótipo substituto. |

Isto não é uma falha de serialização de materiais utilizados. É uma diferença entre a biblioteca/material intent da fonte Blender e os slots efectivamente usados pela geometria construída. A aplicação dos acabamentos e dos assets oficiais fica identificada como trabalho de materiais/detalhe, sem ocultar a diferença nem alterar os contadores históricos.

## Entrega dos colliders

O GLB visual continua separado dos proxies físicos para que a cena de apresentação não renderize caixas invisíveis. O exportador agora produz dois artefactos a partir do mesmo \`.blend\`:

- \`art/out/xoyens-studio.raw.glb\`: apenas a geometria visual; não pode conter nós \`COL_*\`.
- \`art/out/xoyens-studio.colliders.glb\`: apenas objectos da colecção \`COL_colliders\`; cada proxy preserva \`extras.collider\` e o nome \`COL_*\`.

O \`pack-delivery.mjs\` exige os dois GLBs no manifesto. O \`verify-delivery.mjs\` valida a ausência de \`COL_*\` no GLB visual, confirma que o número de colliders coincide com o relatório Blender, exige \`extras.collider\` em todos os proxies e rejeita meshes que não estejam identificadas como \`COL_*\`. O teste de recuperação cobre os casos de sucesso, extras em falta e contagem divergente.

A prova runtime de colisão no renderer é um gate das fases de integração posteriores. Esta entrega prova que os proxies físicos estão presentes no artefacto separado e preservados como metadados, não que já estejam activados no runtime de produção.
