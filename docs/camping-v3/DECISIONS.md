# CAMPING V3 · Decisões técnicas

## 2026-10-13 · Fase 01

### D001 · Preservar o runtime existente
A instrumentação é adicionada ao `CampingStudioEngine` e só fica exposta quando a URL contém `?debug3d=1`. O modo normal não deve publicar `window.__SDT3D__`, mostrar overlays de QA ou mudar o comportamento de exploração.

### D002 · Poses determinísticas sem substituir o controlador
As sete poses são `entrada`, `producao`, `foto`, `esquerda`, `direita`, `tecto` e `chao`. As poses são aplicadas apenas quando o modelo está carregado, o utilizador entrou na fase `EXPLORATION` e a sala actual é `studio`. Esta restrição impede que a QA contorne o acesso 808.

### D003 · Referência e privacidade
A panorâmica original mede 1774×887 e tem SHA-256 `998f637c62fad46c1459a0c85c99db79f2f799951b9d2c4c38b659ad2e193813`. O ficheiro `reference-sectors.json` contém estatísticas CIE Lab para 24 sectores de azimute × 3 bandas de elevação. É um baseline útil, mas não substitui o PNG para A/B visual. O PNG deve permanecer em `docs/camping-v3/reference/`, nunca em `public/`.

### D004 · Métricas do renderer
As métricas usam `renderer.info`: triângulos, draw calls, geometrias e texturas. A estimativa de memória de textura é uma estimativa, não uma leitura exacta de memória GPU do browser. O FPS é calculado a partir dos frames observados e só é válido depois de uma janela estável.

### D005 · Estado inicial do GLB
A especificação original regista 13.366 triângulos, 150 primitivas, 26 materiais, 15 imagens (13 embebidas, todas 32×32 ou 64×64) e tamanho de aproximadamente 1,26 MB. UV1, KTX2/Basis e Meshopt estão ausentes. A baseline prevista tem quatro violações: textura mínima, UV1, KTX2 e Meshopt. Não alterar os orçamentos para esconder estas falhas.

### D006 · Sem mudança de renderer nesta fase
A Fase 01 mede o renderer de produção actual. Não instala pós-processamento, não troca o motor de colisões, não activa tiers novos e não altera backend, rotas ou políticas RLS. Essas mudanças pertencem às fases correspondentes.

### D007 · Gate reproduzível de baseline
Foi adicionado `scripts/check-3d-baseline.mjs` e o comando `npm run check:camping-baseline`. O gate executa `scripts/check-3d-budgets.mjs` e passa apenas se encontrar exactamente as quatro falhas históricas previstas: dimensão mínima de textura, UV1, KTX2/Basis e Meshopt. Não altera o modelo nem os budgets. O CI executa este gate depois da validação do Scene Bible.

### D008 · Estado de execução
A última série de workflows em `main` terminou com falha e sem passos de execução expostos pela API de jobs. O estado é inconclusivo quanto à causa. A validação local de comandos e o browser ainda têm de ser executados num ambiente com dependências e Chromium disponíveis.

### D009 · Histórico e publicação
Todo o trabalho permanece em `main`; não fazer force-push, rebase, amend ou squash de commits publicados. Antes de qualquer alteração estrutural, voltar a ler rotas, motor 3D, contratos de objectos, Control Room e configuração CI.

## 2026-10-13 · Fase 02

### D010 · Versões fixas da toolchain JavaScript
O manifesto fixa postprocessing 6.39.5, n8ao 2.0.1, three-mesh-bvh 0.9.16, detect-gpu 5.0.70, glTF Transform 4.5.1, meshoptimizer 1.3.0, sharp 0.35.4 e ktx-parse 2.0.0. A versão existente de @playwright/test foi mantida. A adição das dependências não liga automaticamente os novos passes ao renderer de produção.

