# Camera Production Validation

## Estado

**Estado final: PENDENTE**

A /camera passou a validação automatizada específica da superfície, mas não pode ser marcada FECHADA porque permanecem dois blockers:

1. Vercel production build bloqueado pelo rate limit da conta/build.
2. Matriz física de browsers e dispositivos ainda não executada com câmaras e microfones reais.

Último commit de aplicação validado pelo CI: b000af92fbfe8c4b12a598232e795238cb310c32.
Último commit de documentação/relatório em main: f574f083769dfdbfb72ad1f83d034a42df999262.

## Matriz automatizada

| Área | Resultado | Evidência |
|---|---|---|
| CameraManager constructor sem permission request | PASS | camera-engineering.test.ts |
| CameraManager 4K preference | PASS | camera-engineering.test.ts |
| DeviceManager FRONT/BACK | PASS | camera-engineering.test.ts |
| OrientationManager | PASS | camera-engineering.test.ts |
| CaptureTimer OFF/3s/10s | PASS | camera-engineering.test.ts |
| Six active filters | PASS | camera-engineering.test.ts |
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

Green run:
- Run 37648653599
- Commit b000af92fbfe8c4b12a598232e795238cb310c32
- Setup Node: PASS
- Install dependencies: PASS
- Camera lint: PASS
- Camera tests: PASS
- Production build: PASS

O full-project TypeScript não é gate desta validação porque existem erros estritos históricos fora da superfície /camera, incluindo rotas antigas e Control Room. Esses erros não foram mascarados como resolvidos.

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
Latest synced commit: b000af92fbfe8c4b12a598232e795238cb310c32

Preview:
https://id-preview--67a20cf5-03a6-4c64-ab1e-c6089a5ecca0.lovable.app

O runtime interactivo do preview não pôde ser exercitado neste ambiente: o mecanismo externo de browsing recusou o acesso ao host do preview e a tentativa de validação pela automação Lovable foi bloqueada por workspace sem créditos. O estado do projecto, a publicação, o commit sincronizado e o screenshot foram confirmados pela integração Lovable.

## Vercel

O GitHub status actual apresenta:
Vercel = failure

O target de status aponta para o rate limit de build da conta.

O CI independente executou o production build com sucesso. A falha de Vercel não foi mascarada como erro de código.

GitHub Issue #3 rastreia este blocker.

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

- CI do código da aplicação: 37648653599
- CI do relatório/documentação: 37649235905
- Commit validado: b000af92fbfe8c4b12a598232e795238cb310c32
- Lovable synced commit: f574f083769dfdbfb72ad1f83d034a42df999262
- Vercel: build-rate-limit blocker
- Supabase: sem tabelas de captura
- Issue #3: Vercel production build rate limit — OPEN
- Issue #4: physical browser-device validation matrix — OPEN
- Issues #1 and #2 — CLOSED as duplicates

## Critérios de aceitação

| Critério | Estado |
|---|---|
| CI verde | PASS |
| Deploy Vercel verde | BLOCKED |
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
| Issues | OPEN #3, #4 · CLOSED DUPLICATE #1, #2 |
| PRs | NONE |
| Estado production final | PENDENTE |

## Decisão

A /camera não está fechada em produção.

O código passou a validação automatizada específica da superfície, incluindo lint, testes e production build.

O fecho permanece bloqueado por:
1. Vercel production build rate limit.
2. Validação física em browsers e dispositivos reais.

Nenhum destes pontos é considerado PASS sem evidência real.
