# CAMPING V3 · Estado das 22 fases

Última actualização: 2026-10-13  
Branch de execução: `main`  
Referência: `docs/camping-v3/reference/reference-sectors.json`  
Hash da panorâmica original: `998f637c62fad46c1459a0c85c99db79f2f799951b9d2c4c38b659ad2e193813`  
Regra de release: nenhuma fase fica concluída sem evidência reproduzível, testes e CI verde.

Issues de execução: [#33 Fase 01](https://github.com/edmundokutuzov333/syndicate-drop-zone/issues/33) a [#56 Fase 22](https://github.com/edmundokutuzov333/syndicate-drop-zone/issues/56), uma issue por fase.

| Fase | Entrega | Estado | Gate de conclusão |
|---:|---|---|---|
| 01 | Linha de base, instrumentação e harness de fidelidade | Em validação | baseline executado, API debug, 7 poses, 21 capturas aprovadas, CI verde |
| 02 | Toolchain e dependências | Pendente | Blender, KTX, glTF Transform e CI verificados |
| 03 | Scene Bible e plano métrico | Pendente | inventário validado, escala humana e sala fechada |
| 04 | Fonte da verdade em Blender | Pendente | ficheiro .blend e build reproduzível por CLI |
| 05 | Biblioteca de materiais PBR CC0 2K | Pendente | manifestos e licenças verificados |
| 06 | Casca arquitectónica fechada | Pendente | paredes, abóbada, portas, AC e condutas |
| 07 | Superfícies-herói | Pendente | soalho, vinil e bambu com densidade de texel definida |
| 08 | Zona de produção | Pendente | secretária, DAW, colunas, cadeira, painéis e LED |
| 09 | Zona fotográfica | Pendente | fundo, selo oficial, cabideiro, peças e luzes |
| 10 | Zonas esquerda e direita | Pendente | mural, sofá, bandeira, estante e quadro |
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
