# Fase 04: fonte da verdade em Blender

## Comando reproduzível

A partir da raiz do repositório, com Blender 4.2 ou superior instalado:

    npm run 3d:blend

O comando executa três passos: reconstrói a cena do zero com scripts/blender/build_all.py, valida o ficheiro salvo com validate_blend.py, e exporta art/out/xoyens-studio.raw.glb com export_glb.py. Por fim, scripts/verify-glb-contract.mjs verifica os extras de interação, os 17 slots, os materiais e os atributos TEXCOORD_0/TEXCOORD_1.

Comando directo de reconstrução:

    blender -b -P scripts/blender/build_all.py -- docs/camping-v3/scene-bible.json art/xoyens-studio.blend

## Arquitectura implementada

- common.py: unidades métricas, catálogo de materiais, nomes, tags glTF, UVs, bevels, Weighted Normal e helpers de geometria.
- build_shell.py: casca contínua com quatro paredes, vãos reais para duas portas, folhas/aros, abóbada curva de bambu, 14 costelas e rodapés.
- build_surfaces.py: superfícies de chão e vinil.
- build_production.py: âncoras de secretária, monitor/DAW, monitores de áudio, cadeira, painéis acústicos, teclado e candeeiros.
- build_photo.py: fundo, cabideiro, cinco peças e suportes de iluminação.
- build_sides.py: mural, sofá, bandeira-portadora, estante, quadro e parede de artistas.
- build_props.py: detalhes que herdam posição da respectiva regra de montagem.
- lights.py: cria apenas as fontes de luz declaradas no Scene Bible.
- build_colliders.py: proxies ocultos de colisão, mantendo livres os vãos das portas.
- export_glb.py: exportação com extras e os dois canais UV.
- validate_blend.py e verify-glb-contract.mjs: contratos locais do Blender e do GLB.

Os módulos têm um marcador de propriedade para remover apenas os seus objectos quando forem executados novamente. O orquestrador reinicia sempre a cena e executa a mesma sequência, tornando a construção global determinística.

## Contratos

As colecções requeridas são COL_shell, COL_production, COL_photo, COL_left, COL_right, COL_props e COL_colliders. Malhas visíveis são SDT_<zona>_<objecto>; colisores são COL_<nome>. As malhas têm material atribuído, UVMap com coordenadas métricas (uma unidade UV equivale a um metro para mapas tileable), UV_Lightmap sem sobreposição intencional, escala aplicada e bevel nominal de 1–3 mm onde há arestas visíveis.

Os extras incluem elementId, source, buildModule, zone, collider e lmGroup. Os IDs de interacção de produto mantêm-se. A parede de artistas cria exactamente os slots studio.artist-slot-001 até studio.artist-slot-017 como molduras numeradas vazias. Não cria retratos nem redesenha o selo, o logótipo Xoyens ou as estampas oficiais.

Esta fase estabelece um blockout geométrico em Blender e o pipeline de fonte de verdade. Os objectos de produção e props ainda precisam dos passes de modelação detalhada das Fases 06–11; materiais CC0 em alta resolução entram na Fase 05. Portadores de selo/logótipo continuam neutros até serem ligados às imagens oficiais dos manifestos.

## Evidência e estado

O workflow CAMPING 3D Toolchain compila a sintaxe Python, executa o build, valida .blend, exporta o GLB cru, verifica extras/UVs e carrega os artefactos por 14 dias. O relatório guardado em art/xoyens-studio.report.json inclui versão do Blender, tamanho, tempo, objectos, vértices, polígonos e triângulos estimados.

A fase continua Em validação até existir um runner real e uma execução completa. Um commit de scripts ou o sucesso do deploy Vercel não substitui a prova de que o .blend foi gerado, validado e respeita o limite de 200 MiB. O .blend verificado deve ser guardado através de Git LFS; não criar um ponteiro LFS sem o objecto correspondente.
