# Fase 05 - Biblioteca de materiais PBR CC0 2K

Estado: em validação até terminar o workflow real do Blender, o manifesto e a CI aplicável. A fonte é a API oficial Poly Haven; os IDs exactos são escolhidos durante a execução e guardados no manifesto.

## Artefactos
- scripts/fetch-cc0-materials.mjs procura assets de textura e lê o endpoint /files/<id>, seleccionando mapas 2K reais.
- scripts/validate-pbr-materials.mjs valida dimensões, assinatura PNG, SHA-256, CC0, URL, cobertura e métrica de continuidade de bordas.
- art/textures/materials.manifest.json guarda IDs, autores, proveniência, licenças, hashes de origem/saída, convenção de canais e medições.
- scripts/blender/common.py associa os perfis da Scene Bible aos mapas antes da construção da geometria.
- scripts/blender/validate_blend.py reabre a fonte e exige imagens 2048² em cada material PBR.
- .gitattributes envia os mapas para Git LFS; o build restaura apenas os mapas necessários e não descarrega o .blend anterior.

## Execução e gates
1. npm run 3d:materials:fetch
2. npm run 3d:materials:validate
3. npm run 3d:validate
4. npm run 3d:blend
5. npm run 3d:blend:validate
6. node scripts/3d/verify-delivery.mjs . docs/camping-v3/scene-bible.json --check-exit-codes

A ingestão não gera placeholders. Se a API não devolver material elegível em 2K, se faltarem mapas ou a continuidade das bordas exceder o limite, a build falha. A métrica de tileability é uma verificação automatizada, não uma declaração de inspecção humana. A tabela de licença é escrita a partir dos IDs exactos depois da recolha.

O runtime público continua a carregar public/models/camping/xoyens-studio.glb. A conversão KTX2/Meshopt e a ligação ao runtime são trabalho das fases posteriores. Evidência de fecho: run completo, manifesto, hashes, códigos validate/blend/blend-check/verify e CI aplicável aprovado.
