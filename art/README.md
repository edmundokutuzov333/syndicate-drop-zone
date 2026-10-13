# CAMPING V3 editable source

The Scene Bible at docs/camping-v3/scene-bible.json is the source of metric dimensions, elements, materials, placement anchors, interactions and assembly rules.

## Build

Run npm run 3d:blend from the repository root after installing the pinned toolchain with npm run 3d:toolchain:install.

- art/xoyens-studio.blend: editable Blender source, intended for Git LFS once generated and verified.
- art/xoyens-studio.report.json: deterministic build metrics and contract summary.
- art/out/xoyens-studio.raw.glb: intermediate export used only to check glTF extras and UV channels. It is not the final compressed runtime asset.

The CI workflow builds these outputs and uploads them as a 14-day artifact. Do not check in an LFS pointer unless its matching binary has actually been uploaded. In the current source commit, the binary output remains pending a successful Blender runner.

Textures, bakes and generated GLBs are not hand-edited. Official Sindicato/Xoyens images must come from the existing official manifest; this phase deliberately creates no substitute logo, seal, garment print or artist portrait.
