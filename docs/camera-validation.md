# Camera Production Validation

## Estado

**Estado final: PENDENTE DE CERTIFICAÇÃO FÍSICA**

Base auditada antes desta actualização: `70996cc94c3879dbfb158dc552177784e50431ae` (`Add live per-preset camera tuning controls`).

Na auditoria de 09 Outubro 2026, o deploy de produção Vercel dessa base estava `READY` em `https://syndicate-drop-zone-6ee51s20w-kutuzov.vercel.app`, com o check combinado `Vercel = success`. Esse resultado pertence à base auditada e não substitui a verificação dos checks do novo commit desta actualização.

O código já tinha cobertura automatizada da rota /camera. A certificação física continua pendente para câmaras, browsers, permissões, codecs e profiling real em dispositivos. A Issue #4 permanece aberta até existir evidência efectiva. Não declarar 60 FPS em todos os dispositivos nem fidelidade pixel-exact sem medições e comparação real.

## Matriz automatizada

| Área | Resultado | Evidência |
|---|---|---|
| CameraManager constructor sem permission request | PASS | camera-engineering.test.ts |
| CameraManager 4K preference | PASS | camera-engineering.test.ts |
| DeviceManager FRONT/BACK | PASS | camera-engineering.test.ts |
| OrientationManager | PASS | camera-engineering.test.ts |
| CaptureTimer OFF/3s/10s | PASS | camera-engineering.test.ts |
| 22 filtros registados, incluindo os sete shaders glitch | PASS histórico | camera-engineering.test.ts |
| Dynamic shader uniforms | PASS | camera-engineering.test.ts |
| Adaptive performance | PASS | camera-engineering.test.ts |
| 4K landscape | PASS | camera-engineering.test.ts |
| 4K portrait | PASS | camera-engineering.test.ts |
| Maximum real resolution below 4K | PASS | camera-engineering.test.ts |
| Codec capability gating | PASS | camera-engineering.test.ts |
| Camera lint | PASS | GitHub Actions run 37648198179 |
| Camera tests | PASS | GitHub Actions run 37648198179 |
| Production build | PASS | GitHub Actions run 37648198179 |

## CI

Workflow: .github/workflows/ci.yml

Registo histórico de CI verde para a superfície da câmara:
- Run 37648653599
- Commit b000af92fbfe8c4b12a598232e795238cb310c32
- Setup Node, instalação, lint da câmara, testes da câmara e production build: PASS nessa execução

Este run é evidência de um commit anterior. O CI do commit produzido por esta actualização tem de ser lido no próprio SHA; não reutilizar este resultado histórico como se fosse o resultado do novo SHA.

## Filtros

Filtros activos:
- OP1UM
- XEROX
- CORRUPT
- NIGHTVISION
- THERMAL
- REDROOM

O caminho normal usa uma passagem de filtro. A troca usa dois framebuffers e cross-fade de 300 ms. Grain, noise, distortion, chromatic aberration e feedback são runtime uniforms. A engine mantém cache de shader programs, uniform locations e valores.

## Captura

Foto:
- OFF / 3s / 10s
- flash de 90 ms
- JPG sRGB
- PNG sRGB
- TIFF marcado unavailable

TIFF Adobe RGB / CMYK não tem encoder nativo no pipeline browser actual. O sistema não finge suporte nem altera extensão.

Vídeo:
- OFF / 3s / 10s
- REC state
- canvas.captureStream(60)
- microphone via AudioContext + MediaStreamDestination quando disponível
- fallback para audio track directa
- preview do Blob gravado
- download local
- cleanup de recorder, audio context e capture tracks

Codec policy:
- MP4: H.264/AVC + AAC-LC
- MOV: ProRes 422 HQ / 4444 + PCM
- MKV: H.265/HEVC + AAC/FLAC
- WebM: VP9/VP8 fallback

Nenhum formato solicitado é declarado suportado sem MediaRecorder.isTypeSupported().

## 4K e fallback

Quando a fonte é 4K real:
- landscape 3840×2160
- portrait 2160×3840

Quando a fonte não é 4K:
- captura continua disponível
- usa a máxima resolução real entregue pelo video track
- UI mostra a resolução disponível
- filename usa WIDTHxHEIGHT em vez de um falso 4K

