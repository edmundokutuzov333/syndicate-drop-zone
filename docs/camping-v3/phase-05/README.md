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

## Correcção da execução de 2026-10-14

A primeira execução do workflow identificou que o manifesto guardava caminhos dentro de `materials.staging`, embora os PNG fossem movidos atomicamente para `art/textures/materials`. Isso tornava os mapas aparentemente ausentes na validação Blender, mesmo após a recolha. O gerador agora escreve caminhos finais no manifesto e existe um teste de regressão para garantir que nenhum caminho temporário é publicado. O workflow executa também os testes unitários PBR antes de instalar/construir a cena.

A fase continua aberta até uma execução nova confirmar a recolha real de 2K, os hashes/licenças, a reabertura Blender e todos os gates de entrega.

## Qualidade e determinismo das fontes

A ingestão agora prefere IDs concretos de superfícies Poly Haven por perfil, verifica que cada escolha tem mapas BC e normal 2K e não reutiliza um asset já escolhido quando existem alternativas elegíveis. As preferências incluem madeira envelhecida, bambu tecido, estuque, couro, linho, espuma de poliestireno, metais, algodão, papel, borracha e tecidos de bandeira/softbox. Se uma preferência não disponibilizar os mapas necessários, o fetcher tenta a seguinte e só depois recorre à classificação automática.

O albedo de saída é ajustado por canal à cor-base sRGB especificada para o material na Scene Bible. A transformação conserva a variação espacial da textura e é registada no manifesto com médias de origem/saída, factores aplicados e limites de escala. A normal continua a ser convertida para OpenGL quando a fonte é DirectX; o ORM mantém R=AO, G=roughness e B=metallic. A biblioteca não usa placeholders.

O pacote de artefactos CI exclui os ZIPs de entrega duplicados, mantendo o manifesto de entrega, os mapas individuais, o relatório e os logs necessários para verificação e promoção LFS.

## Certificação Fase 05 · 2026-10-14

**Estado: CONCLUÍDA no pipeline PBR/Blender.**

Evidência reproduzível:
- Build e certificação Blender: [workflow run 38538988505](https://github.com/edmundokutuzov333/syndicate-drop-zone/actions/runs/38538988505), conclusão `success`, incluindo a promoção LFS concluída.
- Manifesto `art/textures/materials.manifest.json`: 20 perfis, IDs e URLs de origem Poly Haven, licença CC0 1.0, hashes SHA-256, mapas e medições de continuidade.
- Biblioteca: 20 conjuntos de materiais; BC, N e ORM 2048×2048 em cada conjunto. Os mapas H opcionais são mantidos quando fornecidos pela origem.
- O log da reabertura da fonte regista Blender 4.5.14 LTS, 371 malhas, 43 materiais e zero erros de contrato; `PBR MATERIAL CONTRACT OK` confirma 20 materiais e três mapas por material.
- O verificador de entrega passou para os artefactos principais e de colisão; os 12 colliders estão no GLB separado com `extras.collider`.
- O commit publicado de certificação Blender é `93dee96cdd41b90e4cdc24c526bbff2fd705714f`. A promoção confirmou o objecto Blender real via Git LFS, sem force-push.
- A publicação Vercel ligada ao mesmo commit está em estado `READY`: [deployment](https://vercel.com/kutuzov/syndicate-drop-zone/7CGmfphfRZdySfaTsNcSkfJfENNG).

**Limite conhecido, fora do gate PBR:** a Camera Production CI continua a falhar nos testes E2E da câmara (timeout no fluxo de media e erro de hidratação React). O workflow específico de construção, reabertura, validação PBR, verificação de entrega e promoção LFS passou. A falha E2E geral não é apresentada como resolvida nem foi mascarada nesta fase.
