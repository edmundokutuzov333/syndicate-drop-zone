# CAMPING V2 · Fase 6: optimização, certificação e publicação

**Estado: optimizações de runtime implementadas. Certificação integral pendente.**

Auditoria: 2026-10-10. Branch de trabalho: `main`. Não foram feitas alterações ao schema Supabase nem inseridos dados de teste.

## O que foi implementado

### Orçamento gráfico adaptativo

Em `src/features/camping/scene/CampingStudioEngine.ts`, o `resolveCampingRenderProfile` escolhe um orçamento gráfico com base em `devicePixelRatio`, largura do viewport, memória reportada pelo browser, núcleos lógicos e pointer coarse. As APIs de memória são opcionais e têm fallback seguro.

| Perfil | Critérios principais | Pixel ratio máximo | Sombras |
|---|---|---:|---|
| Low | Ecrã móvel e memória até 4 GB ou até 4 núcleos | 0,95 | Desactivadas |
| Balanced móvel | Ecrã/pointer móvel sem sinais de hardware limitado | 1,15 | Mapa de 512 px |
| Balanced desktop | Hardware reportado limitado | 1,25 | Mapa de 512 px |
| High desktop | Memória >= 8 GB e >= 8 núcleos | 1,65 | Mapa de 1024 px |
| Desktop por defeito | Sem evidência suficiente de hardware alto | 1,40 | Mapa de 1024 px |

O perfil também escolhe antialiasing e `powerPreference`. A direcção visual base, exposição ACES, materiais e iluminação quente foram preservados. A redução de sombras é restrita a dispositivos móveis com sinais claros de limitação.

### Ciclo de vida do renderizador

- O loop de `requestAnimationFrame` é cancelado quando o separador fica oculto e retomado quando regressa a primeiro plano.
- O tempo de frame é reiniciado ao retomar, evitando um delta excessivo que cause saltos na câmara.
- Foram adicionados handlers para `webglcontextlost` e `webglcontextrestored`; a renderização pára durante a perda do contexto e tenta retomar após a recuperação.
- A subscrição de eventos WebGL é removida em `dispose()`, juntamente com os restantes listeners.
- A experiência mantém o fallback React existente para erro de WebGL.

### Testes acrescentados

Em `src/features/camping/scene/camping-object-contracts.test.ts` foram acrescentados testes ao perfil Low móvel, ao perfil High desktop e ao fallback quando as APIs de memória não existem. O teste está incluído no passo de Engineering tests já configurado em `.github/workflows/ci.yml`.

## Auditoria do asset 3D

O GLB actual `public/models/camping/xoyens-studio.glb` declara **1 321 544 bytes** (aproximadamente 1,32 MB), 102 meshes, 150 primitivas, 26 materiais e 15 entradas de textura. O ficheiro inclui 13 imagens PNG embebidas, enquanto o logo e o selo oficiais são referências externas. O manifesto indica 17 slots de retrato, alinhados com o roster oficial, e a geometria é glTF real, não uma panorâmica usada como fundo.

O GLB não declara extensões de compressão Meshopt, Draco ou KTX2. Nesta execução não foi reexportado o modelo: a transferência de cerca de 1,32 MB é pequena, e uma pipeline de compressão nova implicaria adicionar decoder e validar compatibilidade/qualidade antes de reduzir esse custo. A prioridade implementada foi reduzir o custo GPU por dispositivo e deixar a suspensão do renderizador previsível. Meshopt/KTX2 fica como optimização condicionada a uma medição de carregamento e desempenho em dispositivos físicos, não como alteração especulativa do asset.

## Estado dos commits e publicação

- Runtime com perfil adaptativo e gestão de contexto: `2eede7f4157f603bc9c27202b60d496c3fd7f25b`.
- Limpeza do fallback React após restauração WebGL: `a53c96eb155e9708fd3cd5abf4bee5f10596aaf4`.
- Testes unitários do perfil gráfico: `51a3b6274e2301aadcb49a767d8e91407ede489c`.
- Guardas de tipos explícitos para as APIs de memória e núcleos opcionais e classificação correcta do perfil High: `dff0e317da92103513d3cca4e254ed41bcbe4966` (HEAD de código observado na `main` durante esta revisão).

A Vercel concluiu com estado `READY` o deployment `dpl_EFQp7RCZ4GY84qLtWmx3Q4nJMVTf`, associado ao commit de runtime `2eede7f`, com os aliases `syndicate-drop-zone.vercel.app`, `syndicate-drop-zone-kutuzov.vercel.app` e `syndicate-drop-zone-git-main-kutuzov.vercel.app`. A consulta posterior ao alias de produção resolveu para esse deployment.