### D011 · Ferramentas de sistema fixas e verificadas
O instalador para Linux x86_64 usa Blender 4.5.14 e KTX-Software 4.4.2. A distribuição Blender é comparada com o manifesto SHA-256 oficial; o arquivo KTX é verificado pelo digest SHA-256 da release v4.4.2. Os binários são instalados em ~/tools e não são versionados no repositório. O ambiente pode carregar esses caminhos com scripts/env.sh.

### D012 · Basis gerado a partir do Three instalado
Os ficheiros basis_transcoder.js e basis_transcoder.wasm são copiados de node_modules/three/examples/jsm/libs/basis para public/basis em predev e prebuild. Não se guardam cópias manuais nem binários desfasados no Git. A build falha se a versão instalada de Three não contiver ambos os ficheiros.

### D013 · Lockfile e validação pendente
O repositório contém bun.lock, mas o CI existente instala com npm install --legacy-peer-deps e não tem package-lock.json. Não editar bun.lock manualmente. Este commit não declara o lockfile reconciliado: a Fase 02 só fecha depois de um gestor de pacotes suportado regenerar e validar o lockfile, e os workflows confirmarem a instalação sem erros de peer dependencies. A ausência de runner nas execuções anteriores torna a validação do CI uma condição explícita, não presumida.

### D014 · Limites de activação
Blender, KTX e glTF Transform ficam preparados para o pipeline de assets. postprocessing, n8ao e three-mesh-bvh estão apenas declarados e verificados como dependências; não foram ligados ao renderer, colisões ou navegação nesta fase. Real-ESRGAN fica adiado até existir uma tarefa real de upscale de placeholders na fase de props, nunca para substituir assets de marca oficiais. A fase permanece em validação até existirem resultados reais.


## 2026-10-13 · Fase 03

### D015 · Planta útil e origem métrica
A planta-alvo usa dimensões interiores livres de 7,60 × 5,60 m, origem no centro do chão, +Y vertical, chão acabado em y=0 e +Z a apontar para a parede de entrada. As faces interiores ficam em x=±3,80 m e z=±2,80 m. As paredes têm 0,14 m de espessura; o envelope exterior alvo é 7,88 × 5,88 m. A abóbada tem arranque a 2,85 m e coroa a 3,45 m, com flecha de 0,60 m.

### D016 · Enclosure e portas
A planta declara quatro paredes: back, front, left e right. Os dois vãos são explícitos e cada um tem uma folha fechada no plano. A parede negra é uma sobreposição de acabamento sobre uma parede estrutural contínua, não uma abertura. O rodapé percorre os quatro lados (26,4 m). O soalho tem a superfície superior em y=0.

### D017 · Âncoras de escala e composição
As âncoras humanas verificáveis são: porta 2,04 m, tampo da secretária 0,75 m, monitor de 27 polegadas 0,62 × 0,37 m, cadeira 1,15 m, cabideiro 1,70 m e tripé de luz 2,00 m. A câmara de calibração começa em (0, 1,45, 0), orientada para -Z. As coordenadas do metricPlan são alvos de composição para A/B, não uma declaração de levantamento fotogramétrico; os sectores angulares da referência continuam preservados.

### D018 · Detalhes de montagem e orçamento
Foram acrescentados elementos para tomadas, interruptor, cabos de alimentação/áudio, parafusos e anilhas, etiquetas técnicas, ferragens das quatro gaiolas, vincos do papel fotográfico, palas do LED, rodízios e cabo da fita LED da estante. Estes detalhes não adicionam fontes de luz. Orçamento total actual: 221 710 triângulos estimados, inferior ao limite high de 260 000. Nenhum asset de terceiros novo foi adicionado e os activos oficiais permanecem nos manifestos existentes.

