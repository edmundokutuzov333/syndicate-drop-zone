# Fase 06 · Casca arquitectónica fechada

Estado: em validação até a pipeline reconstruir e reabrir a fonte Blender e passar os contratos geométricos e da entrega.

## Implementação

A casca é construída pelo módulo existente \`scripts/blender/build_shell.py\`, a partir de \`docs/camping-v3/scene-bible.json\`. As dimensões vêm de \`metricPlan.room\` e \`metricPlan.enclosure\`; a fase não altera a escala humana nem substitui os restantes módulos.

- Quatro paredes estruturais com espessura definida pelo Scene Bible; os dois vãos mantêm portas modeladas e uma selagem posterior.
- Abóbada de bambu com superfícies interior/exterior e caps de fecho.
- Duas costelas principais de madeira com secção 60×120 mm e catorze secundárias de 40×80 mm, com fixações metálicas.
- Portas com moldura e painel recuado, aro, ferragens, puxador, fechadura, dobradiças e soleira.
- AC split com nove lamelas, visor e indicador; conduta PVC curva de 16 mm com ramificações; duas tomadas e interruptor.
- Rodapés interrompidos nos vãos, cove/lancil, shadow gaps de 6 mm e soffit integrado no canto posterior.

Todos os meshes passam pelo helper de acabamento existente para receber material, UVMap, UV_Lightmap, normais e propriedades glTF. A limpeza continua limitada a objectos \`buildModule=shell\`; os módulos de produção, fotografia, zonas laterais, props e colliders não são substituídos.

## Gates de reabertura

\`scripts/blender/validate_shell.py\` é chamado pelo validador da fonte reaberta. Confirma a presença dos IDs \`arch.*\`, 2 costelas principais e 14 secundárias, 18.000–25.000 triângulos de casca, zero arestas non-manifold na fronteira e 3.000 ray casts determinísticos: 1.000 direcções a partir de cada um de três pontos interiores, contra um BVH da fronteira (não dos props decorativos).

Esta página receberá os números reais do relatório quando o workflow terminar. A fase só pode ser certificada depois de a construção, reabertura, verificação GLB/colliders, checksums e publicação Git LFS passarem.
