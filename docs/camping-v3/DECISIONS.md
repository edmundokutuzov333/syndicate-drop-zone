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
