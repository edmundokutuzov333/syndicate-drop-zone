# CAMPING V3 kit integration

This directory records the supplied Studio 3D kit as a compatibility layer on top of the existing CAMPING runtime.

## Active in the current renderer

- CampingStudioEngine keeps the current GLB, camera controller, collisions, 808 access reducer, room transitions, branded assets, portrait binding, and all userData.interactionId contracts.
- A live CanvasTexture now replaces the visual content of the existing studio.imac-screen mesh. Its track title is read from the existing frequency singleton. The movement on screen is an interface animation, not a claim that the browser measured live audio amplitude.
- Dynamic resolution uses frame interval feedback and hysteresis. It changes only render resolution scale, not the selected quality profile, device tier, input controls, shadows or materials. This keeps the project's single-profile behaviour while providing a measured response to sustained frame pressure.
- The supplied 43-element scene bible and performance targets are checked by npm run validate:camping-scene.
- The no-dependency GLB audit is available as npm run audit:camping-glb. It is deliberately not a CI gate yet because the current published GLB has not been baked, exported and verified against the KTX2, UV1 lightmap and Meshopt requirements in this kit.
- The deterministic geometry, photometry, lightmap budget, impulse response and panorama comparison helpers have unit tests in v3.test.ts.
- PBR policies now distinguish the semi-polished parquet from wood furniture, keep plaster/fabric matte and reduce reflections on screens and official print.

## Deliberately not activated from the kit

The kit contains no Blender source scene, replacement GLB variants, KTX2 lightmaps, Basis transcoder files, or baked texture atlases. The existing published GLB is the only complete scene asset. Therefore the original Blender build/bake pipeline cannot currently produce the promised high/mid/low assets and must not replace the production GLB.

The kit's alternate runtime loader still expects missing high/mid/low GLBs. Phase 02 now declares pinned postprocessing, n8ao and three-mesh-bvh packages, but they are not activated in the production renderer or controller. Basis transcoder files are generated into public/basis from the installed Three.js package during development and builds. The alternate walk controller would replace the existing collision/controller implementation, and its automatic quality-tier selector conflicts with this project's requirement to avoid choosing graphics configurations per device. These features remain disabled until their respective phase is tested.

Planar reflections, volumetric cones, dust particles and spatialized room audio are not switched on automatically. They need a camera/asset-aligned lighting pass and real browser validation; enabling them without the scene source would risk floor z-fighting, incorrectly directed beams, invented spatial audio behaviour or excess GPU cost.

## Steps needed for full asset-level rebuild

1. Add the licensed/source .blend scene that corresponds to the published Xoyens studio.
2. Verify object transforms and camera pose against the original 1774×887 panorama in Blender.
3. Bake and include the per-zone lightmaps plus KTX2/Basis support, or choose an installed and tested alternative.
4. Export and inspect replacement GLB variants with the kit's budget checker before changing the single live GLB path.
5. Run the actual desktop and mobile screenshot/runtime tests, with all 17 real portraits and brand assets loading.

No database/schema changes are required by this visual integration.
