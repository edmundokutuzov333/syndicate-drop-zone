# CAMPING V3 · Estado das 22 fases

Última actualização: 2026-10-15  
Branch de execução: `main`  
Referência: `docs/camping-v3/reference/reference-sectors.json`  
Hash da panorâmica original: `998f637c62fad46c1459a0c85c99db79f2f799951b9d2c4c38b659ad2e193813`  
Regra de release: nenhuma fase fica concluída sem evidência reproduzível, testes e CI verde.

Issues de execução: fases 01–17 em [#33–#49](https://github.com/edmundokutuzov333/syndicate-drop-zone/issues/33); fase 18 em [#50](https://github.com/edmundokutuzov333/syndicate-drop-zone/issues/50); fase 19 em [#51](https://github.com/edmundokutuzov333/syndicate-drop-zone/issues/51); fases 20–22 em [#54–#56](https://github.com/edmundokutuzov333/syndicate-drop-zone/issues/54). Os duplicados #52 e #53 foram fechados.

| Fase | Entrega | Estado | Gate de conclusão |
|---:|---|---|---|
| 01 | Linha de base, instrumentação e harness de fidelidade | Em validação | baseline executado, API debug, 7 poses, 21 capturas aprovadas, CI verde |
| 02 | Toolchain e dependências | Em validação | dependências, Blender, KTX, Basis, build CLI, lockfile e CI confirmados por execução |
| 03 | Scene Bible e plano métrico | Em validação | 54 elementos, escala humana, 4 paredes/2 portas, orçamento ≤260000 e 72 células sector/elev validados; CI ainda pendente |
| 04 | Fonte da verdade em Blender | Certificada | Blender 4.5.14 executado e reaberto em CI; GLB e Scene Bible validados; validate/blend/blend-check/verify=0; fonte .blend publicada em Git LFS real (commit ec362ec) |
| 05 | Biblioteca de materiais PBR CC0 2K | Certificada | 20 conjuntos CC0 2K, manifesto/licenças/hashes e build Blender real aprovados no run 38538988505 |
| 06 | Casca arquitectónica fechada | Em validação | abóbada sólida, portas, AC, conduta, zero non-manifold, 3.000 raios interiores e pipeline Blender aprovados |
| 07 | Superfícies-herói | Em validação | malha de tábuas reais, variação COLOR_0, vinil circular, cyclorama contínuo, UVs físicos do bambu e gate Blender/GLB/deploy em execução |
| 08 | Zona de produção | Em validação | geometria no modelo V3 de fase 08; capturas A/B, gate visual e CI final ainda por certificar |
| 09 | Zona fotográfica | Em validação | build Blender + captura/checksums + GLB optimizado promovido para a URL canónica + gate Vite fase 09+ + confirmação HTTP do modelo servido em produção |
| 10 | Zonas esquerda e direita | Implementação iniciada, não certificada | validator dedicado adicionado; falta execução Blender, capturas e CI de fase |
| 11 | Props orgânicos, IA e trilho de splats | Pendente | guitarra, plantas e gate de splats |
| 12 | UV2 e orçamento de lightmaps | Pendente | UV2 validado e atlas por zona |
| 13 | Luz em Blender e bake | Pendente | bake reproduzível, denoise e mapas sRGB |
| 14 | Pipeline glTF, KTX2 e Meshopt | Pendente | GLB high/mid/low dentro dos orçamentos |
| 15 | Runtime, loader, tiers e contratos | Pendente | carregamento progressivo e lightmaps activas |
| 16 | Renderer, cor e pós-processamento | Pendente | A/B de tone mapping e score mínimo 78 |
| 17 | Reflexos e atmosfera | Pendente | reflexos, cones e poeira calibrados |
| 18 | Ecrãs vivos e áudio espacial | Pendente | DAW, Frequência, IR e colunas sincronizados |
| 19 | Navegação, colisão e câmara | Pendente | BVH, teleport, tour e DOF verificados |
| 20 | Interacção, UI/UX/CX/SD | Pendente | sete hotspots ligados a fluxos reais e acessíveis |
| 21 | Performance, tiers e resiliência | Pendente | FPS, memória, culling, fallback e recuperação medidos |
| 22 | QA final, rubrica e release | Pendente | score ≥ 85, 21 goldens aprovados, canário e rollback |

## Estado real da Fase 01

Já existe no código a API de diagnóstico gated por `?debug3d=1`, as sete poses determinísticas, captura equirectangular, comparação CIE Lab por 72 sectores, métricas do renderer e overlay A/B. A API não deve ser exposta por defeito.

O manifesto de referência foi calculado a partir da imagem original de 1774×887 e identifica-a pelo SHA-256 acima. O PNG original ainda precisa de ser incluído em `docs/camping-v3/reference/studio-pano.png`; o manifesto de sectores não substitui a imagem de referência.

A linha de base histórica documenta quatro violações no GLB original: textura-herói abaixo do mínimo, UV1 ausente, KTX2/Basis ausente e Meshopt ausente. O ficheiro `phase-01/baseline-glb.txt` distingue estes valores documentados de uma execução fresca do comando. Foi adicionado `npm run check:camping-baseline`, que executa o checker real e exige exactamente as quatro violações conhecidas, sem baixar budgets. O teste Playwright da Fase 01 verifica que a API fica escondida por defeito e recolhe sete poses do perfil actualmente suportado. A execução de confirmação e a geração/aprovação das 21 capturas dos três tiers reais continuam pendentes.

As execuções GitHub Actions mais recentes falharam antes de expor passos de job (lista de passos vazia); isto não permite atribuir a falha a um teste de código. A Fase 01 não está certificada enquanto não existir uma execução válida de lint, testes, build, validadores e browser.

## Regras de actualização

- Actualizar este ficheiro e `DECISIONS.md` em cada fase.
- Não alterar os limites para fazer passar o GLB.
- Não remover IDs de interacção existentes nem alterar a origem dos 17 retratos.
- Não fechar issues sem resultados e links para evidência.
- Não afirmar medições de browser, FPS ou fidelidade que não tenham sido efectivamente recolhidas.

## Estado real da Fase 02

A configuração da toolchain foi adicionada à main: dependências JavaScript com versões fixas, comandos 3D, geração de Basis durante dev/build, instalador Linux x86_64 para Blender/KTX e um workflow de verificação isolado. O ficheiro docs/camping-v3/phase-02/README.md regista as versões e comandos de validação.

A instalação efectiva dos binários, a sincronização do bun.lock, a execução do CLI de build e o CI continuam como gates pendentes até que os comandos sejam executados num runner funcional. A existência dos scripts ou do workflow não é considerada prova de execução. Não activar pós-processamento, BVH ou novo renderer nesta fase.


## Estado real da Fase 03

O Scene Bible passou de 43 para 54 elementos com fonte, materiais, dimensões e orçamento individual. O orçamento planeado é 221 710 triângulos face ao limite high de 260 000; as sete fontes de luz do seed foram mantidas. O novo metricPlan define uma planta útil de 7,60 × 5,60 m, chão acabado em y=0, paredes de 2,85 m, chave da abóbada a 3,45 m, quatro paredes fechadas e dois vãos com folhas de porta.

O plano inclui 40 âncoras de posição, regras de montagem para superfícies e detalhes, câmara de calibração (0, 1,45, 0), âncoras humanas de escala, os sete IDs de interacção e 17 slots de artistas vindos do backend. Foram descritos cabos, tomadas, interruptores, uniões das gaiolas, parafusos, etiquetas, vincos do papel, palas do painel LED e rodízios. O validador verifica também as 24 fatias azimutais × 3 bandas de elevação.

**Divergência preservada:** o GLB publicado continua com envelope documentado de 14,2 × 9,2 m e as colisões continuam com os limites legacy. O plano 7,6 × 5,6 m é o alvo de reconstrução, não uma afirmação falsa sobre o asset actualmente publicado. O runtime/GLB não foi alterado nesta fase; a migração será feita no pipeline de modelo e nas fases de casca/runtime.

O verificador local sobre o candidato da Fase 03 devolveu 54 elementos, 221 710 triângulos orçamentados, 7 luzes, 24/24 sectores, 72/72 células sector/elev, 40 âncoras e 15 regras de montagem. O aviso sobre o envelope legacy é intencional. A Fase 03 continua em validação até haver CI real e preview verificado.


## Estado real da Fase 04

A arquitectura Blender é agora definida por scripts versionados em scripts/blender/: common.py, build_all.py, builders de casca/superfícies/produção/fotografia/lados/props, luzes, colliders, validação do .blend e exportação GLB. O comando npm run 3d:blend reconstrói a cena desde o zero a partir de docs/camping-v3/scene-bible.json, valida o contrato, exporta GLB cru e verifica extras e UVs. O workflow CAMPING 3D Toolchain foi ampliado para compilar a sintaxe Python, executar o build e carregar os artefactos.

A fonte editável `art/xoyens-studio.blend` foi gerada por Blender 4.5.14 LTS num runner GitHub Actions real, reaberta num segundo processo e certificada por `scripts/3d/verify-delivery.mjs`. O ficheiro tem 8 248 183 bytes e está publicada em Git LFS verdadeiro no commit `ec362ec04665085dd2ce8ff6b5a13306b0727bd1`; o SHA-256 do conteúdo binário é `cfbffce61ed393a427b0f167847f05ba6dc1fa04df7fff64700def48909bbb58`. O validador confirmou sete colecções, 378 objectos, 37 046 vértices, 62 864 triângulos estimados, 17 slots de artistas, sete IDs de interacção, UV0 em todas as primitivas e UV1 em 359/359 primitivas do GLB. A certificação integral está em `docs/camping-v3/phase-04/certification-2026-10-14.md`.

### Revisão geométrica pós-commit da Fase 04
Foi preparada uma correcção adicional à orientação das superfícies e à escala/orientação de alguns props. Esta revisão não altera o contrato do backend, os IDs de produto, o número de artistas nem os budgets. A certificação continua dependente de o runner executar Blender e os gates da pipeline.

### PBR and shading helper follow-up
The Blender common module now supports optional color/normal/ORM/height paths with color-space validation and named nodes, and includes Blender 4.x angle-based sharp-edge marking alongside Weighted Normal. No third-party textures have been added yet; the maps parameter is for the material asset phase. Os caminhos de API Blender deste helper foram executados na certificação real com Blender 4.5.14 LTS; a execução e os resultados estão ligados no registo de certificação da Fase 04.

A pipeline chama `python3` explicitamente para compilar os módulos e orienta a alavanca da porta no eixo horizontal. A primeira execução real revelou duas falhas de código, agora corrigidas em `4efa8dd` (indentação em `build_all.py`) e `c258de8` (nome do material enviado a `finish_mesh`). A execução final passou os testes de sintaxe, build Blender, reabertura, validação GLB e verificação final.


## Workflow de execução real da Fase 04

Foi adicionado `.github/workflows/build-3d.yml`, com `workflow_dispatch` e `push` em `main`, runner Linux x86_64, Node 22, Python 3.11, instalação de Blender 4.5.14/KTX-Software 4.4.2, Git LFS, validação da Scene Bible e construção/validação do `.blend`. Cada comando escreve logs em `logs/`; os artefactos e checksums são carregados por 30 dias. O workflow valida a fase somente quando os três ficheiros existem, o `.blend` reabre, o GLB cumpre o contrato e os códigos `validate`, `blend`, `blend-check` e `verify` são zero. A execução `38527906358` cumpriu esse gate e publicou a fonte verificada em Git LFS.


## Recuperação da Fase 04-R · 2026-10-14

Foi versionado o kit de recuperação multi-rota: instalação e diagnóstico de Blender, uma única entrada de build, logs e códigos de saída por etapa, manifesto de checksums, verificador de entrega, Docker, Codespaces, GitLab e GitHub Actions. Os workflows de diagnóstico redundantes foram substituídos por Runner smoke test e Build CAMPING 3D.

Causa-raiz do bloqueio de runners: UNKNOWN. Os metadados confirmam runner_id=0 e steps=[], mas o texto exacto das anotações não ficou disponível através da integração usada. A evidência está em docs/camping-v3/phase-04/annotations.json e annotations.txt. Não atribuir a falha a billing ou política sem a anotação original.

A execução de `38527906358` gerou os ficheiros com Blender real, voltou a abrir o `.blend`, validou o GLB e passou todos os gates. A promoção para LFS foi concluída no commit `ec362ec04665085dd2ce8ff6b5a13306b0727bd1`; não foram usados ficheiros sintéticos nem ponteiros LFS manuais.


### Testes locais do kit de recuperação · 2026-10-14
Foram executados e passaram a verificação de sintaxe Node dos quatro ficheiros .mjs do kit fornecido, bash -n dos três scripts .sh, parse JSON do devcontainer, parse YAML dos três workflows e quatro testes unitários do classificador/contrato GLB. O doctor local reportou Blender 4.5.14 ausente e sem acesso de rede ao servidor de downloads. A máquina local não executou Blender; a certificação vem da execução hosted `38527906358`, que instalou Blender 4.5.14, construiu, reabriu e validou a entrega real.


### Certificação final · 2026-10-14

- **Run de build real:** [Build CAMPING 3D - Fase 04 #38527906358](https://github.com/edmundokutuzov333/syndicate-drop-zone/actions/runs/38527906358), build source commit `e40d013526e23162782c9ab0404228226022b6bd`, runner atribuído e job concluído com `success`.
- **Promoção LFS:** [commit `ec362ec04665085dd2ce8ff6b5a13306b0727bd1`](https://github.com/edmundokutuzov333/syndicate-drop-zone/commit/ec362ec04665085dd2ce8ff6b5a13306b0727bd1). `git lfs ls-files`, `git lfs fsck --objects HEAD`, o SHA/size do ponteiro gerado pelo filtro e o push para `main` passaram.
- **Blender:** 4.5.14 LTS; 54 elementos Scene Bible; 378 objectos, 371 malhas, 37 046 vértices, 62 864 triângulos estimados; 43 materiais na cena; 7 colecções.
- **GLB:** 5 693 056 bytes; 359 nós, malhas e primitivas; 38 materiais; 7 IDs de interacção; 17 slots únicos (001–017), sem slot 018; todas as primitivas têm material, UV0 e UV1; 359/359 têm UV1; extras `zone` e `lmGroup` presentes.
- **Códigos de saída requeridos:** `validate=0`, `blend=0`, `blend-check=0`, `verify=0`. `doctor=1` reflecte apenas que o binário ainda não estava instalado antes da etapa de instalação; `install-blender=0` e `doctor-after-install=0`.
- **Checksums SHA-256:** `.blend` `cfbffce61ed393a427b0f167847f05ba6dc1fa04df7fff64700def48909bbb58`; `.report.json` `dd8d7e576cbe1ab76536923d3e89b748e88b394dcb9a48f0178ab843f4ce0474`; `.raw.glb` `298a3ea8819f92cf21eecb540ba8bb04699762630a4aa7a655fdf46245c0a012`; ZIP de entrega `450695dd705c6f68231fa74c823e113855d5793b2c661348b0704b2bd42f25e7`; artifact ZIP do Actions `88f150f558493ae7b6948901d60cd3b86643fa900293bb01fc93cf2fc0d7c3cb`.
- O pacote contém os três ficheiros gerados, logs, manifesto e códigos de saída. A causa original das falhas históricas de runner continua `UNKNOWN` até ser obtido o texto real de Annotations; isso não invalida a execução bem-sucedida que certificou esta entrega.


## Execução da Fase 05 · 2026-10-14

O pipeline de ingestão e validação foi preparado na main. A fase não fica concluída pelo simples facto de os scripts existirem. Exige recolha real de assets da API Poly Haven, manifesto validado, build e reabertura Blender, artefactos/checksums e CI relevante aprovado. Os mapas PBR são versionados em Git LFS; o GLB público e o runtime não são alterados nesta fase, ficando a optimização KTX2/Meshopt e a integração no runtime para fases posteriores.


## Estado real da Fase 06

A implementação permanece em validação até o workflow reconstruir e reabrir a fonte Blender. O módulo `scripts/blender/build_shell.py` cria uma abóbada de espessura real com caps de fecho, duas costelas principais e catorze secundárias, portas com painel recuado e ferragens, AC com nove lamelas, PVC com ramificações, tomadas, interruptor, rodapés segmentados nos vãos, cove/lancil, shadow gaps e soffit. `scripts/blender/validate_shell.py` verifica as arestas non-manifold, 18.000–25.000 triângulos de casca e 1.000 direcções de raio em cada um de três pontos no interior. A fase só será certificada quando os resultados reais confirmarem zero fugas e todos os gates de entrega.

## Estado da Fase 09 · Zona fotográfica

A implementação especializada está na main em `scripts/blender/phase09_photo.py` e é activada por `CAMPING_PHASE=9`. O construtor cria o rolo, decal do selo oficial, cabideiro, cinco peças de roupa, suportes de iluminação e detalhes de tripés. O selo e o logótipo Xoyens são obtidos dos manifestos oficiais existentes, não redesenhados.

A aceitação exige nove elementos fotográficos, selo de 2,2 m, cinco peças (duas t-shirts com selo, uma com marca Xoyens, dois hoodies, um com manga cinzenta), quatro rodas, materiais requeridos, duas capturas com SHA-256, metadados do modelo optimizado e confirmação da publicação em `/camping`. A fase permanece em validação até os gates CI e deployment passarem.

### Correcção do gate de publicação · 2026-10-15

A auditoria da integração encontrou uma incompatibilidade concreta: o guard de build do frontend exigia `phase=8` e `productionPhase=8`, apesar do pipeline de entrega estar configurado para construir e promover a Fase 09. Isso impediria uma build da Fase 09 mesmo depois de o Blender gerar e optimizar a zona fotográfica. O guard agora aceita fases certificadas de 08 a 22, exige que `productionPhase` corresponda à fase publicada e, a partir da Fase 09, valida os nove IDs de elementos fotográficos, os quatro materiais de marca/iluminação, as cinco malhas de roupa e as interacções `studio.photo-backdrop` e `studio.merch-rack`.

O verificador do pacote também passou a exigir metadados completos da zona fotográfica e os testes de entrega cobrem os artefactos e pré-requisitos da Fase 09. Commits: `661143f` (guard), `9ec67b8` (gate de metadados), `2e6028f` (testes de pré-requisitos). Esta correcção de código não certifica por si só o modelo: a Fase 09 continua em validação até o workflow Blender, capturas, promoção do GLB, CI e publicação em `/camping` serem confirmados por execução real.

### Bloqueio contra GLB anterior à Fase 09 · 2026-10-15

A regra de publicação foi tornada fail-closed. O Vite já não aceita um manifesto de fase 8: requer `version=3`, `phase>=9`, `productionPhase=phase`, `surfacePhase=7` e o contrato completo da fotografia. Isto impede que novos deployments com a versão antiga passem silenciosamente a compilação. O modelo público actualmente registado ainda indica `phase=8`, por isso a certificação permanece aberta até à promoção real do artefacto novo.

O verificador de produção deixou de aceitar fase 8 por defeito e exige, na rota canónica, SHA-256/bytes coerentes, as nove raízes de fotografia, os quatro materiais oficiais/iluminação exigidos no GLB, cinco malhas de roupa, 17 slots de artistas e interacções preservadas. O workflow 3D aguarda agora a confirmação do endpoint de produção após publicar; falha em vez de marcar sucesso se o Vercel continuar a servir metadados antigos. O pipeline local comum também executa `npm run lint`, `npm run test` e `npm run build` sobre o candidato optimizado antes de permitir a publicação.

A validação Blender da Fase 09 foi reforçada para inspeccionar todas as malhas da colecção fotográfica, garantindo `UVMap`, `UV_Lightmap` e materiais nas malhas dos cabides, roupas, suportes e decals, não apenas nos nove anchors do Scene Bible.

Commits de endurecimento: `d68212f` (Vite fail-closed fase 09+), `8f2b8c6` (verificador de produção), `104f38b` e `38004d0` (validação geométrica/material da fotografia), `87af35c` (lint/test/build pré-publicação), `2146d80` (verificação da rota pública após promoção).

**Limite de evidência:** o código e os gates estão na `main`; o modelo canónico existente não se transforma em fase 9 até o job Blender gerar, optimizar e promover o novo GLB. Não declarar o frontend actualizado só porque o commit de código foi aceite pelo GitHub ou porque um deployment de código ficou `READY`.

## Certificação concluída da Fase 09 e promoção frontend · 2026-10-15

**Estado actual: PUBLICADO E VERIFICADO EM PRODUÇÃO.** Esta secção substitui as notas de validação pendente acima, que reflectiam o estado antes da execução certificada.

- Commit de correcção de código: `fc12124fbb827d923b73616be2adb67ece2021b9` (gate de cinco roupas e manifesto de entrega estável).
- Commit do fluxo CI: `f4f31ef5e6c58cba3dba896041f95ce78586dca9` (evita a corrida de build do frontend antes da promoção).
- Commit da entrega Blender/GLB na `main`: `54394e8c3d512644bf3cb9ff1284d5be7678d0e6`, publicação através de Git LFS.
- Workflow `Build CAMPING 3D - Blender + frontend V3`, execução [#38724630207](https://github.com/edmundokutuzov333/syndicate-drop-zone/actions/runs/38724630207): **success**. Compilação Blender, reabertura, verificações do modelo, lint, testes, build frontend e capturas das Fases 06, 08 e 09 passaram.
- Verificação independente de produção na execução de publicação: **success**. A rota `https://syndicate-do-trap.lovable.app/models/camping/xoyens-studio.glb` serviu o modelo certificado e os metadados de Fase 09.
- Metadados canónicos: `version=3`, `phase=9`, `productionPhase=9`, `surfacePhase=7`, `status=blender-v3-published`.
- GLB canónico `public/models/camping/xoyens-studio.glb`: **13.524.856 bytes**; SHA-256 `fcbacc0c897c02a6b0a70837cd8e65f02883919d8f453032bfb217fd4c30b169`. O hash e o tamanho coincidem entre o GLB optimizado, o ficheiro público e os metadados.
- Runtime: `GLTFLoader + KTX2Loader + MeshoptDecoder`; `KHR_texture_basisu` e `EXT_meshopt_compression` presentes e validados.
- Compatibilidade preservada: 17 slots de artistas; nenhum slot 018; interacções `studio.inner-door`, `studio.production-desk`, `studio.imac`, `studio.audio-system`, `studio.photo-backdrop`, `studio.merch-rack` e `studio.artists-wall`.
- Zona de produção: 19/19 elementos e materiais PBR requeridos. Zona fotográfica: 9/9 elementos, cinco malhas de roupa, selo de 2,2 m e duas capturas verificadas por SHA-256.
- O teste regressivo `delivery manifest excludes mutable run logs and exit codes from file checksums` passou; os logs/códigos mutáveis já não invalidam o manifesto de entrega.

A regra continua fail-closed: qualquer artefacto público com fase anterior, hash/tamanho divergente ou contrato de compatibilidade inválido é rejeitado pelo build ou pelo runtime. Não houve alteração estética adicional nem edição manual do GLB/metadados certificados.


## Reabertura da certificação da Fase 09 · 2026-10-15

**Estado actual: REABERTA, NÃO CERTIFICADA.** Esta nota prevalece sobre a certificação anterior até os gates voltarem a passar.

- A execução [Camera Production CI #38770621421](https://github.com/edmundokutuzov333/syndicate-drop-zone/actions/runs/38770621421), no commit fc797c9dffcb24b6b8c07484dfd936e9121ef0d5, falhou na experiência pública de entrada. A página serviu uma versão anterior do modelo e a geometria do chão não permitiu certificar a pose de entrada.
- A execução [Build CAMPING 3D #38770621513](https://github.com/edmundokutuzov333/syndicate-drop-zone/actions/runs/38770621513) falhou antes da promoção. O optimizador produziu bounds locais quantizados [65534, 160, 48284]; o verificador tratou-os como metros e ignorou a escala/transforms do nó glTF. O candidato optimizado (8cefd5afa5904ebc423b829d549362369da1066f140960b05ac3d852669fac83) não foi promovido, enquanto o modelo canónico da branch manteve o hash af8799e5a998a374bb3f3f8e578a6b64b371971c98c79dcbd57cdaaa0d7d6a9e.
- A correcção aplica a hierarquia completa de transforms glTF aos oito cantos dos bounds locais e mantém os limites físicos em metros. Foram acrescentados testes para a escala quantizada e para uma superfície transformada em plano vertical.
- A CI passa a executar explicitamente camping-camera-poses.test.ts. O Playwright aceita a origem blender-v3-architectural-envelope, verifica a altura ocular de 1,62 m e rejeita o rótulo antigo LOADING / GLB. O rótulo visual é estável em MODEL / READY; o estado real continua nos atributos de diagnóstico e é validado separadamente.
- A promoção e a confirmação HTTP da produção ainda têm de passar. A Fase 10 permanece bloqueada até haver CI verde, experiência Playwright completa e confirmação de que a URL pública serve exactamente o GLB e os metadados da Fase 09.


## 2026-10-15 · D039 · Falha de bounds do GLB quantizado

A execução [Build CAMPING 3D #197](https://github.com/edmundokutuzov333/syndicate-drop-zone/actions/runs/38774468044) construiu e validou a fonte Blender, mas falhou antes da promoção do modelo. O erro estava no verificador do GLB optimizado: os limites POSITION de um accessor SHORT normalizado eram tratados como coordenadas em metros antes de aplicar as transformações. O candidato apresentava bounds de chão de 248 989,89 × 607,90 × 183 450,23 m, quando o contrato da Scene Bible exige aproximadamente 7,6 × 0,02 × 5,6 m.

A correcção em preparação descodifica min/max dos accessors normalizados de acordo com o componentType antes de combinar os bounds e aplicar a matriz de mundo. Não altera budgets nem relaxa a validação. O build anterior deixou o GLB canónico e o manifesto antigos, porque a promoção foi correctamente bloqueada.

A execução [Camera Production CI #729](https://github.com/edmundokutuzov333/syndicate-drop-zone/actions/runs/38774437065) também falhou contra o site publicado em Lovable: quatro testes não encontraram o texto esperado no indicador de estado (vazio ou `LOADING / GLB`). O código na main já contém o rótulo estático `MODEL / READY`, mas a publicação pública ainda não foi comprovada como sincronizada. A Fase 09 permanece em validação até uma nova build promover o modelo, os testes de browser passarem e o endpoint público servir os bytes com o SHA-256 do manifesto.


## 2026-10-15 · D040 · Verificação de produção contra o artefacto da main

A build [#38778515982](https://github.com/edmundokutuzov333/syndicate-drop-zone/actions/runs/38778515982) concluiu com sucesso a compilação Blender, a reabertura, as capturas das Fases 06/08/09 e a promoção para a main. O commit de publicação é [7f0cfbff93e3c4b8effce2d7b2165fa53ad744fd](https://github.com/edmundokutuzov333/syndicate-drop-zone/commit/7f0cfbff93e3c4b8effce2d7b2165fa53ad744fd). O modelo canónico em main tem 13 536 520 bytes e SHA-256 `d56f1c74b92b9b413cd0aed3b42c87aaca227bc6e8ece9beb0f2f3d94122a85d`.

A auditoria dos logs encontrou um falso positivo no verificador de produção: este aceitou a versão pública antiga porque comparava o GLB servido apenas com o manifesto servido pelo mesmo domínio. O endpoint devolveu SHA-256 `5a6180c1a355a8e8d63342cd1edbe2d64354859f1e88927e017e3ec7f9cec69d` e 13 524 620 bytes, diferentes do artefacto actual da main, apesar de o log ter escrito `CAMPING PRODUCTION MODEL CERTIFIED`.

A verificação foi reforçada para validar primeiro o GLB e o manifesto do checkout, e depois exigir que a metadata pública coincida com esse SHA-256, tamanho, fase e sourceCommit antes de descarregar/validar o modelo servido. Foi acrescentado um teste que reproduz o falso positivo anterior. A Fase 09 permanece aberta até o endpoint público servir exactamente o artefacto actual e os testes Playwright da entrada/porta passarem.


## Execução da Fase 10 · 2026-10-16

A Fase 10 foi aberta sem esperar pela certificação da Fase 09, conforme a ordem de execução. O construtor genérico `scripts/blender/build_sides.py` já processa os elementos `left.*`, `right.*` e `artists.wall` declarados na Scene Bible. Foi acrescentado um validador dedicado para verificar a presença de mural, rolo branco, bandeira Xoyens, sofá, estante e quadro no ficheiro Blender produzido. Este commit não declara a geometria certificada: a validação só passa a ser evidência depois de o script correr num Blender real e o relatório ser inspeccionado. A Fase 09 continua em validação devido à divergência real dos metadados/bytes/hash servidos pelo Lovable e às falhas dos testes públicos.
