# CAMPING V2 · Auditoria avançada de arte 3D e entrada

Data: 2026-10-10
Branch: `main`
Estado: correcções implementadas no código; validação final visual/build pendente.

## Critério visual

A cena deve reproduzir o panorama de referência do Studio Xoyens: tecto arqueado em madeira/caniço com vigas, chão em parquet quente, paredes em estuque creme, painel de madeira na zona de produção, secretária com iMac/DAW e monitores, cadeira preta, sofá baixo, mural artístico colorido, set fotográfico preto, stand simples de streetwear e uma bandeira preta gigante com o selo oficial do Sindicato. O logo Xoyens deve ser sinalética física com placa/espessura e luz âmbar por trás.

## Auditoria do código existente

1. A cena é Three.js com um GLB navegável em `public/models/camping/xoyens-studio.glb`, não uma imagem de fundo. O manifesto declara dimensões aproximadas de 14,2 m x 9,2 m, paredes de 3,2 m e tecto até 4,35 m.
2. O motor já implementava `addSyndicateBanner`, `addXoyensBacklitSign` e `prepareArtistWallMounting`. O banner tem geometria subdividida, pregas discretas, textura de tecido, calha, grampos e selo oficial aplicado como textura. O sinal Xoyens tem placa física, moldura metálica, canal LED, logo proporcional e point light traseira. Foram preservadas estas implementações em vez de criar duplicados.
3. Os 17 slots de retratos são nós físicos do GLB. A aplicação de imagens depende da disponibilidade de registos com códigos `SDT-01` a `SDT-17` e URLs de imagem. Em produção, `getLiveArtists` devolve uma lista vazia se o backend não devolver artistas publicados. Isso podia deixar molduras vazias apesar de existirem 17 retratos reais nos assets locais.
4. O cabeçalho de marca repetia texto enquanto o visitante ainda estava no acesso 808, competindo com a porta e a cena.
5. Os materiais GLB já têm mapas de cor e mapas normais para várias superfícies, mas as imagens embebidas são pequenas. O realismo máximo continua limitado pela resolução e qualidade do asset original, pela geometria existente e pelo renderizador rasterizado. Não é correcto afirmar path tracing ou fotorealismo absoluto.
6. A integração de backend tem dependências reais de schema/roster e deve continuar separada de dados de apresentação. Não foram alterados schema, RLS, credenciais ou dados Supabase nesta tarefa.

## Correcções aplicadas

- `CampingStudioExperience.tsx`: o cabeçalho completo com selo e copy só aparece depois da entrada na fase de exploração. Antes da porta fica o painel mínimo do código 808, evitando duplicação de branding e reduzindo a densidade de texto.
- `CampingStudioEngine.ts`: se a lista de artistas publicada pelo backend estiver vazia ou indisponível, os 17 retratos físicos usam os assets reais já incluídos em `src/lib/artist-profiles.ts` via `ARTISTS`. Este fallback é estritamente visual: não cria linhas de backend, não fabrica artistas e não concede acesso a dossiers privados. Os painéis de conteúdo continuam a depender dos dados vivos.
- `CampingStudioEngine.ts`: acrescentado relevo procedural subtil e determinístico para materiais reconhecidos de madeira, estuque, tecido e couro apenas quando não têm normal map ou bump map próprio. A intensidade é baixa e a resolução acompanha o perfil gráfico. O helper de libertação de materiais também limpa o bump map.
- Foram preservados o GLB, as colisões, o controlo da porta, a navegação, a rádio e os fluxos existentes.

## Verificações que faltam

- Typecheck, lint, Vitest, build e Playwright com output real depois dos commits de arte.
- Inspecção em browser da entrada 808 e da primeira vista do interior, verificando que os 17 retratos são carregados, o selo do banner não fica tapado, o logo Xoyens tem spill de luz plausível e não existem intersecções/clipping.
- Validação em desktop e telemóvel, incluindo FPS, memória, tempo de carregamento e recuperação WebGL.
- Revisão de materiais com comparação visual lado a lado contra o panorama original. Não existe nesta execução uma sessão de browser disponível para confirmar renderização final em pixels.
- O workspace Lovable devolveu erro de créditos esgotados ao tentar delegar a revisão ao agente. O trabalho foi aplicado directamente à `main` através do GitHub; não foi possível usar o agente Lovable para fazer build/preview.
- A publicação Vercel tem um bloqueio de build rate limit reportado anteriormente. Os commits de arte mais recentes ainda não têm deployment Vercel READY associado, pelo que não devem ser tratados como publicados.

## Estado de certificação

A correcção do excesso de texto pré-entrada e o fallback visual dos retratos estão implementados. O relevo procedural foi acrescentado como melhoria de material de baixo risco. A cena mantém os elementos principais já existentes. A fase continua por certificar até haver build/testes e inspecção visual real do browser. O termo “100% fotorealista” não é uma propriedade verificável sem renderização e validação visual contra a referência.
