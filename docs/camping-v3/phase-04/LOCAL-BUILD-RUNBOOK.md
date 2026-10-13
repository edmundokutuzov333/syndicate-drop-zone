# Execução local alternativa da Fase 04

O runner GitHub-hosted tem falhado antes do primeiro step (`runner_id=0`, `steps=[]`). Se o diagnóstico mínimo falhar em todas as imagens, não se trata de um erro do comando do Blender.

Num computador Linux x86_64 controlado pelo proprietário:
1. Fazer checkout de `main`.
2. Instalar Node 22 e executar `npm install --legacy-peer-deps --no-audit --no-fund`.
3. Executar `npm run 3d:toolchain:install`, que fixa Blender 4.5.14 e KTX-Software 4.4.2 e valida os digests.
4. Executar `python3 -m py_compile scripts/blender/*.py`.
5. Executar `npm run 3d:validate`.
6. Executar `npm run 3d:blend`.
7. Verificar `art/xoyens-studio.blend`, `art/xoyens-studio.report.json`, `art/out/xoyens-studio.raw.glb`, extras glTF, UV0/UV1, materiais e os 17 slots.
8. Se o `.blend` estiver abaixo de 200 MiB, enviar o objecto binário através de Git LFS real. Não criar manualmente um ponteiro LFS.

Não fechar a issue #36 até haver logs do build e hashes/tamanhos dos artefactos.
