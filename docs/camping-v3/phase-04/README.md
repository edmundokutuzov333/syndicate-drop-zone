# Fase 04: fonte da verdade em Blender

## Comando reproduzível

A partir da raiz do repositório, o pipeline partilhado começa com:

    bash scripts/3d/local-build.sh

O script regista ambiente, logs e código de saída por passo, procura ou instala Blender 4.5.14 através do checksum SHA-256 oficial, executa a validação Scene Bible, constrói o ficheiro .blend, reabre-o num segundo processo Blender, valida a cena guardada, exporta o GLB e verifica o contrato. No fim, tenta empacotar a evidência mesmo quando um passo falha.

A entrada normal do projecto continua disponível:

    npm run 3d:blend

Para validar isoladamente uma cena já gravada:

    npm run 3d:blend:validate

As chamadas que executam Python no Blender usam --python-exit-code 1 para que uma excepção Python não produza um falso código de saída zero. A invocação de reabertura não usa factory startup, porque precisa carregar o .blend guardado.


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

O workflow Runner smoke test verifica se os runners hosted são atribuídos em ubuntu-24.04 e ubuntu-22.04 sem checkout ou instalação. O workflow Build CAMPING 3D chama o mesmo scripts/3d/local-build.sh usado nas rotas locais, Docker, Codespaces e GitLab.

Os runs recentes do smoke test e do build terminam antes do primeiro step com runner_id=0 e steps=[]. Isto comprova uma falha de atribuição anterior à execução, mas não distingue billing, política, quota ou provisionamento. A integração GitHub usada não disponibilizou o conteúdo de Annotations. A classificação permanece UNKNOWN em annotations.json e annotations.txt até obter o texto exacto no GitHub UI ou executar scripts/ci/read-run-annotations.mjs com token autorizado.

A fase continua Em validação. A presença de código, workflow ou sucesso de deploy não substitui a prova de que um Blender real gerou e reabriu o .blend, exportou o GLB e passou os contratos. Nenhum .blend ou GLB fictício foi guardado. O binário verificado só pode ser promovido através de Git LFS real após a certificação.


## Revisão geométrica da Fase 04

A correcção de follow-up orienta o disco de vinil no plano horizontal, reduz a altura construída da cadeira para o envelope métrico, vira o ecrã e as faces das colunas para o interior do estúdio e mantém os 17 quadros numerados dentro da parede. A cena ainda não foi executada em Blender porque os jobs de CI continuam a falhar antes de receber runner; estes ajustes permanecem por confirmar através do artefacto real.


## Material PBR e shading

O helper comum inclui um caminho explícito para mapas color, normal, ORM e height. Cor usa sRGB; dados usam Non-Color. ORM segue R=AO, G=roughness, B=metallic. Um mapa pedido mas ausente interrompe o build. O shading usa arestas sharp por ângulo em Blender 4.x e Weighted Normal. Nesta fase não foram adicionados mapas de terceiros nem decal oficial novo.


## Workflow GitHub Actions

O workflow `.github/workflows/build-3d.yml` corre em pushes à `main` ou manualmente. Usa Ubuntu 24.04 x86_64, Node 22, Python 3.11 e o instalador verificado de Blender 4.5.14/KTX-Software 4.4.2. Corre `npm run 3d:validate`, `npm run 3d:blend` e `npm run 3d:blend:validate`, depois exige os três outputs, valida o report JSON e regista SHA-256. Os logs completos e os artefactos são publicados durante 30 dias; numa falha, publica logs e outputs parciais. Git LFS é instalado/activado no checkout e o atributo de `art/xoyens-studio.blend` é verificado, mas nenhum binário é commitado automaticamente.