A implementação nunca faz upscale de 1080p e chama o resultado de 4K.

## Countdown

O countdown é renderizado dentro da saída WebGL, não como HTML sobreposto.

Fluxo:
React state → WebGLEngine.setOverlayText → canvas 2D auxiliar → WebGL texture → overlay shader → Canvas Output.

Quando o countdown termina, a textura transparente é composta uma vez para limpar o número anterior.

## Orientação

A engine separa:
- screen orientation
- camera orientation
- render orientation
- capture orientation

A stream não é reiniciada quando a orientação muda. A alteração é aplicada via uniform de rotação.

A matemática está coberta pelos testes. O teste físico de portrait/landscape em iPhone e Android continua pendente.

## Performance

A engine mede:
- FPS
- frame time
- dropped frames
- render CPU time
- texture upload time
- shader compile time
- draw calls
- heap quando disponível
- GC events quando expostos
- device tier
- DPR
- render scale

Também existe adaptive render scale, complexity caps, shader cache, uniform cache, framebuffer reuse e render scheduling que evita 60 FPS sem stream activa.

## Cleanup

Implementado:
- MediaRecorder cleanup
- AudioContext close
- capture tracks stop
- camera tracks stop
- ObjectURL revoke
- WebGL destroy
- shader/texture/framebuffer cleanup
- PerformanceObserver disconnect
- orientation/resize/visibility listener cleanup
- WebGL context lost/restored recovery
- foreground/wake recovery

## Shell e regressão

A /camera continua isolada da shell global:
- sem TacticalNav
- sem footer normal
- sem global grain
- sem global scanlines

A rota /camera é lazy-loaded.

Rotas antigas preservadas:
- /
- /camping
- /membros
- /membros/$slug
- /revelacao
- /merch
- /control-room
- subrotas do Control Room
- /control-room/login

TacticalNav permanece:
00 HUB → 01 CAMPING → 02 ARTISTAS → 03 REVELAÇÃO → 04 CAMERA → 05 MERCH

## Backend

A /camera não usa Supabase para captura, uploads ou media persistence.

Schema público confirmado:
- partnership_requests
- reservations

Ambas com RLS activo. Não foram criadas tabelas ou storage específicos para a camera. Control Room não foi alterado.

## Lovable

Project: Sindicato do trap
Project ID: 67a20cf5-03a6-4c64-ab1e-c6089a5ecca0
Published: true
Status: ready
Agent finished: true
Último commit sincronizado antes desta actualização: 70996cc94c3879dbfb158dc552177784e50431ae

Preview:
https://id-preview--67a20cf5-03a6-4c64-ab1e-c6089a5ecca0.lovable.app

O runtime interactivo do preview não pôde ser exercitado neste ambiente: o mecanismo externo de browsing recusou o acesso ao host do preview e a tentativa de validação pela automação Lovable foi bloqueada por workspace sem créditos. O estado do projecto, a publicação, o commit sincronizado e o screenshot foram confirmados pela integração Lovable.

## Vercel

Estado observado na auditoria da base `70996cc94c3879dbfb158dc552177784e50431ae`:
- Deployment production: `READY`
- URL: `https://syndicate-drop-zone-6ee51s20w-kutuzov.vercel.app`
- Check combinado do commit: `Vercel = success`
- Deployment ID: `dpl_A7aDmYKEpiq2CvbhksUfvdrUC2FK`

Os estados de Vercel e dos checks devem ser sempre consultados no SHA exacto de cada actualização. Após cada novo commit, verificar o deployment e o check associados ao seu SHA.

## Dispositivos, browsers e versões

**CI:** GitHub Actions `ubuntu-latest`, Node.js 22.

**Runtime físico:** nenhuma versão de Safari, Chrome, Firefox, Edge ou Android/iOS foi marcada como testada porque a matriz física não foi executada neste ambiente. Não são inventadas versões ou resultados.

## Validação física

Não executada neste ambiente.

| Ambiente | Estado |
|---|---|
| iPhone Safari | PENDENTE |
| Android Chrome | PENDENTE |
| Desktop Chrome | PENDENTE |
| Desktop Firefox | PENDENTE |
| Desktop Edge | PENDENTE |
| Desktop Safari | PENDENTE |
| Webcam USB | PENDENTE |
| Low-end GPU | PENDENTE |
| Permission allow/deny/revoke | PENDENTE |
| Camera occupied | PENDENTE |
| Sleep/wake | PENDENTE |
| Orientation matrix completa | PENDENTE |
| Codec matrix real | PENDENTE |
| DevTools memory/GC profiling físico | PENDENTE |

