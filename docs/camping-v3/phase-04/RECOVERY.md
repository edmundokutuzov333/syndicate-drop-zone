# Fase 04-R: Recuperação e certificação

## Estado factual

Os jobs 115231891106 (run 38378115395) e 115387875010 (run 38423793670) terminaram com runner_id=0, nome de runner vazio e steps=[]. Isto confirma que os jobs não chegaram a executar steps, mas não explica a causa. A leitura de Annotations pela integração disponível não devolveu o texto exacto; a classificação mantém-se UNKNOWN.

A evidência encontra-se em docs/camping-v3/phase-04/annotations.json e annotations.txt.

## Passo 0: obter a causa exacta

1. No GitHub, abrir o run falhado e copiar o texto integral da secção Annotations.
2. Em alternativa, numa máquina com um GITHUB_TOKEN autorizado para leitura de Actions e checks, executar:
   GITHUB_TOKEN=<token> node scripts/ci/read-run-annotations.mjs edmundokutuzov333/syndicate-drop-zone 38378115395 --json
3. O script guarda a resposta e a classificação. Causas reconhecidas: BILLING_BLOCK, ACTIONS_DISABLED, POLICY_BLOCK, NO_MATCHING_RUNNER, QUOTA e UNKNOWN.
4. Actualizar a issue 57 com o texto exacto e a causa classificada. Não declarar billing sem uma anotação que sustente essa causa.

## Checklist do proprietário

- GitHub Settings, Billing and licensing: verificar pagamentos, método de pagamento, orçamento de Actions e limites de utilização.
- Repositório Settings, Actions, General: verificar se Actions está activa e confirmar a política de acções permitidas da conta/organização.
- Executar manualmente o workflow Runner smoke test. Só depois de passar, executar Build CAMPING 3D.
- Não investir num runner self-hosted antes de identificar a causa, pois uma restrição de conta pode impedir a criação do job.

## Rotas de execução

A. Mac/Linux local: instalar Node 22, Python 3 e Git; executar node scripts/3d/doctor.mjs, bash scripts/3d/install-blender.sh, source scripts/3d/env.sh e bash scripts/3d/local-build.sh. Anexar o ZIP e o sidecar SHA-256 da pasta art/_delivery.

B. Docker: instalar Docker Desktop/Engine e executar bash scripts/3d/docker-run.sh. Em Apple Silicon, o container amd64 usa emulação.

C. Codespaces: criar Codespace na main, deixar o devcontainer instalar a toolchain e executar bash scripts/3d/local-build.sh. Descarregar a entrega em art/_delivery.

D. GitLab CI: espelhar o repositório no GitLab. O .gitlab-ci.yml chama o mesmo script e conserva artefactos mesmo em falha.

E. Repositório público isolado: só depois de testar um runner público e confirmar que nenhum segredo/backend é copiado. O repositório de build deve conter apenas os scripts e recursos necessários. Executar o Runner smoke test antes do build.

Todas as rotas usam scripts/3d/local-build.sh. Basta a primeira rota que produza um ZIP real e certificável.

## Modelo de pedido ao GitHub Support

Assunto: GitHub-hosted runners não são atribuídos (runner_id=0, steps=[]).

Os jobs terminam em cerca de 2–3 segundos antes do primeiro step, incluindo os workflows em ubuntu-24.04 e um workflow mínimo sem checkout. Repositório: edmundokutuzov333/syndicate-drop-zone. Runs de referência: 38378115395, 38370251389, 38370251431, 38370251512. Solicita-se identificar se a causa é billing/orçamento, política da conta/repositório, quota ou falha de provisionamento. Anexar as anotações integrais e o JSON obtido pelo leitor de anotações.

## Critérios de certificação

A entrega só fica certificada quando node scripts/3d/verify-delivery.mjs termina com a mensagem Fase 04 certificável e código 0. O verificador exige manifesto e checksums correctos, um .blend nativo (não ponteiro Git LFS) abaixo de 200 MiB, relatório Blender 4.5.x com os campos exigidos, GLB legível, IDs de interacção, exactamente 17 slots de artista, materiais, UV0 e UV1 em pelo menos 80% das primitivas, dez ou mais materiais e extras zone/lmGroup. O modo check-exit-codes exige validate=0, blend=0, blend-check=0 e verify=0.

O pipeline deve reabrir o .blend numa segunda invocação Blender e validar colecções, nomes, materiais, UVs e escalas. Não reduzir os budgets nem inventar ficheiros ou hashes. A Fase 04 fica aberta até que os artefactos reais e o relatório de verificação satisfaçam todos os gates.
