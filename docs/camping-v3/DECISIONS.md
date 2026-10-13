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