### D019 · Desvio do runtime legado
O ficheiro public/models/camping/xoyens-studio.model.json ainda descreve bounds publicados de 14,2 × 9,2 m, parede 3,2 m e coroa 4,35 m; as colisões usam aproximadamente x=±6,55 e z=-4,18…4,08. Não alterar estes valores nesta fase, porque descrevem o runtime legado existente. A casca/GLB e colisões devem convergir para o plano 7,6 × 5,6 m nas fases de Blender/modelação/runtime, com testes de navegação, porta, colisões e regressão visual. Esta diferença não pode ser escondida ou declarada como já resolvida.


## 2026-10-13 · Fase 04

### D020 · Blender é a fonte da verdade
A origem editável da geometria passa a ser scripts/blender/*.py + docs/camping-v3/scene-bible.json, com saída para art/xoyens-studio.blend. O GLB é apenas um artefacto de exportação e nunca é editado manualmente. O orquestrador lê o Scene Bible, reinicia a cena, executa os módulos por ordem e recusa gravar se o contrato falhar ou se o build exceder 600 segundos/200 MiB.

### D021 · Colecções, nomes e extras
A cena mantém COL_shell, COL_production, COL_photo, COL_left, COL_right, COL_props e COL_colliders. A geometria visível usa nomes SDT_<zona>_<objecto>; a geometria de colisão usa COL_<nome> e não entra no GLB visível. Cada malha recebe material, UVMap métrico, UV_Lightmap independente, escala aplicada, bevel de 1–3 mm quando visível e Weighted Normal. Os extras incluem elementId/source/buildModule e os campos zone, collider e lmGroup; interactionId só aparece em contratos reais do Scene Bible.

### D022 · IDs e artistas
Os sete IDs existentes de interacção são preservados. A parede de artistas tem exactamente 17 slots numerados com interactionId studio.artist-slot-001…017, sem retratos inventados. O conteúdo fotográfico vem do backend; os quadros ficam vazios até o runtime os ligar aos dados publicados.

### D023 · Identidade de marca e assets em falta
Não foi criado nenhum logótipo, selo ou estampa de substituição. As superfícies para print_official_seal e print_official_xoyens são apenas portadoras neutras, marcadas como pendentes de aplicação do manifesto oficial durante as fases de materiais e props. A imagem de referência fornecida não é copiada para public/ nem utilizada para inventar retratos.

### D024 · Colisões e exportação
Os proxies COL_* ficam na colecção COL_colliders, com renderização/visibilidade ocultas e UVs/materiais válidos para o ficheiro de origem. O exportador GLB exclui essa colecção de geometria visível, mantendo os extras das malhas interactivas. O verificador Node exige os IDs, 17 slots, material e TEXCOORD_0/TEXCOORD_1.

### D025 · Artefacto binário e evidência
O workflow gera art/xoyens-studio.blend, art/xoyens-studio.report.json e art/out/xoyens-studio.raw.glb e carrega-os como artefactos de CI por 14 dias. Os padrões art/**/*.blend e art/bake/**/*.exr usam Git LFS. A Fase 04 continua aberta até haver um runner real, build/validação bem-sucedidos e decisão explícita de commit do .blend verificado; não criar um ponteiro LFS sem o objecto binário correspondente.


### D026 · Orientação e proporção do blockout
A revisão pós-commit da Fase 04 corrigiu a orientação do vinil para ficar no plano XZ com espessura vertical, limitou a cadeira a aproximadamente 1,11 m de geometria visível (dentro do envelope de referência de 1,15 m), orientou ecrã/cones/teclas para a zona de utilização e espaçou os 17 quadros dentro da área útil da parede. Estes ajustes corrigem erros de geometria evidentes no blockout; não substituem o teste Blender headless, ainda bloqueado pela ausência de runner.


### D027 · Material helper and angle-based shading
O helper PBR aceita mapas opcionais color/sRGB, normal/Non-Color, ORM/Non-Color (R=AO, G=roughness, B=metallic) e height/Non-Color. Falha explicitamente se uma textura pedida não existir. Os mapas oficiais/CC0 só entram com manifestos nas fases seguintes. Em Blender 4.x, o equivalente prático a Auto Smooth marca arestas sharp segundo o ângulo e mantém Weighted Normal, sem depender da propriedade antiga removida.


