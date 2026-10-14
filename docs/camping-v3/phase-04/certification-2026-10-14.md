# Certificação da Fase 04 · 2026-10-14

**Estado:** CERTIFICADA. A certificação foi produzida por Blender real, não por artefactos simulados, e confirmada pelo verificador estrito e pela promoção do ficheiro-fonte por Git LFS.

## Execução real

- Workflow: [Build CAMPING 3D - Fase 04, run 38527906358](https://github.com/edmundokutuzov333/syndicate-drop-zone/actions/runs/38527906358)
- Commit usado para o build: `e40d013526e23162782c9ab0404228226022b6bd`
- Job do build: `115732530135`, runner atribuído `1000012342`, resultado `success`.
- Etapas `Syntax and recovery tests without Blender`, `Shared route build, reopen, validate and package`, `Write evidence summary` e `Upload outputs and evidence even on failure`: todas passaram.
- Tempo do passo completo de build, reabertura e validação: 67 segundos, das 07:23:00 às 07:24:07 UTC.
- Blender instalado e executado: **4.5.14 LTS**. O instalador validou o SHA-256 oficial do pacote.

## Correcções encontradas por execução

1. A primeira invocação real encontrou `IndentationError` em `scripts/blender/build_all.py` na linha que calculava `object_count`. Corrigido em [`4efa8dd`](https://github.com/edmundokutuzov333/syndicate-drop-zone/commit/4efa8ddfac9b120620e02748a67beff315d3028f).
2. A execução seguinte encontrou um objecto `Material` passado a `finish_mesh()`, que espera o nome do material. Corrigido em [`c258de8`](https://github.com/edmundokutuzov333/syndicate-drop-zone/commit/c258de8953e628b884c850e76a9f9323c4002d9c) para passar `rib_mat.name`.
3. A execução do commit `e40d013` passou o build, a reabertura do `.blend`, a validação GLB e o verificador final. Não foram relaxados critérios ou budgets.

## Contrato real da cena

O relatório de Blender validado contém:

| Medida | Resultado |
|---|---:|
| Versão do Blender | 4.5.14 LTS |
| Elementos do Scene Bible | 54 |
| Objectos | 378 |
| Objectos mesh | 371 |
| Vértices | 37 046 |
| Triângulos estimados | 62 864 |
| Materiais na cena Blender | 43 |
| Colecções requeridas | 7 |
| Duração reportada do build | 8,313 s |
| Ficheiro `.blend` | 8 248 183 bytes |

Colecções encontradas: `COL_shell`, `COL_production`, `COL_photo`, `COL_left`, `COL_right`, `COL_props`, `COL_colliders`.

O `.blend` foi reaberto num segundo processo Blender e `scripts/blender/validate_blend.py` confirmou `errors: []`.

## Contrato GLB real

| Medida / contrato | Resultado |
|---|---|
| Tamanho | 5 693 056 bytes |
| Nós | 359 |
| Malhas | 359 |
| Primitivas | 359 |
| Materiais | 38 |
| IDs de interacção esperados | 7/7 presentes |
| Slots de artistas | 17/17, numerados 001–017 |
| Slot 018 | Ausente, conforme contrato |
| Primitivas sem material | 0 |
| Primitivas sem UV0 | 0 |
| Primitivas sem UV1 | 0 |
| UV1 | 359/359 (100%) |
| Extras `zone` e `lmGroup` | Presentes |

Os sete IDs de produto confirmados são `studio.inner-door`, `studio.production-desk`, `studio.imac`, `studio.audio-system`, `studio.photo-backdrop`, `studio.merch-rack` e `studio.artists-wall`.

## Saída final do verificador

O comando executado foi:

```bash
node scripts/3d/verify-delivery.mjs . docs/camping-v3/scene-bible.json --check-exit-codes
```

Resultado: **`Fase 04 certificável`**, código de saída 0. As 15 entradas do manifesto passaram os seus checksums numa segunda verificação independente sobre o artifact descarregado.

Códigos de saída reais de `art/_delivery/exit-codes.txt`:

```text
doctor=1
install-blender=0
doctor-after-install=0
npm-install=0
recovery-tests=0
py-compile=0
validate=0
blend=0
blend-check=0
verify=0
```

`doctor=1` foi informativo: Blender ainda não estava instalado antes da etapa de instalação. O instalador devolveu 0 e `doctor-after-install=0`. Os quatro gates obrigatórios da certificação são todos zero.

## Promoção por Git LFS real

O job de publicação `115733117500` foi concluído com `success` dentro do mesmo run. A publicação ficou registada em [commit `ec362ec04665085dd2ce8ff6b5a13306b0727bd1`](https://github.com/edmundokutuzov333/syndicate-drop-zone/commit/ec362ec04665085dd2ce8ff6b5a13306b0727bd1).

- Caminho: `art/xoyens-studio.blend`
- Bytes do ficheiro real: `8248183`
- SHA-256 binário e OID Git LFS: `cfbffce61ed393a427b0f167847f05ba6dc1fa04df7fff64700def48909bbb58`
- O pointer foi produzido pelo filtro Git LFS; o script confirmou que o OID e o tamanho coincidiam com o ficheiro real. Nenhum pointer foi escrito manualmente.
- `git lfs ls-files --long --size` listou o ficheiro.
- `git lfs fsck --objects HEAD`, `git lfs push origin HEAD` e `git push origin HEAD:main` passaram.
- O SHA remoto de `refs/heads/main` coincidiu com o commit `ec362ec04665085dd2ce8ff6b5a13306b0727bd1`.

## Checksums SHA-256

| Ficheiro | Bytes | SHA-256 |
|---|---:|---|
| `art/xoyens-studio.blend` | 8 248 183 | `cfbffce61ed393a427b0f167847f05ba6dc1fa04df7fff64700def48909bbb58` |
| `art/xoyens-studio.report.json` | 876 | `dd8d7e576cbe1ab76536923d3e89b748e88b394dcb9a48f0178ab843f4ce0474` |
| `art/out/xoyens-studio.raw.glb` | 5 693 056 | `298a3ea8819f92cf21eecb540ba8bb04699762630a4aa7a655fdf46245c0a012` |
| ZIP final da entrega | 2 852 858 | `450695dd705c6f68231fa74c823e113855d5793b2c661348b0704b2bd42f25e7` |
| ZIP do artifact GitHub Actions | 7 895 305 | `88f150f558493ae7b6948901d60cd3b86643fa900293bb01fc93cf2fc0d7c3cb` |

Artifact do CI: [fase04-entrega-e40d013526e23162782c9ab0404228226022b6bd](https://github.com/edmundokutuzov333/syndicate-drop-zone/actions/runs/38527906358/artifacts/11876836734). Disponível até 2026-11-13.

## Diagnóstico histórico dos runners

Os runs antigos com `runner_id=0` e `steps=[]` não disponibilizaram o texto original da secção Annotations através da integração GitHub utilizada. A causa exacta permanece **UNKNOWN**: não há evidência para atribuir as falhas antigas a billing, política, quota ou provisionamento. A execução posterior foi atribuída a um runner e passou o pipeline real. O estado de certificação desta entrega baseia-se no build, na reabertura, nos contratos, nos checksums, nos códigos de saída e na promoção LFS confirmados acima.

As fases posteriores mantêm os seus próprios gates. A Fase 04 certificada não significa que as fases 05–22 estejam completas.
