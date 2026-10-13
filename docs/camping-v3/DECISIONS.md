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

### D007 · Estado de execução
A última série de workflows em `main` terminou com falha e sem passos de execução expostos pela API de jobs. O estado é inconclusivo quanto à causa. A validação local de comandos e o browser ainda têm de ser executados num ambiente com dependências e Chromium disponíveis.

### D008 · Histórico e publicação
Todo o trabalho permanece em `main`; não fazer force-push, rebase, amend ou squash de commits publicados. Antes de qualquer alteração estrutural, voltar a ler rotas, motor 3D, contratos de objectos, Control Room e configuração CI.
