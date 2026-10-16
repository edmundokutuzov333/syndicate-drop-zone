#!/usr/bin/env node
// Pipeline glTF: deduplicação, weld, LOD, instancing, compressão KTX2 e Meshopt.
// A cena-fonte deve ser produzida em fases posteriores; este CLI não inventa geometria.
import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function usage() {
  console.log(
    "CAMPING V3 GLB pipeline\n\n" +
    "Uso: node scripts/build-3d.mjs [art/out/xoyens-studio.raw.glb] [public/models/camping]\n\n" +
    "Gera xoyens-studio.high.glb, xoyens-studio.mid.glb e xoyens-studio.low.glb.\n" +
    "Requer @gltf-transform/*, meshoptimizer, sharp, KTX-Software (ktx + toktx) e uma cena-fonte GLB.\n" +
    "O pipeline falha se a fonte não existir, se a compressão KTX2 não estiver disponível ou se os budgets de saída forem excedidos."
  );
}

if (process.argv.slice(2).some((arg) => arg === "--help" || arg === "-h" || arg === "help")) {
  usage();
  process.exit(0);
}

const [srcArg = "art/out/xoyens-studio.raw.glb", outArg = "public/models/camping"] = process.argv.slice(2);
const src = resolve(srcArg);
const outDir = resolve(outArg);

if (!existsSync(src)) {
  console.error("Cena-fonte em falta: " + src);
  console.error("A cena .blend e o GLB cru pertencem às fases de modelação/exportação. Não será criado um modelo fictício.");
  process.exit(2);
}