O estado combinado para o commit mais recente `51a3b627` reportou falha da Vercel com `upgradeToPro=build-rate-limit`. Portanto, a publicação Vercel está no commit de runtime `2eede7f`, não no HEAD completo `51a3b627`. A correcção do callback de recuperação e os testes estão na `main`, mas não foram confirmados como parte do deployment Vercel. Não foi feita promoção manual de uma versão antiga.

O projecto Lovable reporta `status=ready` e `latest_commit_sha=51a3b627`, com screenshot de preview gerado. Foi submetido um pedido de publicação para `https://syndicate-do-trap.lovable.app`; a ferramenta devolveu inicialmente `pending`, pelo que esse deployment alternativo não é contado como READY. As ferramentas de browser disponíveis não conseguiram abrir directamente os URLs para inspeccionar visualmente a cena.

## Critérios ainda pendentes

1. Resultado confirmado de Vitest e Playwright. O conector de workflows GitHub disponível não devolveu os runs de push, e a falha Vercel por limite de builds não é evidência de aprovação ou reprovação dos testes.
2. Inspecção visual de `/camping` no browser, incluindo entrada 808, carregamento do GLB, context loss/restore e modo alternativo.
3. Matriz de dispositivos reais: Chrome desktop, Safari/iPhone, Android e browsers móveis com capacidades WebGL distintas. Não há medições FPS, memória GPU ou tempos de carregamento de dispositivos físicos nesta execução.
4. Roundtrip autenticado OWNER/EDITOR do Control Room permanece pendente da Fase 5. A sessão administrativa não foi simulada.
5. Activar leaked-password protection nas definições de Auth do Supabase antes da certificação de segurança completa.

**Conclusão:** a optimização adaptativa e a suspensão de renderização em segundo plano foram implementadas e o commit de runtime foi publicado. A Fase 6 continua aberta até os testes automatizados, a validação visual cross-device, a sincronização de publicação e os gates de segurança terem evidência independente.


## Actualização de execução · 2026-10-12

Foi implementada uma primeira correcção concreta da composição com o helper `src/features/camping/scene/camping-reference-composition.ts`, integrado no carregamento do GLB. Esta intervenção preserva o motor, a rota `/camping`, o código 808, as portas, as interacções, o roster real de 17 artistas, o Control Room e os serviços actuais.

Alterações incluídas na `main`:
- Suprimir o painel horizontal plano de tecto e expor as faces interiores da abóbada.
- Reduzir a altura visual do parquet e assentar as tábuas sobre o pavimento existente.
- Aplicar acabamento mate preto ao chão fotográfico e escurecer o pano original.
- Ampliar o selo oficial e reposicionar/reduzir o stand.
- Reduzir a intensidade do relevo procedural do estuque e alterar o enquadramento inicial pós-808.
- Actualizar o colisor de movimento para acompanhar a posição real do stand.
- Adicionar testes de contrato de composição e um teste de folga lateral do colisor.

Commits da intervenção: `79d709f8fc7d60ffe1380b8cfe84fc0429562a48`, `ee47196cd76ad9add3915101f83ce0e2567c5a20`, `37ed8cb85033e824d0594bcdd096e7b1f46d9e0a`, `c81d13faf07800eabfd41a93447c4d502124f429`, `e61247d4109f41ecc2d55a1d8f2fc06aa34bd823`, `99ae33e51a4b5b19c7ade7aa49482b88af6a91b4`, `f093cd34d9753931c014e2c10bdbb2adc52ed71a` e `c5d88a1d519572211520ff52e38ade20f926bb4e`. Os materiais alterados especificamente para o chão fotográfico, o pano e o estuque são clonados por mesh antes da mudança, evitando efeitos colaterais em outros objectos que partilham materiais GLB.

Não houve alterações de schema, migrações, dados de produção, RLS, Auth ou contratos de backend. A base de dados e o Control Room foram deixados intactos.

### Estado após a alteração

- GitHub `main`: contém a alteração de geometria runtime e os testes.
- Lovable: sincronizado pelo menos até `c81d13f` na última consulta; é necessário confirmar a sincronização final de `e61247d`.
- Vercel: o check foi observado como `pending`, com deployment de produção em `QUEUED/BUILDING`; ainda não há confirmação de estado `READY` para o HEAD mais recente.
- CI GitHub Actions: o conector consultado não devolveu runs de push para o SHA verificado. Não declarar Vitest, lint, build ou Playwright aprovados sem os seus logs.
- Browser: a URL de preview e a rota pública `/camping` não ficaram acessíveis à ferramenta de browser usada nesta execução. A revisão visual em pixels continua pendente.

A Fase 6 permanece aberta até confirmar os testes automatizados no commit final, inspeccionar visualmente a cena com o código 808, validar as 17 fotografias e os assets oficiais, e confirmar que o deployment publicado contém o mesmo SHA da `main`.
