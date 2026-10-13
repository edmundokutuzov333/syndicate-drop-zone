# Diagnóstico da atribuição de runners da Fase 04

Este workflow é deliberadamente mínimo e não instala dependências nem executa código da aplicação. Testa três imagens GitHub-hosted independentes: ubuntu-latest, ubuntu-24.04 e ubuntu-22.04.

## Interpretação

- Se um job chegar ao step "Report runner assignment", o runner foi atribuído. Nesse caso, a falha original pode estar relacionada com a imagem Ubuntu escolhida, e o pipeline 3D pode ser direccionado para a imagem que passou, mantendo o step do build.
- Se os três jobs falharem com `runner_id=0`, `runner_name` vazio e `steps=[]`, o workflow não executou nem o comando `echo`. Isto aponta para dispatch/provisionamento do GitHub Actions, configuração/política de conta, quota/concurrency ou incidente do serviço, não para Blender nem para o YAML do build.
- Se um job ficar `queued` mais do que cinco minutos, guardar o run ID e verificar o estado actual em https://www.githubstatus.com/.
- Não criar ou registar runners self-hosted sem uma máquina controlada pelo proprietário e um token de registo válido. Não desligar protecções de `main`.

## Contorno quando hosted runners estão indisponíveis

1. Usar uma máquina Linux x86_64 já administrada pelo proprietário do repositório, adicionar um self-hosted runner a Settings → Actions → Runners e usar os labels reais atribuídos pelo GitHub.
2. Não adicionar `runs-on: self-hosted` antes de existir pelo menos um runner online com os labels correspondentes, caso contrário os jobs ficam à espera.
3. Alternativamente, executar `npm run 3d:blend` localmente num equipamento com Blender 4.5.14, KTX-Software 4.4.2, Node 22 e dependências instaladas. Guardar stdout/stderr e os três artefactos. Validar antes de criar qualquer commit binário.

A prova de um runner mínimo não conclui a Fase 04. Ainda é necessário `npm run 3d:blend`, validar o contrato GLB e verificar o artefacto `.blend` real.
