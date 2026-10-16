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

A execução hosted de 14-10-2026 confirmou Blender 4.5.14 LTS, 24.280 triângulos na casca, 112 meshes do módulo shell, 33 meshes na fronteira, zero arestas non-manifold e 3.000 raios com zero misses. O GLB reportou 40 materiais, 391 primitivas, UV0/UV1 nas 391 primitivas e os 17 slots únicos; o GLB de colisões contém os 12 proxies com `extras.collider`. A promoção LFS do .blend e a verificação independente da entrega passaram no [workflow de Fase 06](https://github.com/edmundokutuzov333/syndicate-drop-zone/actions/runs/38548120842).\n\nO workflow também vai guardar capturas reais do ângulo do tecto e da porta principal em `ceiling.png` e `main-door.png`, juntamente com hashes, dimensões e coordenadas fixas. A panorâmica de referência ainda não está versionada em `docs/camping-v3/reference/studio-pano.png`, pelo que a captura automatizada ainda não pode produzir um painel A/B contra esse ficheiro; não se declara essa comparação como feita.


## Ligação obrigatória ao frontend (2026-10-14)

A rota `/camping` carrega `/models/camping/xoyens-studio.glb`; a fonte Blender em `art/out/xoyens-studio.raw.glb` é um intermediário e nunca é servida directamente. O pipeline da Fase 06 gera agora tiers optimizados com KTX2/Basis e Meshopt, verifica IDs/slots, limites de tamanho e orçamentos antes de promover o tier high para a URL canónica do frontend. O manifesto `xoyens-studio.model.json` regista tamanho, contagem de triângulos, extensões e SHA-256 do ficheiro efectivamente publicado.

A entrega falha se o GLB frontend ou os seus metadados não estiverem presentes no manifesto, se os hashes divergirem, se faltar uma extensão de compressão obrigatória ou se os 7 hotspots/17 slots não forem preservados. O runtime usa `KTX2Loader` e `MeshoptDecoder`; adapta os nomes `SDT_*` gerados pelo Blender aos contratos existentes, sem aplicar as correções de composição calibradas para o GLB V2 e sem deslocar novamente os retratos.

A confirmação final do frontend depende do workflow com a versão optimizada carregada no caminho público e de uma asserção Playwright sobre `data-camping-model-version=3`, `campingSceneStatus=ready` e os 17 slots.