GitHub Issue #4 rastreia esta matriz.

## PRs

Nenhuma PR foi aberta. As alterações foram executadas directamente na main, sem force push, rebase, amend ou squash.

## Evidências

- Base auditada antes desta actualização: `70996cc94c3879dbfb158dc552177784e50431ae`
- Deployment de produção observado nessa base: `dpl_A7aDmYKEpiq2CvbhksUfvdrUC2FK`, estado `READY`
- Check Vercel na base auditada: `success`
- CI histórico da câmara: run `37648653599`, commit `b000af92fbfe8c4b12a598232e795238cb310c32`
- CI do commit de aplicação `172939ce77e00781520404f185c655af88ffcad2`: lint da câmara, testes de engenharia e build passaram; o workflow global ficou em falha no teste E2E da rádio descrito na secção de resultados finais. O deploy Vercel do mesmo SHA está `READY` e o check Vercel está `success`.
- Supabase: sem tabelas nem endpoints criados para guardar ajustes temporários da câmara.
- Issue #3: CLOSED como nota de deployment histórico.
- Issue #4: OPEN, validação física de browsers/dispositivos.
- Issues #1 e #2: CLOSED como duplicados.

## Critérios de aceitação

| Critério | Estado |
|---|---|
| CI verde global | FAIL no run `37937051206`, por um teste E2E de formulário/foto não relacionado com a câmara; veja o relatório no fim |
| Deploy Vercel para o SHA de aplicação `172939ce77e00781520404f185c655af88ffcad2` | READY; check `Vercel = success` |
| Preview Lovable sincronizado | PASS |
| Sem erros de consola | PENDENTE de runtime físico |
| Sem leaks | PASS no cleanup/test path; físico PENDENTE |
| Filtros vivos | PASS |
| Cross-fade 300 ms | PASS |
| Foto e vídeo | PASS no automated/build path; físico PENDENTE |
| Timers | PASS |
| Countdown no canvas | PASS |
| Flash | PASS |
| Áudio | capability-gated; físico PENDENTE |
| Formatos pedidos | capability-gated; codec matrix físico PENDENTE |
| 4K real | source gate PASS; hardware confirmation PENDENTE |
| Fallback máximo real | PASS |
| Orientação sem restart | automated PASS; físico PENDENTE |
| Performance adaptativa | PASS |
| /camera isolada | PASS |
| Rotas antigas | build PASS; runtime físico PENDENTE |
| docs/camera-engineering.md | UPDATED |
| docs/camera-validation.md | UPDATED |
| Issues | CLOSED #3 · OPEN #4 · CLOSED DUPLICATE #1, #2 |
| PRs | NONE |
| Certificação física final | PENDENTE até a matriz real ser executada |

## Decisão

O código não deve ser descrito como totalmente certificado em produção enquanto a matriz física não for executada. A base auditada estava publicada e com o check Vercel em sucesso. A validade do novo commit é determinada pelos checks próprios desse SHA, não por runs históricos.

A certificação ainda pendente é a validação física em browsers, dispositivos e câmaras reais. Não são inventados resultados nem se fecha a Issue #4 sem evidência.

## Fase 3 — preview adaptativo consciente do dispositivo (09 Outubro 2026)

Estado da implementação de código: implementada nesta actualização; CI e deploy dependem da verificação do commit pós-alteração.

- O perfil inicial usa dimensões reais entregues pelo vídeo, frame rate do track quando exposto, tier estimado, DPR e complexidade do filtro.
- A política de adaptação usa custo de renderização e upload de textura como proxies de carga. A cadência do callback de uma fonte a 24/30 FPS não é usada isoladamente para baixar a qualidade do preview.
- A histerese exige duas janelas consecutivas de sobrecarga para começar a reduzir a escala e três janelas saudáveis para recuperar gradualmente.
- A captura permanece isolada da política do preview. A saída forçada não é adaptada; fontes abaixo de 4K mantêm dimensões reais e não recebem rótulo 4K falso.
- Os testes adicionados cobrem fonte 30 FPS saudável, sobrecarga persistente, recuperação com histerese, perfil 4K versus 1080p, fallback de capacidades desconhecidas, limites de filtros de alta complexidade e dimensões da captura preservadas.
- Nenhum teste físico de iPhone/Android/Desktop, validação térmica ou perfil de GPU real foi executado nesta actualização. Esses resultados continuam pendentes.

