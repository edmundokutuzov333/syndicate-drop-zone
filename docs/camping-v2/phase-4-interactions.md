# CAMPING V2: Fase 4, objectos interactivos e interfaces de conteúdo

## Implementação

A cena continua a utilizar Three.js e o GLB versionado em `/models/camping/xoyens-studio.glb`. Quando o motor entra no estado `INTERACTION_FOCUS`, a rota apresenta uma interface contextual associada ao identificador estável do objecto seleccionado. Fechar a interface chama o retorno suave de câmara do motor sem reiniciar a sessão.

## Objectos

- `studio.imac`: estação com pastas MUSIC, BEATS, ARTISTS, MERCH, ARCHIVE e SESSIONS.
- `studio.artists-wall` e `studio.artist-photo.*`: dossiers com perfis publicados, código, biografia, zona, faixas e ligações oficiais.
- `studio.merch-rack`: catálogo, variantes, stock indicado pelo serviço, saco persistente e reserva explícita via RPC existente. Mantém o requisito de chave de escuta/Syndicate ID. IDs de contingência estática não são enviados para o backend de reservas.
- `studio.production-desk`: agenda real do Camping e ligação à Frequência 808.
- `studio.audio-system`: controlos ligados à emissão existente, sem um motor de rádio paralelo.
- `studio.photo-backdrop` e `studio.inner-door`: arquivo digital dos registos publicados pelo serviço actual.

## Fonte de dados e limites

A UI reutiliza `getLiveArtistsForSite`, `getLiveMerchProducts`, `getLiveTapes`, `getLiveRevelationMedia`, `getLiveCampingSessions`, `createPublicMerchReservation`, `tape` e `frequency`. Não cria artistas, produtos, preços, stock ou faixas fictícios.

O código actual não disponibiliza um catálogo próprio de beats de áudio com BPM, produtor, previews e estado de publicação. A pasta BEATS indica essa limitação e apenas expõe registos publicados já identificados como beats. A Room 02 ainda não tem geometria GLB própria; a porta abre o arquivo digital publicado e informa claramente que a sala arquitectónica continua por modelar.

## Saco e reservas

O saco é mantido em `localStorage`, permite alterar/remover quantidades e só envia reservas após confirmação explícita. A reserva utiliza a RPC pública existente, não simula pagamento nem afirma uma compra concluída. Em caso de falha parcial, as linhas concluídas são retiradas do saco e os códigos recebidos são mostrados para evitar duplicar automaticamente reservas já registadas.

## Testes

Os testes de contratos verificam o mapeamento dos IDs, slots de artistas e bloqueio de reservas para produtos de contingência. Foram adicionados à etapa de testes de engenharia do CI. O build/CI e a validação visual num browser continuam necessários antes da certificação final.
