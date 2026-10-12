# CAMPING V2 · Auditoria visual avançada

**Data:** 2026-10-10  
**Branch:** `main`  
**Estado:** correcções visuais implementadas no código. A validação visual no browser e a publicação integral do HEAD continuam pendentes.

## Referência e método

A panorâmica Xoyens fornecida é a referência visual principal: tecto curvo de madeira, vigas visíveis, parquet quente, iluminação prática, zona de produção, mural colorido, fundo fotográfico preto, rack de roupa e identidade do Sindicato. A cena continua a usar geometria glTF real e materiais 3D, não uma imagem panorâmica como fundo.

O GLB declara um envelope de 14,2 × 9,2 m, paredes de 3,2 m, tecto até 4,35 m, 102 meshes, 150 primitivas, 26 materiais e 13 imagens embebidas. O modelo tem materiais de madeira, gesso, metal, tecido, couro, papel e ecrã, com mapas de cor e normais para os materiais principais.

Existe uma limitação objectiva: a referência disponível é uma só panorâmica, sem fotografias das paredes ocultas, distâncias métricas confirmadas ou vistas adicionais. A composição pode seguir essa imagem, mas não é possível certificar fidelidade geométrica absoluta das superfícies que não aparecem nela sem mais referência visual.

## Auditoria: problemas concretos encontrados

1. **Parede de artistas:** os 17 slots físicos existiam, mas o GLB marcava-os como placeholders. O runtime não estava a aplicar as fotografias publicadas às superfícies pretas das molduras.
2. **Logo Xoyens:** o asset oficial `src/assets/brand/xoyens.png.asset.json` existia no repositório, mas não era utilizado pelo motor 3D.
3. **Pano do Sindicato:** o selo estava aplicado a um plano simples sobre o fundo fotográfico preto. Faltavam volume de tecido, pequenas pregas e fixações físicas.
4. **Materiais:** o ambiente usava os mapas do GLB, mas não tinha uma environment map de reflexão e a filtragem anisotrópica não aproveitava o limite da GPU.
5. **Entrada 808:** havia labels duplicados, um texto longo de instruções, um estado de acesso no cabeçalho e instruções repetidas no painel.
6. **Raycasting:** o selo plano antigo ficava escondido sob o novo pano, mas um objecto invisível podia continuar a entrar na lista de alvos de raycast.

## Correcções implementadas

### 1. Fotografias reais nas 17 molduras

A geometria foi inspeccionada no GLB. As molduras estavam posicionadas junto à parede lateral, mas a sua face estava orientada para a frente da sala, e a faixa `studio.wall-posters` ocupava a mesma zona, podendo tapar uma parte dos retratos. Corrigi a orientação e o conflito geométrico:

- Cada slot é rodado para a parede lateral direita com a face voltada para dentro do estúdio, normal `-X`, mantendo a posição vertical e o espaçamento longitudinal.
- A parte traseira das molduras fica junto à parede interior em `x=6.95 m`; o código aplica a rotação às geometrias clonadas e não altera a árvore global da cena.
- Foram acrescentadas três calhas metálicas finas com cabeças de parafuso, alinhadas com as filas de retratos. A rotação usa a transformação da geometria e preserva as normais já modeladas, para manter as arestas duras de madeira e papel.
- As geometrias antigas `studio.wall-posters` e `studio.poster-art` ficam escondidas porque atravessavam as fotografias. O mural colorido da esquerda e a bandeira grande do Sindicato continuam na cena.
- O teste de contrato agora verifica a pose de montagem, a direcção para o interior e a distância do verso da moldura à parede.


- Foi criada a função `buildCampingArtistPortraitBindings` em `camping-visual-contracts.ts`. Só aceita códigos oficiais `SDT-01` a `SDT-17` e imagens reais.
- A fonte de verdade é `getLiveArtistsForSite()`, que lê artistas publicados do Supabase e mapeia `photo_url` para `img`.
- Cada código corresponde ao nó físico `studio.artist-slot-NNN`. Não há indexação cega que possa atribuir a fotografia de um artista ao membro errado.
- O motor percorre a moldura e substitui apenas o material preto que corresponde à fotografia. A moldura de madeira e o papel continuam visíveis.
- O código trata tanto modelos GLTF com primitivas separadas como meshes com vários materiais.
- A textura usa sRGB, UVs GLTF, mipmaps e filtragem anisotrópica limitada. O enquadramento é recortado ao centro conforme o aspecto da fotografia e da moldura, evitando deformar rostos.
- A cena mantém-se em estado de carregamento até as tentativas de carregamento das fotografias terminarem. Assim, o percurso de entrada não deve ultrapassar a porta com a parede ainda a preencher as molduras.
- Os pedidos falhados são contabilizados e comunicados por uma mensagem transitória. Não se reutiliza a foto de outro membro, e os slots sem registo ficam vazios.

