# CAMPING V2: Fase 3, motor de navegação e acesso 808

**Estado:** implementação ligada à rota \`/camping\` e versionada na \`main\`. A certificação final depende do CI completo e da revisão visual em browsers/dispositivos reais. Esta fase não cria novas tabelas nem muda RLS.

## Arquitectura aplicada

A página existente foi preservada como rota TanStack \`/camping\`. O loader mantém sessões, flags LIVE/CAMP, galeria publicada, fallback dos conteúdos de Revelação e os contratos de pesquisa e SEO. A antiga planta \`BunkerMap\` continua no repositório, mas já não é o conteúdo principal desta rota.

A experiência é renderizada por um motor Three.js client-side (\`CampingStudioEngine\`), que carrega o GLB da Fase 2 em \`/models/camping/xoyens-studio.glb\`. Foi mantida a dependência Three.js já instalada, sem adicionar React Three Fiber/Drei ou um motor de física adicional ao package apenas para esta fase. O código do renderer está separado da interface React para facilitar substituição e testes.

## Máquina de estados

\`LOCKED → CODE_ENTRY → ACCESS_GRANTED → DOOR_OPENING → ENTERING_STUDIO → EXPLORATION\`

O motor usa um reducer testável em \`interactions/access-machine.ts\`. A entrada exige \`808\`; códigos errados limpam a sequência, incrementam a contagem de tentativas e mostram feedback de erro. O keypad tem botões tridimensionais com raycast, visor, CLEAR e ENTER; também aceita dígitos, Enter e Backspace do teclado. A câmara não permite deslocação livre antes da transição para EXPLORATION.

## Porta, câmara e movimento

A entrada foi construída em geometria Three.js, com aro, folha de porta, dobradiças e maçaneta. A folha roda a partir do pivô lateral. Após acesso aceite, o motor faz o carregamento lazy do GLB, abre a porta e interpola a câmara até à sala. O renderer usa delta-time, adaptação ao tamanho do canvas e limpeza dos listeners, RAF e recursos GPU em unmount. Quando o separador fica oculto, pausa o trabalho de renderização.

Desktop: WASD/setas, rato para olhar, clique para interagir e ESC para fechar o focus activo. Mobile: arrastar para olhar, tocar nos elementos e botões direccionais tácteis. A navegação guiada oferece pontos de câmara para a entrada, o estúdio, produção, fotografia, roupa e parede de membros.

O módulo \`camera/camping-collision.ts\` limita a posição às fronteiras da sala e aplica colisões circle/rect com mesa, cadeira, subwoofer, sofá, rack, fundo fotográfico e equipamento de áudio, permitindo deslizar ao longo dos obstáculos. A câmara procura pontos livres ao focar um objecto e restringe o movimento de câmara guiada aos limites e obstáculos. A colisão de runtime continua a ser uma aproximação 2D no plano X/Z, não uma simulação completa de física rígida.

## Objectos e dados preservados

Só objectos com \`interactionId\` são apresentados como seleccionáveis. Hover mostra labels discretas; seleccionar aproxima a câmara e ESC/VOLTAR regressa à posição anterior. As interacções reais de artistas, música, beats, merch e arquivos continuam reservadas para as Fases 4 e 5, para não exibir conteúdos falsos.

O painel discreto \`REGISTOS\` conserva as superfícies existentes:
- sessões do serviço actual de CAMPING;
- estado LIVE, notificações e próxima sessão;
- galeria publicada e navegação para \`/revelacao?media=...\`;
- presença dos artistas;
- sessão activa e respectiva sala.

A shell global esconde TacticalNav e footer apenas em \`/camera\` e \`/camping\`; mantém CodeGate, MiniPlayer, Frequência 808, Toaster e as outras rotas. A rota para sair continua disponível.

## Fallback e acessibilidade

Se WebGL falhar, a experiência mostra uma mensagem explícita e permite abrir os registos públicos ou sair. Se o GLB falhar depois do código correcto, a UI passa para estado de erro com tentativa de novo carregamento. Os botões da interface têm nomes acessíveis, focos visíveis e não dependem exclusivamente do rato.

O código 808 é apenas uma entrada temática. Não é uma autorização para descarregar ficheiros privados; conteúdos protegidos continuam dependentes das permissões no backend.

## Testes

Foram adicionados testes unitários para a máquina 808 e colisões, bem como smoke tests Playwright para a rota, fallback WebGL, sequência 808, carregamento do GLB e viewport móvel. A suite do repositório inclui também testes prévios de rádio/formulários, cujo estado deve ser lido do workflow mais recente.

## Limitações conhecidas, não ocultadas

- A cena ainda não foi validada num iPhone/Android físico; viewport móvel no Playwright não é certificação de dispositivo.
- A composição é uma reconstrução baseada numa só panorâmica. A exactidão geométrica, sombras e materiais exigem revisão visual no browser e fotografias/medidas adicionais do espaço.
- Os URLs absolutos dos decals oficiais do logo/selo precisam de validação no domínio publicado. Os assets oficiais são referenciados, não redesenhados.
- A discrepância remota do schema Supabase registada na issue #32 continua isolada. Não houve DDL nem alterações a tabelas, RLS ou credenciais nesta fase.
- As interacções do iMac, perfis, compras, sessões privadas e salas de arquivo continuam a ser trabalho das Fases 4 e 5. Não se apresentam como funcionais nesta fase.

## Critérios da Fase 3

- [x] Estado de acesso 808 e testes unitários.
- [x] Keypad físico tridimensional e porta com rotação no pivô.
- [x] Carregamento lazy do GLB após acesso.
- [x] Câmara em primeira pessoa, rato/teclado e controlos tácteis.
- [x] Limites espaciais e colisões X/Z com os principais móveis.
- [x] Navegação guiada e retorno de focus.
- [x] Preservação das sessões, LIVE, galeria, presença, MiniPlayer e Frequência 808.
- [x] Fallback quando WebGL ou GLB falham.
- [x] Smoke tests do percurso e mobile adicionados ao repositório.
- [ ] CI completo verde para o commit final, incluindo testes de browser do site.
- [ ] Inspecção visual confirmada no preview publicado e validação física mobile.