A validação global da câmara continua PENDENTE até a matriz de dispositivos reais ser executada. Os estados de CI, Vercel e publicação têm de ser verificados no SHA desta actualização; os registos de commits anteriores nesta página são evidência histórica e não substituem a verificação do commit actual.

## Glitch Camera Engine — Phase 1 validation scope

Seven new independently compiled live shaders were added: CRT CLASSIC, VHS TRACKING, NIGHT CCTV, DATAMOSH, FIRE BLOOM, NEON CYBERPUNK and ANALOG INTERFERENCE. The original 15 IDs are retained, producing 22 selectable filters in the current filter rail.

Automated coverage verifies registration, independent shader bodies, dynamic uniforms, the Datamosh temporal sampler and the rule that Datamosh cannot bypass its offscreen history target. The history pair is lazily allocated, capped at a 1280 px long edge and disposed with WebGL resources.

Reference files were inspected frame-by-frame where animated frames were present. Seven supplied files contained only one frame, so their missing temporal progression cannot be inferred from the uploaded asset; their visual treatment is mapped to the closest analog family instead of inventing source movement.

CI, deploy status and runtime preview access must be read from the exact Phase 1 commit. Physical tests across iPhone/Android/desktop cameras and visual comparison against the source footage remain pending until those environments can be exercised.

## Phase 2 — per-preset controls

Seven filter definitions now declare their own concrete uniform controls, including effect-specific uniforms where the common intensity/noise/distortion values were insufficient. Regression coverage checks unique uniform names, valid ranges, default values, the CRT scanline, VHS tracking/tearing, CCTV roll, Fire Bloom threshold/radius/warmth, and Neon glitch amount. The React panel is mounted inside the current shutter zone and reuses the capture canvas. No route, global shell, Control Room or database schema changes are part of Phase 2.

## Resultados finais da actualização de código

Commit de aplicação: `172939ce77e00781520404f185c655af88ffcad2`  
GitHub Actions: [run 37937051206](https://github.com/edmundokutuzov333/syndicate-drop-zone/actions/runs/37937051206)  
Deploy Vercel: [production deployment](https://vercel.com/kutuzov/syndicate-drop-zone/He12MjjqadUxDAWezDbGCbLffAXW)  
URL do deployment: https://syndicate-drop-zone-hulbtgvpf-kutuzov.vercel.app

| Verificação | Resultado no commit de aplicação |
|---|---|
| Instalação de dependências | PASS |
| Smoke test de encoder FFmpeg | PASS |
| Lint da câmara | PASS |
| Testes de engenharia, incluindo novos testes de uniforms e limites | PASS |
| Build de produção | PASS |
| Inspecção do WAV da rádio | PASS |
| Instalação do Chromium de Playwright | PASS |
| E2E global de rádio | FAIL, 8 passaram e 1 falhou |
| Deploy de produção Vercel | READY |
| Check Vercel | success |
| Compilação real dos shaders em WebGL e teste manual de /camera | Não verificado por browser interactivo neste ambiente |
| Matriz física iPhone, Android, desktop e webcams | PENDENTE, Issue #4 aberta |

O E2E falhado é `tests/radio/forms.spec.ts:73`, teste de criação de Cartão de Fã. A asserção `FOTOGRAFIA SELECCIONADA` não apareceu depois da selecção da imagem. Não é um teste da rota /camera. O mesmo teste, com a mesma asserção e o mesmo erro de `src/routes/__root.tsx:36` relacionado com `pathname`, também falhou no run anterior `37934265075`, associado ao commit base `70996cc94c3879dbfb158dc552177784e50431ae`. Por isso, a evidência indica uma falha preexistente fora desta alteração da câmara, não uma regressão introduzida pelo shader.

A certificação física não está fechada: não houve teste real de permissões, webcams, Safari/iOS, Android, aquecimento, GPU, codecs ou memória. O deploy READY e os testes automatizados não substituem essa matriz.