A auditoria ao Supabase encontrou 17 artistas publicados com os respectivos URLs de fotografia. Não foi criado um artista número 18.

### 2. Letreiro físico Xoyens com iluminação traseira

O motor utiliza o ficheiro original `xoyens.png`, sem redesenhar o símbolo. O letreiro fica na parede da zona de produção sobre a mesa, com caixa preta tridimensional, moldura metálica, canal LED âmbar e uma luz pontual atrás do conjunto. A imagem oficial é uma textura sobre um plano montado à frente da caixa. O objecto completo está integrado no espaço 3D.

### 3. Bandeira gigante preta com o selo original

- Pano de 5,25 × 2,78 m, ajustado à armação da área de fotografia.
- Geometria subdividida em 48 × 28 segmentos para criar ondulação pequena e pregas com parallax.
- Material derivado do tecido PBR do próprio GLB, com mapa de cor e mapa normal repetidos, acabamento preto, roughness elevada e metalness zero.
- Barra de suporte metálica e três grampos.
- Selo oficial do Sindicato aplicado como textura sobre o pano, em grande escala. O selo plano antigo fica escondido para evitar duplicação.
- A superfície nova continua ligada ao ID `studio.photo-backdrop`.

O objecto plano oculto é agora excluído dos alvos do raycast. O banner visível é o alvo da interacção, não o selo antigo por baixo.

### 4. Realismo PBR e iluminação

- O motor gera uma environment map com `RoomEnvironment` e `PMREMGenerator`, com intensidade baixa para preservar os pretos e o ambiente quente.
- Os materiais do GLB mantêm os mapas PBR existentes. A filtragem anisotrópica aproveita até 16x em GPUs classificadas como high e até 8x nas restantes, sempre limitada à capacidade real reportada pela GPU.
- O perfil high passou a usar sombras de 2048 px; o perfil móvel/limitado mantém 512 px, e o desktop equilibrado 1024 px.
- O tecto de madeira, parquet, gesso, metal, tecido e couro mantêm os mapas existentes. Não foi substituído o GLB por uma panorâmica nem foram acrescentados materiais de plástico genérico.
- Reflexos e sombras continuam condicionados pela capacidade do dispositivo. Esta abordagem melhora a resposta dos materiais sem impor o custo máximo em telemóveis.

Não foi importado um pacote externo de texturas PBR nem reexportado o GLB. O modelo existente já contém mapas de cor e normais, e a redução da qualidade em mobile deve ser medida em hardware real antes de se introduzirem assets de maior resolução ou novos decoders.

### 5. Textura física da porta de entrada

A porta visível antes de introduzir o código tinha apenas materiais de cor lisa. Foi acrescentado um conjunto de mapas procedurais determinísticos para a folha de madeira, painéis interiores e zona de entrada: mapa de cor com veios verticais, nós de madeira e marcas discretas de uso, mais mapas de normais e rugosidade. O perfil high usa mapas de 512 × 1024; balanced e low usam 256 × 512 para limitar memória GPU. O desenho é gerado no cliente e não introduz dependências de texturas externas nem muda o GLB do estúdio.

### 6. Entrada 808 simplificada

O painel de entrada apresenta agora apenas `STUDIO XOYENS`, `808`, `Código de acesso` e os três dígitos. Foram removidos do estado anterior à porta os labels verticais de marketing, o texto `ENTRY PROTOCOL`, a indicação `ACCESS LEVEL / 808` e o bloco de instruções `WASD / DRAG LOOK`. O cabeçalho reduz-se à identidade do estúdio e o estado da sala só aparece depois de entrar. Durante a transição, o texto ficou reduzido a `A preparar o estúdio` e `Pode entrar`.

A navegação guiada, os registos e os controlos mobile continuam disponíveis para acessibilidade. As instruções de movimento aparecem quando o utilizador já está dentro do estúdio.

## Testes preparados

- `camping-visual-contracts.test.ts` cobre o mapeamento dos 17 slots, códigos inválidos, duplicados, imagens ausentes e slots vazios sem substituições fictícias.
- `camping-object-contracts.test.ts` cobre os perfis de renderização, incluindo o perfil high com sombra de 2048 px.
- `tests/radio/camping-entry.spec.ts` foi actualizado para verificar o painel mínimo 808, a identidade Xoyens, a ausência de instruções duplicadas e as respostas HTTP das 17 fotografias antes de declarar a entrada pronta. O cenário de teste usa fixtures apenas no browser de teste e não escreve dados na produção.

**Importante:** estes testes foram escritos ou actualizados, mas os resultados de Vitest, lint, build e Playwright ainda não foram obtidos nesta execução. O conector de workflow não disponibilizou os runs de push e o ambiente Vercel sandbox devolveu 403 ao pedido de criação. Não se declara qualquer teste aprovado sem os logs.

## Estado de publicação

