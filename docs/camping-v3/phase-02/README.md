# Fase 02: Toolchain e dependências

## Implementação preparada na main

- Dependências fixas no package.json: postprocessing 6.39.5, n8ao 2.0.1, three-mesh-bvh 0.9.16, detect-gpu 5.0.70, @gltf-transform/* 4.5.1, meshoptimizer 1.3.0, sharp 0.35.4 e ktx-parse 2.0.0. @playwright/test já existia e foi mantido.
- Entradas de comando: 3d:validate, 3d:budget, 3d:build, 3d:bake, 3d:basis, 3d:toolchain:install e 3d:toolchain:check.
- scripts/install-3d-toolchain.sh instala Blender 4.5.14 e KTX-Software 4.4.2 em ~/tools em Linux x86_64. Verifica SHA-256 antes de extrair os pacotes.
- scripts/env.sh acrescenta os binários instalados ao PATH.
- scripts/copy-basis-transcoder.mjs gera public/basis/basis_transcoder.js e public/basis/basis_transcoder.wasm da versão de Three.js realmente instalada. Corre automaticamente em predev e prebuild.
- scripts/build-3d.mjs contém o pipeline de processamento dos três tiers, ajuda que pode ser executada sem imports, compressão KTX2 e verificações de orçamento. Não gera cena fictícia se a fonte faltar.
- .gitattributes marca GLB, KTX2, EXR e BLEND como binários.
- O CI principal valida os módulos Node e a presença dos ficheiros Basis. O workflow camping-3d-toolchain.yml valida separadamente Blender, Cycles, KTX, a interface CLI e o Scene Bible para não descarregar o Blender em todos os builds da aplicação.

## Decisões e limites

As dependências novas ainda não estão ligadas ao renderer ou ao controlador de colisões. Isso é deliberado: introduzir pós-processamento ou BVH em produção sem a respectiva validação poderia quebrar a cena e os contratos de navegação.

Real-ESRGAN não é instalado nesta fase porque não existe uma tarefa aprovada de upscale de placeholders. Os logótipos, o selo oficial e os retratos não podem ser substituídos por versões recriadas ou alteradas. A ferramenta deve ser avaliada quando existir um caso real na fase de props.

O script 3d:bake é apenas a entrada estável para a futura tarefa de bake. Não funciona até existir a cena-fonte da Fase 04 e scripts/blender/bake_lightmaps.py da Fase 13.

## Validação ainda obrigatória

1. Correr npm install --legacy-peer-deps e o workflow CAMPING 3D Toolchain com runner real.
2. Regenerar e reconciliar bun.lock com Bun, sem editar o lockfile manualmente. O repositório actualmente tem bun.lock mas o CI usa npm e não contém package-lock.json; a política de lockfile permanece por resolver.
3. Confirmar a execução de Blender headless, Cycles, ktx --version, toktx --version e node scripts/build-3d.mjs --help.
4. Confirmar o build, os testes de engenharia, os orçamentos e o estado da publicação.

A Fase 02 continua aberta até que estes gates sejam medidos e documentados. Nenhuma fase seguinte deve começar antes disso.
