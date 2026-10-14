# CAMPING V3 editable source

The Scene Bible at docs/camping-v3/scene-bible.json is the source of metric dimensions, elements, materials, placement anchors, interactions and assembly rules.

## Build

Run npm run 3d:blend from the repository root after installing the pinned toolchain with npm run 3d:toolchain:install.

- art/xoyens-studio.blend: editable Blender source, intended for Git LFS once generated and verified.
- art/xoyens-studio.report.json: deterministic build metrics and contract summary.
- art/out/xoyens-studio.raw.glb: intermediate export used only to check glTF extras and UV channels. It is not the final compressed runtime asset.

The CI workflow builds these outputs and uploads them as a 14-day artifact. Do not check in an LFS pointer unless its matching binary has actually been uploaded. In the current source commit, the binary output remains pending a successful Blender runner.

Textures, bakes and generated GLBs are not hand-edited. Official Sindicato/Xoyens images must come from the existing official manifest; this phase deliberately creates no substitute logo, seal, garment print or artist portrait.


The PBR material helper accepts optional color/sRGB, normal/Non-Color, ORM/Non-Color (R=AO, G=roughness, B=metallic), and height/Non-Color maps. Any requested missing file fails the build. Texture files and the approved brand decals will be introduced with provenance records in the material phase; this phase does not invent logos or seal artwork.


## Headless GitHub Actions build

Use `.github/workflows/build-3d.yml` for the authoritative CI build. It executes the pinned Linux toolchain, saves full command logs and uploads the `.blend`, JSON report, raw GLB, environment information and SHA-256 checksums as a 30-day workflow artifact. The `.blend` is not automatically committed; promote it to Git LFS only after inspection of the real successful build artifact.

## Phase 07 hero surfaces

`scripts/blender/build_surfaces.py` owns the physical walnut plank assembly, circular photo vinyl, continuous black-paper cyclorama and the calibrated UV scale of the existing bamboo vault. The module runs inside `build_all.py`; no GLB is edited by hand.

Required generated acceptance reports:
- `art/out/phase07-surfaces.json`: deterministic per-board geometry, row joints, surface dimensions and material scale.
- `art/xoyens-studio.phase07.report.json`: Blender-side geometry, UV, material roughness variation and raycast acceptance metrics.

The 3D workflow packages and rechecks both files, then promotes only an optimized GLB that still contains the Phase 07 surface contracts. The model metadata is bound to the exact canonical GLB SHA-256 and byte count. A failed or stale build cannot promote the previous public model.
