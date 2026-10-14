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
