# Contrato de promoção do modelo CAMPING V3

Este contrato é obrigatório em todas as fases que publicam ou alteram assets 3D. A ausência de um manifesto não autoriza fallback para um GLB antigo.

## Cadeia de entrega

1. Construir cumulativamente a partir de `scripts/blender/build_all.py`, exportar, optimizar com glTF Transform, validar e só depois promover.
2. Publicar os tiers por conteúdo: `xoyens-studio.high.<sha8>.glb`, `xoyens-studio.mid.<sha8>.glb`, `xoyens-studio.low.<sha8>.glb` e `xoyens-studio.colliders.<sha8>.glb`.
3. Publicar `public/models/camping/manifest.json` com `schema: 1`, `phase`, `commit`, `builtAt`, `sceneBibleSha256` e `files`. Cada ficheiro declara `role`, `tier`, `path`, `sha256`, `bytes`, `triangles`, `materials` e `primitives`.
4. O modelo é cumulativo. A mesma entrega usa o mesmo commit de origem e o SHA-256 exacto da Scene Bible usada no build.
5. Limites de transferência: high até 16 MiB, mid até 9 MiB, low até 5 MiB, colliders até 60 KiB. Não baixar budgets para obter aprovação.
6. O GLB visual não contém nós `COL_*`. O GLB de colisões é separado e cada malha de colisão identifica-se com nome `COL_*` e `extras.collider`.
7. `xoyens-studio.glb` é sempre o high-tier promovido desta fase; o legado tem rota própria `xoyens-studio.legacy.glb` e deve responder 404. O SHA do legado histórico está registado em `legacy-glb-sha256.txt`.
8. O runtime e as ferramentas de diagnóstico podem ler o manifesto para identificar o tier efectivamente carregado e expor `window.__SDT3D__` através de `model()`, `tier()`, `metrics()`, `freeze()` e `activate(id)`.

## Verificação obrigatória

Verificação local e remota:

```bash
node scripts/ci/verify-public-model.mjs --local public/models/camping --base <preview> --base <produção> --expect-phase 14 --legacy docs/camping-v3/legacy-glb-sha256.txt
```

O verificador compara os ficheiros locais com o manifesto, valida estrutura GLB, métricas, slots e colisores, descarrega os mesmos caminhos em cada base pública e compara os bytes servidos com os bytes promovidos. Erros de rede não provam que uma rota está inacessível e são tratados como falhas.

A certificação exige CI verde, deploy verde, Lovable sincronizada com a `main`, verificação HTTP de preview e produção e E2E público verde. Um check de deploy READY não substitui a verificação dos bytes.