### D028 · Ferragens e portabilidade do build
O puxador das portas usa eixo horizontal para representar a alavanca, e os verificadores de sintaxe chamam explicitamente python3 para não depender da existência do alias python no runner Ubuntu. Isto reduz diferenças entre ambientes sem alterar as APIs públicas.


### D029 · Workflow de build Blender headless
O workflow canónico para a fonte Blender é `.github/workflows/build-3d.yml`. Corre em `ubuntu-24.04` (Linux x86_64), configura Node 22/Python 3.11, valida/activa Git LFS local, instala a toolchain fixa, executa os quatro comandos exigidos pela Fase 04 e guarda logs completos e artefactos. O antigo workflow CAMPING 3D Toolchain fica manual para evitar executar dois downloads/builds pesados no mesmo push. Não há commit automático do `.blend`: o artefacto de CI tem de ser validado primeiro e a promoção via LFS é uma acção separada.


## 2026-10-14 · Recuperação da Fase 04-R

### D030 · Diagnóstico de runners permanece UNKNOWN até ler a anotação
As consultas de jobs confirmam a assinatura `runner_id=0`, `runner_name=""` e `steps=[]` nas execuções 38378115395 (job 115231891106) e 38423793670 (job 115387875010). A API de jobs, por si só, confirma que nenhum passo foi iniciado, mas não distingue bloqueio de billing, política, quota ou falha de provisionamento. A tentativa de consultar as anotações pela integração GitHub disponível foi recusada pelo acesso ao endpoint; o ambiente de execução também não tem `GITHUB_TOKEN`. Por isso a classificação registada é `UNKNOWN`, não `BILLING_BLOCK`. O passo obrigatório seguinte é recolher o texto real de Annotations no GitHub UI ou executar `scripts/ci/read-run-annotations.mjs` com um token autorizado. A Fase 04 mantém-se aberta.


## 2026-10-14 · Recuperação Fase 04-R

### D031 · Diagnóstico de runner permanece UNKNOWN até existir anotação real
Os metadados de jobs confirmam runner_id=0, nome de runner vazio e steps=[] em runs recentes, pelo que nenhum passo foi iniciado. A integração GitHub disponível não devolveu o conteúdo de Annotations; sem esse texto, billing, política, quota e falha de provisionamento são hipóteses, não causas confirmadas. O script read-run-annotations.mjs recolhe a anotação exacta quando executado com token autorizado. A Fase 04 permanece aberta até esse diagnóstico e uma execução Blender real.

### D032 · Uma entrada de build, cinco rotas de execução
Local, Docker, Codespaces, GitLab e GitHub Actions invocam scripts/3d/local-build.sh. Esta entrada regista logs e códigos de saída, reabre o .blend numa segunda invocação Blender, empacota apenas ficheiros realmente gerados e chama o verificador estrito. A certificação depende do verificador terminar com código zero; a existência dos scripts ou dos workflows não é prova de build.


## 2026-10-14 · Certificação real da Fase 04

