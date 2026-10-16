# Recuperação de atribuição de runners da Fase 04

## Sintoma observado

O Runner smoke test é deliberadamente mínimo: não faz checkout nem instala dependências. Nas execuções disponíveis, tanto ubuntu-24.04 como ubuntu-22.04 falharam em aproximadamente 3–4 segundos com runner_id=0, nome de runner vazio e steps=[]. O workflow Build CAMPING 3D e a Camera Production CI exibem a mesma assinatura.

Isto demonstra que os jobs não chegaram a começar. Não é suficiente para concluir que a causa é billing, política, quota, concurrency, provisionamento ou incidente do serviço. As anotações exactas do run são o próximo dado obrigatório. A integração GitHub actual recusou o endpoint de Annotations, pelo que a causa está registada como UNKNOWN.

## Passo seguinte obrigatório

1. Abrir um run falhado no GitHub Actions e copiar o texto integral de Annotations.
2. Em alternativa, num ambiente com token autorizado para ler Actions e checks, executar:
   GITHUB_TOKEN=<token autorizado> node scripts/ci/read-run-annotations.mjs edmundokutuzov333/syndicate-drop-zone 38525746588 --json
3. Guardar o resultado em docs/camping-v3/phase-04/annotations.json e annotations.txt.
4. Resolver a causa descrita pela anotação. Se o diagnóstico continuar UNKNOWN, abrir um ticket no GitHub Support com os IDs dos runs e a ausência de runner.
5. Voltar a correr Runner smoke test. Só quando passar, executar Build CAMPING 3D.

## Possíveis famílias de causa

- BILLING_BLOCK: pagamentos falhados ou limite de utilização de Actions. Só classificar assim se a anotação o indicar.
- ACTIONS_DISABLED ou POLICY_BLOCK: Actions desactivadas ou uma política herdada impede o workflow.
- NO_MATCHING_RUNNER: labels de runner não disponíveis ou runner offline.
- QUOTA: utilização ou minutos excedidos.
- UNKNOWN: anotação indisponível ou texto sem correspondência. Não inferir.

## Rotas independentes do GitHub-hosted runner

A) Máquina do proprietário: executar bash scripts/3d/local-build.sh em Mac/Linux com Node 22, Python, Blender 4.5.14 e rede. A instalação de Blender verifica o SHA-256 oficial.

B) Docker: executar bash scripts/3d/docker-run.sh. Usa Linux amd64, incluindo emulação em Apple Silicon.

C) Codespaces: abrir o repositório na main, deixar o devcontainer instalar a toolchain e executar bash scripts/3d/local-build.sh.

D) GitLab CI: espelhar o repositório e usar o pipeline definido em .gitlab-ci.yml. A mesma entrada de build gera logs e artefactos.

E) Repositório público isolado de build: só após verificar as permissões e garantir que não são copiados segredos, dados de utilizador ou código privado desnecessário. Executar o smoke test antes do build.

Todas as rotas chamam scripts/3d/local-build.sh. A primeira rota que produzir uma entrega real válida é suficiente; as restantes não devem produzir artefactos redundantes.

## Certificação

A Fase 04 permanece aberta até que uma entrega real satisfaça o verificador com a mensagem Fase 04 certificável e código zero. A entrega tem de incluir o .blend real, relatório com campos exigidos, GLB conforme Scene Bible, manifesto/checksums, logs e códigos de saída. Não criar ponteiros LFS ou artefactos sintéticos no repositório.