try {
  const [{ NodeIO, PropertyType }, { ALL_EXTENSIONS }, functions, meshoptimizer, sharpModule, cli] = await Promise.all([
    import("@gltf-transform/core"),
    import("@gltf-transform/extensions"),
    import("@gltf-transform/functions"),
    import("meshoptimizer"),
    import("sharp"),
    import("@gltf-transform/cli")
  ]);
  const { dedup, weld, simplify, prune, textureCompress, meshopt, reorder, quantize, flatten, join } = functions;
  const { MeshoptEncoder, MeshoptSimplifier } = meshoptimizer;
  const sharp = sharpModule.default;
  const { Mode, toktx } = cli;
  const { execFileSync } = await import("node:child_process");

  for (const command of ["ktx", "toktx"]) execFileSync(command, ["--version"], { stdio: "ignore" });
  await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready]);

  mkdirSync(outDir, { recursive: true });
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
  const tiers = [
    // Preserve sharp base-colour textures while reducing costly PBR data maps.
    // These sizes are balanced against the transfer budgets in perf-budgets.json.
    { name: "high", maxTex: 2048, colorTex: 1024, dataTex: 512, ratio: 1.0, error: 0.0005 },
    // The Phase 08 furniture adds real upholstery, panel and audio geometry. The
    // medium/low tiers use stronger geometric reduction while keeping the same
    // checked budgets and all named interaction anchors.
    // Measured on the current Phase 09 source: ratio 0.25 / error 0.003 exceeded the mid triangle budget (155,486). Use stronger, bounded LOD reduction; do not relax budgets.
    { name: "mid", maxTex: 1024, colorTex: 512, dataTex: 256, ratio: 0.15, error: 0.01 },
    // Measured 2026-10-15: ratio 0.10 / error 0.010 yielded 93,040 triangles and 131 primitives vs budgets of 70,000 / 130.
    // Increase low-tier simplification tolerance without relaxing either budget.
    // Low-tier measurement was 77,274 triangles at ratio 0.08; increase LOD reduction to meet the fixed 70k triangle budget.
    { name: "low", maxTex: 512, colorTex: 256, dataTex: 128, ratio: 0.035, error: 0.04 }
  ];

  function descendantNodes(node) {
    const result = [];
    const visit = (parent) => {
      for (const child of parent.listChildren()) {
        result.push(child);
        visit(child);
      }
    };
    visit(node);
    return result;
  }

  function preserveContractMetadata(document) {
    const nodes = document.getRoot().listNodes();

    // Interactions can be exported on empty parent nodes. Copy their IDs to
    // descendant mesh nodes before pruning/flattening so raycasting still finds
    // the same interaction and the optimizer can protect the clickable mesh.
    for (const node of nodes) {
      const sourceExtras = node.getExtras() ?? {};
      // The scene bible's legacy iMac interaction belongs to prod.monitor_daw.
      // Blender's current export carries elementId but can omit interactionId on
      // this anchor, so restore the canonical runtime contract before flatten/join.
      const interactionId = typeof sourceExtras.interactionId === "string" && sourceExtras.interactionId
        ? sourceExtras.interactionId
        : sourceExtras.elementId === "prod.monitor_daw"
          ? "studio.imac"
          : null;
      if (!interactionId) continue;
      const targets = [
        ...(node.getMesh() ? [node] : []),
        ...descendantNodes(node).filter((child) => child.getMesh()),
      ];
      for (const target of targets) {
        const extras = { ...(target.getExtras() ?? {}) };
        if (typeof extras.interactionId !== "string" || !extras.interactionId) {
          extras.interactionId = interactionId;
          target.setExtras(extras);
        }
      }
      if (!sourceExtras.interactionId && sourceExtras.elementId === "prod.monitor_daw") {
        node.setExtras({ ...sourceExtras, interactionId: "studio.imac" });
      }
    }

    // zone/lmGroup are application metadata, not disposable exporter extras.
    // Carry each required classification onto one protected mesh before flatten.
    for (const key of ["zone", "lmGroup"]) {
      const sourceNode = nodes.find((node) => node.getExtras()?.[key] !== undefined);
      if (!sourceNode) continue;
      const targetNode = sourceNode.getMesh()
        ? sourceNode
        : descendantNodes(sourceNode).find((child) => child.getMesh());
      if (!targetNode) continue;
      const extras = { ...(targetNode.getExtras() ?? {}) };
      if (extras[key] === undefined) extras[key] = sourceNode.getExtras()[key];
      // Mark, rather than rename, the representative node. Renaming is unsafe
      // for exact runtime anchors such as the 17 studio.artist-slot.NNN nodes.
      extras.__campingPreserveMetadata = true;
      targetNode.setExtras(extras);
    }
  }

  function mergeLowTierMaterials(document, tierName) {
    const root = document.getRoot();
    const materials = new Map(root.listMaterials().map((material) => [material.getName(), material]));
    const redirects = {
      fabric_black_flag: "cotton_black",
      fabric_black_softbox: "cotton_black",
      steel_black_tube: "steel_black",
      // Mid/low LOD only: consolidate two close material variants to meet the
      // unchanged 40-material budget while retaining the full high-tier palette.
      // Both pairings share the same visible family; no source Blender material is edited.
      ...(tierName !== "high" ? {
        wood_reclaimed_top: "wood_reclaimed_planks",
        leather_black_tufted: "leather_black_quilted",
      } : {}),
    };
    const resolved = new Map();
    for (const [sourceName, targetName] of Object.entries(redirects)) {
      const sourceMaterial = materials.get(sourceName);
      const targetMaterial = materials.get(targetName);
      if (!sourceMaterial) continue;
      if (!targetMaterial) throw new Error("LOD material palette is missing canonical material " + targetName);
      resolved.set(sourceMaterial, targetMaterial);
    }
    let reassigned = 0;
    for (const mesh of root.listMeshes()) {
      for (const primitive of mesh.listPrimitives()) {
        const material = primitive.getMaterial();
        const target = material ? resolved.get(material) : undefined;
        if (target && target !== material) {
          primitive.setMaterial(target);
          reassigned += 1;
        }
      }
    }
    console.log("[LOD material palette] " + tierName + " reassigned primitives=" + reassigned +
      "; available redirects=" + resolved.size);
  }

  async function ensureBaseColorTextureResolution(document, minimum) {
    const textures = new Set(document.getRoot().listMaterials()
      .map((material) => material.getBaseColorTexture())
      .filter(Boolean));
    for (const texture of textures) {
      const source = texture.getImage();
      if (!source || source.byteLength === 0) continue;
      const input = Buffer.from(source);
      const metadata = await sharp(input).metadata();
      if (!metadata.width || !metadata.height) {
        throw new Error("Unable to read dimensions for a base-colour texture: " + (texture.getName() || "unnamed"));
      }
      const longestSide = Math.max(metadata.width, metadata.height);
      if (longestSide >= minimum) continue;
      // Upscale only base-colour maps that would violate the hero-texture floor.
      // Preserve the aspect ratio and artwork; do not weaken the budget or stretch decals.
      const resized = await sharp(input)
        .resize({ width: minimum, height: minimum, fit: "inside", withoutEnlargement: false })
        .png()
        .toBuffer();
      const resizedMetadata = await sharp(resized).metadata();
      if (!resizedMetadata.width || !resizedMetadata.height ||
          Math.max(resizedMetadata.width, resizedMetadata.height) < minimum) {
        throw new Error("Base-colour texture remains below the required " + minimum + "px floor: " +
          (texture.getName() || "unnamed"));
      }
      texture.setImage(resized);
      texture.setMimeType("image/png");
      console.log("[hero texture floor] " + (texture.getName() || "unnamed") + " " +
        metadata.width + "x" + metadata.height + " -> " + minimum + "px maximum side");
    }
  }

  for (const tier of tiers) {
    const document = await io.read(src);
    if (tier.name !== "high") mergeLowTierMaterials(document, tier.name);
    preserveContractMetadata(document);
    await ensureBaseColorTextureResolution(document, tier.colorTex);

    // Keep UV1 for lightmap workflows even when core glTF materials do not
    // reference TEXCOORD_1 directly. Preserve the custom extras at the same time.
    await document.transform(
      dedup(),
      prune({ keepLeaves: false, keepAttributes: true, keepExtras: true }),
      weld({ tolerance: 1e-4 }),
    );

    // Não achatar nem juntar nós com extras.interactionId: são contratos do produto.
    if (tier.ratio < 1) {
      await document.transform(simplify({
        simplifier: MeshoptSimplifier,
        ratio: tier.ratio,
        error: tier.error,
        lockBorder: true
      }));
    }

    // Do not apply global GPU instancing here: the transform batches shared meshes
    // across nodes without considering glTF extras, which would collapse the 17
    // independently clickable portrait slots. Static joining below provides the
    // required draw-call reduction while named interaction anchors remain distinct.

    // Keep named runtime anchors, interactions and moving details intact. Other
    // static Blender meshes become anonymous and are joined by compatible material
    // after flattening, reducing draw calls without shrinking triangle budgets.
    const protectedElementIds = new Set([
      "floor.wood", "floor.vinyl_sweep", "arch.vault_ceiling",
      "arch.door_main", "arch.door_left", "arch.ac_split", "arch.conduit_pvc",
      "arch.outlet_pair", "arch.switch_plate", "arch.soffit_box",
      "prod.desk_l", "prod.monitor_daw", "prod.monitors_pair",
      "prod.imac", "photo.backdrop_seal", "photo.garments", "photo.rack",
    ]);
    const protectedName = /camping-contract|studio\.|artist_slot_\d{3}|artists_wall|door_main_(stile_|rail_|handle_plate|lever|lock_cylinder|hinge_)|door_left_(stile_|rail_|handle_plate|lever|lock_cylinder|hinge_)|vault_ceiling|vault_rib_|monitor_daw_screen|photo_backdrop_seal|SDT_photo_garments_garment_[1-5]$/i;
    const nodes = document.getRoot().listNodes();
    const keepNode = (node) => {
      const extras = node.getExtras() ?? {};
      const nodeName = node.getName() ?? "";
      const elementId = typeof extras.elementId === "string" ? extras.elementId : "";
      // Phase 07 hero surfaces carry physical dimensions and vertex colour data;
      // keep their named nodes and extras intact instead of joining them into a generic
      // material batch. Later tiers may simplify their render geometry, not their contract.
      return Boolean(extras.interactionId) ||
        Boolean(extras.__campingPreserveMetadata) ||
        extras.surfacePhase === 7 ||
        protectedElementIds.has(elementId) ||
        protectedName.test(nodeName);
    };
    const preservedMeshes = new Set(nodes.filter(keepNode).map((node) => node.getMesh()).filter(Boolean));
    for (const node of nodes) {
      if (!keepNode(node)) node.setName("");
    }
    for (const mesh of document.getRoot().listMeshes()) {
      if (!preservedMeshes.has(mesh)) mesh.setName("");
    }
    await document.transform(
      flatten(),
      join({ keepNamed: true, cleanup: false, filter: (node) => !node.getName() }),
      prune({
        propertyTypes: [PropertyType.NODE, PropertyType.MESH, PropertyType.PRIMITIVE, PropertyType.ACCESSOR],
        keepAttributes: true,
        keepIndices: true,
        keepLeaves: false,
        keepExtras: true,
      }),
    );

    const slotsForColor = /^(?!.*(normal|occlusion|metallicRoughness|lightMap)).*$/;
    const slotsForData = /(normal|occlusion|metallicRoughness)/;

    // High tier: 1024px colour maps and 512px normal/ORM maps. The previous
    // single 2048px UASTC pass produced a 106.92 MiB GLB against a 16 MiB budget.
    await document.transform(
      textureCompress({ encoder: sharp, resize: [tier.colorTex, tier.colorTex], slots: slotsForColor }),
      textureCompress({ encoder: sharp, resize: [tier.dataTex, tier.dataTex], slots: slotsForData }),
    );
    await document.transform(
      toktx({ encoder: sharp, mode: Mode.ETC1S, slots: slotsForColor, quality: 192, compression: 4 }),
      toktx({ encoder: sharp, mode: Mode.UASTC, slots: slotsForData, level: 2, rdo: true, rdoLambda: 4, zstd: 18 })
    );

    await document.transform(
      reorder({ encoder: MeshoptEncoder }),
      quantize({ quantizePosition: 14, quantizeTexcoord: 12, quantizeNormal: 10 }),
      meshopt({ encoder: MeshoptEncoder, level: "high" })
    );

    const output = resolve(outDir, "xoyens-studio." + tier.name + ".glb");
    await io.write(output, document);
    console.log(tier.name + " -> " + output + " (" + (statSync(output).size / 1048576).toFixed(2) + " MB)");
    execFileSync(process.execPath, [
      resolve(dirname(fileURLToPath(import.meta.url)), "check-3d-budgets.mjs"), output, tier.name
    ], { stdio: "inherit" });
  }
} catch (error) {
  console.error("Build CAMPING 3D falhou:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