- Código de entrada mínimo e renderização adaptativa estão na `main`.
- Motor visual mais recente durante esta auditoria: `89d6525f925ec0544b072308866dd3453d377250`. Manifesto visual sincronizado: `4e7c6a6ae0b6ff5ecea6556a08d37fd86d7f2cf3`. Testes de contrato visual: `795d7b58251ea33ced775606ff166b629ccb62b8`. Teste E2E de fotos e assets oficiais: `7ec0470935299114a26b9e3ffe0e243a7235ff1e`.
- O projecto Lovable sincronizou esse commit e reporta estado `ready`. O screenshot automático disponível é uma captura do projecto, mas as ferramentas de browser usadas nesta execução não permitiram abrir a imagem nem inspeccionar a cena interactiva.
- O deployment Vercel associado ao alias de produção continua em estado `READY` para o commit anterior `ab8e73644569dcdd9b2ef410eab01d955e7160bb`. O runtime de código e materiais mais recente na `main` é `fb474947`, mas não está ainda publicado na Vercel. Os commits visuais subsequentes estão a receber `build-rate-limit`, por isso as alterações novas não estão confirmadas na publicação Vercel.
- Não foi feita promoção manual de um deployment antigo.

## Critérios que continuam abertos

1. Publicar, sem o bloqueio de rate limit, um deployment que inclua o motor visual actual, a interface simplificada e o manifesto actualizado.
2. Abrir `/camping` num browser real, digitar 808 e verificar visualmente a parede com as 17 fotografias, o letreiro Xoyens retroiluminado e o pano preto com o selo oficial.
3. Confirmar no separador Network que as 17 fotografias, `xoyens.png` e `sindicato-selo.png` são entregues com sucesso.
4. Executar `npm test`, `npm run lint`, `npm run build` e `npm run test:e2e` sobre o mesmo commit.
5. Medir FPS, memória e carregamento em Chrome desktop, Safari/iPhone e Android. Nenhuma medição em dispositivo físico foi realizada.

**Conclusão:** as faltas visuais identificadas foram tratadas no código, e o runtime agora aguarda pelas tentativas de carregar os retratos antes de abrir a experiência. A correspondência com a referência está melhorada, mas a certificação de hiper-realismo e a publicação integral continuam pendentes da inspecção interactiva e dos testes executados num browser real.


## Correcção de composição runtime · 2026-10-12

Foi feita uma correcção concreta na `main`, sem substituir o GLB por uma imagem e sem alterar tabelas ou contratos do Supabase. O modelo original continua a fornecer a geometria principal; os ajustes estão isolados em `src/features/camping/scene/camping-reference-composition.ts` e são aplicados uma única vez quando o GLB é carregado.

- O painel plano `studio.ceiling-cross-beams`, que ocupava a zona inferior da abóbada e criava uma faixa horizontal visualmente pesada, fica oculto. As nervuras curvas existentes mantêm-se visíveis.
- O tecto abobadado e as nervuras passam a renderizar as faces interiores com materiais double-sided, evitando que as normais orientadas para fora criem zonas escuras vistas do interior.
- O parquet mantém a disposição de madeira do GLB, mas o perfil vertical é reduzido e assenta no topo do pavimento, para eliminar a sensação de tábuas suspensas.
- O chão e o pano da zona de fotografia recebem materiais muito escuros e mate. O selo original do Sindicato aumenta de 3,0 × 2,05 m para uma caixa máxima de 3,65 × 2,3 m, mantendo a proporção da imagem oficial.
- O relevo procedural de estuque passa a ter intensidade mais baixa. O tom das paredes fica orientado para creme quente, sem adicionar novos assets ou substituir a textura original.
- O stand é deslocado para a esquerda e reduzido horizontalmente para que a área central do selo fique mais legível. O colisor de movimento acompanha a nova largura e posição.
- A primeira transição após o código 808 enquadra a sala um pouco mais atrás e com um ângulo ligeiramente mais elevado, mostrando melhor a abóbada sem eliminar a exploração em primeira pessoa.

A intervenção foi versionada em commits normais na `main`: `79d709f`, `ee47196`, `37ed8cb`, `c81d13f`, `e61247d`, `99ae33e`, `f093cd3` e `c5d88a1`. Os materiais são agora clonados por mesh antes das substituições locais, evitando que o chão fotográfico ou as paredes alterem outros objectos que partilhem o mesmo material do GLB. Foram acrescentados testes de contrato para o perfil do parquet, a face interior do tecto, o fundo preto, a posição do stand, o isolamento de materiais e a idempotência dos ajustes; o teste de colisão verifica também a passagem livre à direita do stand.

**Estado de validação:** a verificação automatizada do código e a inspeção visual em browser ainda não têm um resultado final confirmado neste registo. O deployment Vercel do commit mais recente estava em fila/construção durante a auditoria, e a URL de preview não ficou acessível à ferramenta de browser usada. A correcção está na `main`, mas não declaro equivalência visual completa até se inspeccionar a captura real da nova versão e concluir os testes de browser.
