# CAMPING V2: Fase 4, objectos interactivos e interfaces de conteúdo

## Implementação

A cena continua a utilizar Three.js e o GLB versionado em `/models/camping/xoyens-studio.glb`. Quando o motor entra no estado `INTERACTION_FOCUS`, a rota apresenta uma interface contextual associada ao identificador estável do objecto seleccionado. Fechar a interface chama o retorno suave de câmara do motor sem reiniciar a sessão.

## Objectos

- `studio.imac`: estação com pastas MUSIC, BEATS, ARTISTS, MERCH, ARCHIVE e SESSIONS.
- `studio.artists-wall` e `studio.artist-photo.*`: dossiers com perfis publicados, código, biografia, zona, faixas e ligações oficiais.
- `studio.merch-rack`: catálogo, variantes, stock indicado pelo serviço, saco persistente e reserva explícita via RPC existente. Mantém o requisito de chave de escuta/Syndicate ID. IDs de contingência estática não são enviados para o backend de reservas.
- `studio.production-desk`: agenda real do Camping e ligação à Frequência 808.
- `studio.audio-system`: controlos ligados à emissão existente, sem um motor de rádio paralelo.
- `studio.photo-backdrop`: arquivo digital dos registos publicados pelo serviço actual.
- `studio.inner-door`: porta física que inicia a transição cinematográfica para ROOM 02 / THE ARCHIVE.
- Portas secundárias no mundo 3D abrem a Listening Room e o regresso ao estúdio; uma passagem não listada fica escondida até a gaveta física ser descoberta.

## Fonte de dados e limites

A UI reutiliza `getLiveArtistsForSite`, `getLiveMerchProducts`, `getLiveTapes`, `getLiveRevelationMedia`, `getLiveCampingSessions`, `createPublicMerchReservation`, `tape` e `frequency`. Não cria artistas, produtos, preços, stock ou faixas fictícios.

O código actual não disponibiliza um catálogo próprio de beats de áudio com BPM, produtor, previews e estado de publicação. A pasta BEATS indica essa limitação e apenas expõe registos publicados já identificados como beats. A Room 02, Listening Room e Secret Room são construídas como geometria procedural Three.js, com paredes, pavimento, tecto, portas com dobradiças, iluminação e mobiliário físico. São salas 3D reais no runtime, mas não são apresentadas como GLB customizados: a modelação exportada do Blender continua a ser um passo futuro de qualidade visual. As salas são criadas apenas quando necessárias e mantêm colisões separadas.

## Saco e reservas

O saco é mantido em `localStorage`, permite alterar/remover quantidades e só envia reservas após confirmação explícita. A reserva utiliza a RPC pública existente, não simula pagamento nem afirma uma compra concluída. Em caso de falha parcial, as linhas concluídas são retiradas do saco e os códigos recebidos são mostrados para evitar duplicar automaticamente reservas já registadas.

## Testes

Os testes de contratos verificam o mapeamento dos IDs, slots de artistas, bloqueio de reservas para produtos de contingência, destinos das portas e a separação entre descoberta e autorização. Os testes de navegação de salas verificam os pontos de entrada e os espaços de colisão. Foram adicionados à etapa de testes de engenharia do CI. O build/CI e a validação visual num browser continuam necessários antes da certificação final.

## Expansão espacial da Fase 4

- O motor mantém uma identificação explícita da sala activa e carrega cada interior uma única vez, mantendo apenas a sala activa visível depois da transição.
- ROOM 02 contém estantes, caixas físicas, dossiers e uma gaveta não listada. As caixas mostram apenas registos publicados pelo serviço existente.
- A Listening Room contém sofá, colunas e consola física. A coluna abre os controlos do serviço global Frequência 808; não foi criado um segundo motor de rádio.
- A gaveta revela uma passagem física e o texto “YOU WERE NOT SUPPOSED TO FIND THIS”. A descoberta só desbloqueia a navegação. Não torna música inédita, ficheiros privados ou dados restritos acessíveis.
- As portas entre estúdio, arquivo, listening e passagem secreta têm IDs estáveis e transições animadas. Os colisores por sala incluem paredes, mobiliário e folhas de porta fechadas.
- A navegação guiada funciona também dentro das salas adicionais. O controlo de retorno oferece ROOM 01, regresso ao arquivo ou saída para a entrada, conforme a sala activa.
- Não houve alterações a tabelas, migrações, RLS ou autorizações Supabase. O contrato de dados continua a assinalar a discrepância remota; o acesso a conteúdo privado continua a depender da autorização do backend.

## Correcção adicional da Fase 3

O canvas recebe agora os dígitos directamente quando tem foco, e evita a duplicação de eventos no listener global. Enter também confirma o código por este caminho acessível. A máquina de estados mantém a submissão automática da combinação completa 808.


## Ajustes de UX e inventário

- Pastas abertas no terminal do iMac regressam agora à estação. Interfaces abertas directamente no rack, parede ou porta regressam à cena 3D ao premir o controlo de retorno.
- A contagem de stock usa a soma das variantes como fonte autoritativa quando existem variantes; o total do produto só é usado como fallback quando não há variantes. Isto evita duplicar stock no ecrã de merchandising.