### D033 · Runner atribuído e build Blender executado
A execução [Build CAMPING 3D - Fase 04 #38527906358](https://github.com/edmundokutuzov333/syndicate-drop-zone/actions/runs/38527906358), sobre o commit de build `e40d013526e23162782c9ab0404228226022b6bd`, recebeu runner real e passou o workflow. Foi instalada a distribuição oficial Blender 4.5.14 LTS com SHA-256 verificado. A pipeline partilhada construiu `art/xoyens-studio.blend`, reabriu-o numa segunda invocação, exportou `art/out/xoyens-studio.raw.glb`, validou a Scene Bible e passou o verificador de entrega. Esta decisão supersede os estados de pré-execução registados em D030–D032; a causa exacta das falhas históricas de atribuição ainda permanece UNKNOWN por falta do texto original de Annotations.

### D034 · Correcções de causa-raiz encontradas por execução
A primeira execução com runner revelou um `IndentationError` em `scripts/blender/build_all.py`; foi corrigida a indentação de `object_count` no commit `4efa8ddfac9b120620e02748a67beff315d3028f`. A execução seguinte revelou que `_build_vault()` passava um objecto Material onde `finish_mesh()` espera o nome do material; foi corrigido para `rib_mat.name` no commit `c258de8953e628b884c850e76a9f9323c4002d9c`. Não foram relaxados budgets nem os contratos do validador.

### D035 · Promoção da fonte Blender exclusivamente por Git LFS real
Após uma segunda verificação de entrega descarregada do próprio artifact do job bem-sucedido, o workflow adicionou `art/xoyens-studio.blend` usando o filtro Git LFS real e fez push normal para `main`, no commit `ec362ec04665085dd2ce8ff6b5a13306b0727bd1`. O passo verificou o pointer gerado pelo filtro contra SHA-256 `cfbffce61ed393a427b0f167847f05ba6dc1fa04df7fff64700def48909bbb58` e tamanho `8248183`, executou `git lfs ls-files --long --size`, `git lfs fsck --objects HEAD` e confirmou que o SHA da referência remota `main` correspondia ao commit publicado. Nenhum pointer foi escrito manualmente.

### D036 · Resultado do contrato da entrega
Blender 4.5.14 LTS reportou 54 elementos Scene Bible, 378 objectos, 371 malhas, 37 046 vértices, 62 864 triângulos estimados e as sete colecções exigidas. O GLB final tem 359 nós/malhas/primitivas, 38 materiais, todos os sete IDs de interacção, slots 001–017 sem 018, material e UV0 em todas as primitivas e UV1 em 359/359. O verificador final terminou com `Fase 04 certificável`; os códigos de saída exigidos foram `validate=0`, `blend=0`, `blend-check=0` e `verify=0`. Os hashes, manifesto e execução integral estão em `docs/camping-v3/phase-04/certification-2026-10-14.md`.


## 2026-10-14 · Fase 05

### D020 · Proveniência da biblioteca PBR
Os materiais são recolhidos pela API oficial Poly Haven com User-Agent identificável. O manifesto regista os IDs exactos retornados pela API, URLs, autores quando disponíveis, CC0 1.0, MD5 da origem e SHA-256 das saídas. Não existem IDs presumidos na fonte. Falha de API, licença, mapa ou validação interrompe a build, sem gerar placeholders.

### D021 · Convenção e armazenamento
Cada perfil PBR tem BaseColor (BC), normal OpenGL (N) e ORM (R=AO, G=roughness, B=metallic), PNG 2048x2048. A normal DirectX é convertida invertendo o canal verde se não existir OpenGL. Os PNG estão em Git LFS e o Blender usa caminhos relativos para não duplicar mapas dentro do .blend.

### D022 · Limite de fase
A Fase 05 altera a pipeline de materiais, fonte Blender e documentação. Não altera rotas, Control Room, IDs de interacção, slots de artistas, esquema Supabase nem o GLB servido publicamente. KTX2/Meshopt e integração do runtime ficam em fases posteriores.

### D023 · Evidência visual
A métrica das bordas é um gate automatizado, não substitui a inspecção visual. A fidelidade panorâmica, o bake, tone mapping, screenshot A/B e score são medidos nas fases de harness e rendering; não são declarados concluídos na Fase 05.


## 2026-10-14 · Fase 06: contrato da casca arquitectónica

A fonte continua a ser o Scene Bible e o módulo existente `scripts/blender/build_shell.py`. A abóbada usa superfícies interior/exterior e tampas de fecho. A validação da fonte reaberta conta arestas non-manifold dos componentes de fronteira, aplica o intervalo de 18.000–25.000 triângulos à casca e testa 3.000 raios determinísticos a partir de três posições interiores. Portas, AC e PVC são geometrias modeladas e recebem UVMap/UV_Lightmap pelo helper de acabamento. Não foram alterados IDs de interacção, slots de artistas, módulos de produção/fotografia/lados ou budgets.



## 2026-10-14 · Fase 07: superfícies-herói (em validação)

A implementação está concentrada no módulo já existente `scripts/blender/build_surfaces.py`, executado pelo pipeline determinístico `scripts/blender/build_all.py`. Não altera rotas, Control Room, contratos Supabase, IDs de interacção ou os 17 slots de artistas.

- O soalho passa a ser uma única malha de render com tábuas físicas desconectadas, 190 mm nominal de largura, comprimentos limitados a 0,90–2,20 m, junta desencontrada entre fiadas e chanfro de 0,8 mm. Cada tábua recebe variação tonal determinística em `COLOR_0`; a textura PBR original mantém o mapa baseColor, e `UVMap`/ `UV_Lightmap` permanecem separados.
- O varrimento de vinil é circular, raio de 2,30 m, espessura de 1,2 mm e borda levantada de 4 mm. A origem do centro continua a vir do Scene Bible.
- `photo.paper_folds` é construída como uma parede vertical e uma curva tangencial de 350 mm, em vez do proxy dimensional sem continuidade. A geometria da parede/curva pertence ao módulo de superfícies, não é duplicada pelo módulo de props.
- A abóbada existente mantém a geometria de costelas da Fase 06; apenas a escala do `UVMap` do bambu é reparametrizada para uma repetição física de 1,20 m. `UV_Lightmap` não é substituído.
- `scripts/blender/validate_surfaces.py`, `scripts/verify-glb-contract.mjs`, `scripts/3d/verify-delivery.mjs`, o guard do Vite, o verificador de produção e o teste Playwright exigem os contratos da Fase 07. O workflow passa a tratar os dois relatórios da fase como ficheiros obrigatórios e publica-os com o modelo certificado.

**Gate de fecho:** esta entrada não certifica ainda a fase. Só muda para CERTIFICADA depois de a execução Blender em `main` produzir os relatórios reais, os três tiers passarem os budgets sem os reduzir, o manifesto do GLB público corresponder a SHA-256/tamanho e o deployment Vercel servir o mesmo artefacto. A comparação visual e os FPS continuam a ser evidência, não presumidos.


## 2026-10-14: Fase 07 certificada e publicada

O artefacto público da Fase 07 foi promovido para a main, e o deployment correspondente ficou READY. Esse GLB e o respectivo SHA-256 constituem a linha de base da Fase 08. Esta certificação não antecipa os gates da fase seguinte.

## 2026-10-14: Fase 08, zona de produção (em validação)

scripts/blender/phase08_production.py substitui os proxies de produção por geometria modelada: mesa L com retorno, ecrã DAW emissivo com nome de nó preservado, colunas com cone/surround/dust-cap/tweeter/bass-reflex, subwoofer, teclado de 61 teclas, cadeira executiva de alta densidade, painéis e espuma acústica, tábuas recuperadas com LED superior/inferior, quatro pendentes, espelho, interface/caneca e cabos/ferragens. scripts/blender/validate_production.py certifica os 19 elementos prod.*, as três interacções, os materiais cerâmico/espelho/LED, 36 teclas brancas + 25 pretas, cadeira com 14k–18k triângulos, três painéis e quatro lâmpadas.

A promoção exige o relatório real da Fase 08, o nó SDT_production_monitor_daw_screen, materiais realmente ligados a malhas, preservação de studio.production-desk, studio.imac e studio.audio-system, e incremento de triângulos face à Fase 07. O manifesto mantém surfacePhase: 7 e passa a declarar phase: 8 + productionPhase: 8. A fase permanece aberta até os três tiers, os testes frontend, o score de fidelidade do sector 100°–170° e os bytes servidos por produção terem evidência de execução.

## Fase 09 · Zona fotográfica

- O módulo especializado `scripts/blender/phase09_photo.py` substitui os proxies genéricos quando `CAMPING_PHASE=9`, mantendo o builder antigo disponível para a entrega anterior.
- Os PNGs do selo e do logótipo são obtidos pelos URLs oficiais em `src/assets/brand/*.asset.json`, verificados e empacotados no `.blend`; não há recriação dos logótipos.
- A promoção exige os nove IDs de elemento, cinco malhas de roupa, selo de 2,2 m, materiais de decal/iluminação e evidência Blender com checksums.
- O modelo optimizado continua a ser promovido para `public/models/camping/xoyens-studio.glb`. A publicação falha se a geometria ou os metadados da Fase 09 não estiverem presentes.
- O estado só muda para Certificada após CI, promoção para `main` e verificação do deployment.

## 2026-10-15 · Hotfix de entrada e câmara

A análise da falha do acesso 808 encontrou uma incompatibilidade entre o validador de chão e o estado real do asset: `metricPlan.status` continua `phase-03-approved-target-not-yet-built`, enquanto `runtimeCompatibility` declara que o GLB publicado ainda usa o envelope legacy de 14,2 × 9,2 m (limites de colisão interiores de 13,1 × 8,26 m). O validador só aceitava a futura planta de 7,6 × 5,6 m. Assim, `deriveCampingFloorBounds` devolvia `null`, a pose Blender V3 da entrada não podia ser derivada e a máquina de estados bloqueava em `CAMERA GEOMETRY INVALID` ao terminar a animação da porta.

A correcção aceita as duas plantas documentadas, incluindo exportações em que X/Z ficam trocados, mas continua a exigir uma superfície identificada como chão e espessura vertical máxima de 0,35 m. A caixa de sala, as paredes e a abóbada continuam inválidas como chão. A pose de entrada fica dentro dos bounds, do lado +Z, olha para -Z e usa 1,62 m acima do topo do chão para os olhos, com alvo a 1,48 m. Os offsets limitados mantêm um enquadramento de primeira pessoa nas duas escalas documentadas.

Foram acrescentados testes unitários para as duas orientações da planta legacy, altura e inclinação da câmara, envelope de tecto inválido e rejeição de superfícies arbitrariamente grandes. A adenda v1.1 continua a reger a separação entre GLB visual e GLB de colisores; este hotfix não altera o modelo Blender, os metadados certificados, o estado de migração métrica nem os contratos de interacção.

**Limite de evidência:** a presença dos testes no repositório não substitui a execução. A confirmação final depende dos resultados reais de Vitest, lint, build e do teste browser de entrada quando o ambiente WebGL o suportar.


## 2026-10-15 · D037 · Câmara baseada na casca arquitectónica

A falha de entrada mostrou que a caixa global do GLB não é uma fonte segura para a câmara: elementos decorativos podem alargar o envelope sem alterar as dimensões reais da sala. A recuperação passa a medir apenas as malhas estruturais identificadas (paredes, abóbada e portas), transforma as caixas locais para coordenadas de mundo e valida o resultado contra os intervalos métrico/legacy documentados. A altura dos olhos é calculada a partir da base medida das paredes, a 1,62 m; o alvo fica a 1,48 m e a pose mantém a entrada em +Z a olhar para -Z.

O envelope resultante é exclusivamente para a câmara. O construtor de colisões continua a exigir uma superfície física de chão, e nenhum collider é fabricado a partir das paredes ou do tecto. Foi acrescentado um teste com um elemento decorativo fora da sala para impedir regressões causadas por bounds globais contaminados. A fase continua em validação até Vitest, Playwright, CI, promoção do GLB e verificação do deployment passarem.
