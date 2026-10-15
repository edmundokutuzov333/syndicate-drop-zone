#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { phasePrerequisiteFailures } from "./pack-delivery.mjs";

export function parseGlb(b) {
  if (b.length < 20 || b.toString("ascii", 0, 4) !== "glTF") throw new Error("not a GLB");
  if (b.readUInt32LE(8) !== b.length) throw new Error("GLB total length mismatch");
  let offset = 12;
  let json = null;
  while (offset + 8 <= b.length) {
    const length = b.readUInt32LE(offset);
    const type = b.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (start + length > b.length) throw new Error("GLB chunk exceeds file");
    if (type === 0x4e4f534a) {
      json = JSON.parse(b.subarray(start, start + length).toString("utf8").replace(/\0+$/g, "").trim());
    }
    offset = start + length;
  }
  if (!json) throw new Error("GLB has no JSON chunk");
  return json;
}

export function blendKind(b) {
  if (b.toString("ascii", 0, 7) === "BLENDER") return "blend";
  if (b.length >= 4 && b.readUInt32LE(0) === 0xfd2fb528) return "blend-zstd";
  if (b.length >= 2 && b[0] === 0x1f && b[1] === 0x8b) return "blend-gzip";
  if (b.toString("ascii", 0, 24).startsWith("version https://git-lfs")) return "LFS-POINTER-FALSO";
  return "unknown";
}

export function glbContract(j, bible, { requirePhase7 = true, requirePhase8 = false } = {}) {
  const out = [];
  const check = (name, pass, detail = "") => out.push({ name, pass, detail });
  const nodes = j.nodes ?? [];
  const extras = nodes.map((node) => node.extras ?? {});
  const names = new Set(nodes.map((node) => node.name ?? ""));
  const wanted = [...new Set((bible.elements ?? []).map((element) => element.interactionId).filter(Boolean))];

  for (const id of wanted) {
    check("interactionId " + id, extras.some((extra) => extra.interactionId === id) || names.has(id));
  }

  const slot = (node) => (String(node.name ?? "") + " " + String(node.extras?.interactionId ?? ""))
    .match(/studio\.artist-slot-(\d{3})/)?.[1];
  const slots = new Set(nodes.map(slot).filter(Boolean));
  check("17 artist slots", slots.size === 17, slots.size + " found");
  check("no slot 018", !slots.has("018"));

  const primitives = (j.meshes ?? []).flatMap((mesh) => mesh.primitives ?? []);
  check("meshes present", primitives.length > 0, String(primitives.length));
  check("material on every primitive", primitives.length > 0 && primitives.every((primitive) => primitive.material !== undefined));
  check("UV0 on every primitive", primitives.length > 0 && primitives.every((primitive) => primitive.attributes?.TEXCOORD_0 !== undefined));
  const uv1 = primitives.filter((primitive) => primitive.attributes?.TEXCOORD_1 !== undefined).length;
  check("UV1 on at least 80% primitives", primitives.length > 0 && uv1 >= primitives.length * 0.8, uv1 + "/" + primitives.length);
  check("at least 10 materials", (j.materials ?? []).length >= 10, String((j.materials ?? []).length));
  check("extras zone and lmGroup", extras.some((extra) => extra.zone) && extras.some((extra) => extra.lmGroup));
  check("visual GLB excludes COL_* collision nodes", !nodes.some((node) => String(node.name ?? "").startsWith("COL_")));

  if (requirePhase7) {
    const findPhaseNode = (elementId, namePattern) =>
      nodes.find((node) => node.extras?.elementId === elementId && node.extras?.surfacePhase === 7) ??
      nodes.find((node) => namePattern.test(String(node.name ?? "")) && node.extras?.surfacePhase === 7);
    const floorNode = findPhaseNode("floor.wood", /floor_wood_hero/i);
    const vinylNode = findPhaseNode("floor.vinyl_sweep", /vinyl_sweep_hero/i);
    const bambooNode = findPhaseNode("arch.vault_ceiling", /vault_ceiling/i);
    const paperWallNode = nodes.find((node) => /paper_cyclorama_wall/i.test(String(node.name ?? "")) && node.extras?.surfacePhase === 7);
    const paperCurveNode = nodes.find((node) => /paper_cyclorama_curve/i.test(String(node.name ?? "")) && node.extras?.surfacePhase === 7);
    check("Phase 07 floor is a 100+ board running-bond mesh",
      Boolean(floorNode && Number.isInteger(floorNode.extras?.phase7BoardCount) && floorNode.extras.phase7BoardCount >= 100),
      String(floorNode?.extras?.phase7BoardCount ?? "missing"));
    const floorPrimitives = Number.isInteger(floorNode?.mesh) ? (j.meshes?.[floorNode.mesh]?.primitives ?? []) : [];
    check("Phase 07 floor COLOR_0, UV0 and UV1 retained",
      floorPrimitives.length > 0 && floorPrimitives.every((primitive) =>
        primitive.attributes?.COLOR_0 !== undefined &&
        primitive.attributes?.TEXCOORD_0 !== undefined &&
        primitive.attributes?.TEXCOORD_1 !== undefined),
      floorPrimitives.length + " floor primitives");
    check("Phase 07 vinyl radius, thickness and edge lift",
      Boolean(vinylNode) &&
        Math.abs(Number(vinylNode?.extras?.phase7VinylRadiusM) - 2.3) <= 0.003 &&
        Math.abs(Number(vinylNode?.extras?.phase7VinylThicknessM) - 0.0012) <= 0.0001 &&
        Math.abs(Number(vinylNode?.extras?.phase7VinylEdgeLiftM) - 0.004) <= 0.0001,
      vinylNode ? JSON.stringify({
        radiusM: vinylNode.extras?.phase7VinylRadiusM,
        thicknessM: vinylNode.extras?.phase7VinylThicknessM,
        edgeLiftM: vinylNode.extras?.phase7VinylEdgeLiftM,
      }) : "missing");
    check("Phase 07 bamboo tile length is 1.2 m",
      Boolean(bambooNode) && Math.abs(Number(bambooNode?.extras?.phase7BambooTileMeters) - 1.2) <= 0.0001,
      String(bambooNode?.extras?.phase7BambooTileMeters ?? "missing"));
    check("Phase 07 continuous black-paper cyclorama",
      Boolean(paperWallNode && paperCurveNode) &&
        Math.abs(Number(paperCurveNode?.extras?.phase7CycloramaRadiusM) - 0.35) <= 0.0001 &&
        paperCurveNode?.extras?.phase7PaperContinuousToFloor === true,
      paperWallNode && paperCurveNode ? "wall + curve connected contract" : "missing wall or curve");
  }
  if (requirePhase8) {
    const phase8Materials = new Set((j.materials ?? []).map((material) => material.name).filter(Boolean));
    for (const materialName of ["ceramic_red", "glass_mirror", "led_warm_emissive"]) {
      check("Phase 08 material " + materialName, phase8Materials.has(materialName));
    }
    check("Phase 08 live DAW screen node", nodes.some((node) => node.name === "SDT_production_monitor_daw_screen" && Number.isInteger(node.mesh)));
    for (const interactionId of ["studio.production-desk", "studio.imac", "studio.audio-system"]) {
      check("Phase 08 interaction " + interactionId, extras.some((extra) => extra.interactionId === interactionId) || names.has(interactionId));
    }
  }
  return out;
}

export function colliderGlbContract(j, expectedCount) {
  const out = [];
  const check = (name, pass, detail = "") => out.push({ name, pass, detail });
  const nodes = j.nodes ?? [];
  const colliderNodes = nodes.filter((node) => String(node.name ?? "").startsWith("COL_"));
  const meshNodes = nodes.filter((node) => Number.isInteger(node.mesh));
  const expectedIsValid = Number.isInteger(expectedCount) && expectedCount > 0;
  check(
    "COL_* nodes match Blender report",
    colliderNodes.length > 0 && expectedIsValid && colliderNodes.length === expectedCount,
    colliderNodes.length + " found; " + (expectedIsValid ? expectedCount + " expected" : "valid expected count missing"),
  );
  check(
    "every COL_* node has extras.collider",
    colliderNodes.length > 0 && colliderNodes.every((node) => typeof node.extras?.collider === "string" && node.extras.collider !== "" && node.extras.collider !== "none"),
  );
  check(
    "every collision mesh node is named COL_*",
    meshNodes.length > 0 && meshNodes.every((node) => String(node.name ?? "").startsWith("COL_")),
    meshNodes.length + " mesh nodes",
  );
  return out;
}

const parseCodes = (source) => new Map(source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
  const index = line.lastIndexOf("=");
  return index > 0 ? [line.slice(0, index), line.slice(index + 1)] : [line, ""];
}));

export async function verify(dir, biblePath, { checkExitCodes = false, phase = Number(process.env.CAMPING_PHASE || 8) } = {}) {
  const out = [];
  const add = (name, pass, detail = "") => out.push({ name, pass, detail });
  const manifestPath = [join(dir, "art/_delivery/manifest.json"), join(dir, "manifest.json")].find(existsSync);
  const manifest = manifestPath ? JSON.parse(readFileSync(manifestPath, "utf8")) : null;
  add("manifest present", Boolean(manifest));
  const currentPhase = Number(phase);
  if (!Number.isInteger(currentPhase) || currentPhase < 1 || currentPhase > 22) throw new Error("CAMPING phase must be an integer between 1 and 22");
  add("manifest phase matches requested phase", Boolean(manifest) && Number(manifest.phase) === currentPhase,
    String(manifest?.phase ?? "missing") + " / expected " + currentPhase);
  const prerequisiteFailures = phasePrerequisiteFailures(dir, currentPhase);
  add("phase prerequisites are ordered and certified", prerequisiteFailures.length === 0, prerequisiteFailures.join("; ") || "all prerequisite gates passed");

  if (manifest) {
    add("all required files in manifest", (manifest.missing ?? []).length === 0, (manifest.missing ?? []).join(", "));
    add("commit recorded", Boolean(manifest.commit && manifest.commit !== "unknown"), manifest.commit ?? "");
    const manifestPaths = new Set((manifest.files ?? []).map((file) => file.path));
    add("collider GLBs included in manifest", currentPhase < 14 || (
      manifestPaths.has("art/out/xoyens-studio.colliders.glb") &&
      manifestPaths.has("public/models/camping/xoyens-studio.colliders.glb")
    ), currentPhase < 14 ? "deferred until Phase 14" : "source and public collider files are required");
    add("frontend canonical GLB included in manifest", manifestPaths.has("public/models/camping/xoyens-studio.glb"));
    add("frontend model metadata included in manifest", manifestPaths.has("public/models/camping/xoyens-studio.model.json"));
    add("PBR material manifest included in delivery", manifestPaths.has("art/textures/materials.manifest.json"));
    add("Phase 08 production report included in delivery", currentPhase < 8 || manifestPaths.has("art/xoyens-studio.phase08.report.json"));
    for (const file of manifest.files ?? []) {
      const path = join(dir, file.path);
      if (!existsSync(path)) {
        add("checksum " + file.path, false, "missing");
        continue;
      }
      const bytes = statSync(path).size;
      const digest = createHash("sha256").update(readFileSync(path)).digest("hex");
      add("checksum " + file.path, bytes === file.bytes && digest === file.sha256, bytes + " bytes");
    }
  }

  const blend = join(dir, "art/xoyens-studio.blend");
  if (existsSync(blend)) {
    const kind = blendKind(readFileSync(blend).subarray(0, 64));
    add("real Blender file, not LFS pointer", kind === "blend" || kind === "blend-zstd", kind);
    add(".blend below 200 MiB", statSync(blend).size < 200 * 1048576, (statSync(blend).size / 1048576).toFixed(1) + " MiB");
  } else {
    add(".blend present", false, "missing");
  }

  if (currentPhase >= 7) {
    const surfaceSourceReportPath = join(dir, "art/out/phase07-surfaces.json");
    const surfaceValidationReportPath = join(dir, "art/xoyens-studio.phase07.report.json");
    if (existsSync(surfaceSourceReportPath)) {
      try {
        const phase7 = JSON.parse(readFileSync(surfaceSourceReportPath, "utf8"));
        add("Phase 07 source surface report", phase7.phase === 7 && phase7.floor?.boardCount >= 100 &&
          phase7.vinyl?.radiusM === 2.3 && phase7.bamboo?.tileMeters === 1.2 && phase7.cyclorama?.continuesToFloor === true,
          JSON.stringify({ phase: phase7.phase, boardCount: phase7.floor?.boardCount, vinylRadiusM: phase7.vinyl?.radiusM }));
      } catch (error) {
        add("Phase 07 source surface report", false, error instanceof Error ? error.message : String(error));
      }
    } else {
      add("Phase 07 source surface report", false, "missing art/out/phase07-surfaces.json");
    }
    if (existsSync(surfaceValidationReportPath)) {
      try {
        const phase7 = JSON.parse(readFileSync(surfaceValidationReportPath, "utf8"));
        add("Phase 07 Blender acceptance report", phase7.phase === 7 && phase7.status === "source-validated" &&
          phase7.floor?.boards >= 100 && phase7.floor?.verticalRaycastHits === phase7.floor?.boards &&
          phase7.floor?.roughness?.roughnessRange >= 0.08,
          JSON.stringify({ phase: phase7.phase, status: phase7.status, boards: phase7.floor?.boards,
            raycastHits: phase7.floor?.verticalRaycastHits, roughnessRange: phase7.floor?.roughness?.roughnessRange }));
      } catch (error) {
        add("Phase 07 Blender acceptance report", false, error instanceof Error ? error.message : String(error));
      }
    } else {
      add("Phase 07 Blender acceptance report", false, "missing art/xoyens-studio.phase07.report.json");
    }

  } else {
    add("Phase 07 source surface report", true, "deferred until Phase 07");
    add("Phase 07 Blender acceptance report", true, "deferred until Phase 07");
  }

  const productionReportPath = join(dir, "art/xoyens-studio.phase08.report.json");
  if (currentPhase >= 8 && existsSync(productionReportPath)) {
    try {
      const phase8 = JSON.parse(readFileSync(productionReportPath, "utf8"));
      const zone = phase8.productionZone ?? {};
      add("Phase 08 source production report", phase8.version === 1 && phase8.phase === 8 && phase8.status === "source-validated" &&
        zone.requiredElements === 19 && zone.midiWhiteKeys === 36 && zone.midiBlackKeys === 25 &&
        zone.acousticFabricPanels === 3 && zone.acousticFoamTiles === 30 && zone.pendants === 4 && zone.edisonBulbs === 4 &&
        zone.chairUpholsteryTrianglesSource >= 14000 && zone.chairUpholsteryTrianglesSource <= 18000,
        JSON.stringify({ phase: phase8.phase, status: phase8.status, chairTriangles: zone.chairUpholsteryTrianglesSource,
          midi: [zone.midiWhiteKeys, zone.midiBlackKeys], panels: zone.acousticFabricPanels, foam: zone.acousticFoamTiles, pendants: zone.pendants }));
    } catch (error) { add("Phase 08 source production report", false, error instanceof Error ? error.message : String(error)); }
  } else if (currentPhase >= 8) add("Phase 08 source production report", false, "missing art/xoyens-studio.phase08.report.json");

  const reportPath = join(dir, "art/xoyens-studio.report.json");
  let report = null;
  if (existsSync(reportPath)) {
    report = JSON.parse(readFileSync(reportPath, "utf8"));
    const version = String(report.blender_version ?? report.blenderVersion ?? report.blender?.version ?? "");
    add("Blender 4.5.x", /^4\.5\./.test(version), version || "?");
    add("duration_seconds", Number.isFinite(report.duration_seconds) && report.duration_seconds >= 0);
    add("objects", Number.isInteger(report.objects) && report.objects > 0);
    add("vertices", Number.isInteger(report.vertices) && report.vertices > 0);
    add("triangles_estimate", Number.isInteger(report.triangles_estimate) && report.triangles_estimate > 0);
    add("seven collections", Array.isArray(report.collections) && report.collections.length >= 7, JSON.stringify(report.collections ?? []));
    add("blend_bytes matches file", Number.isInteger(report.blend_bytes) && existsSync(blend) && report.blend_bytes === statSync(blend).size);
    if (currentPhase >= 14) {
      add("collider count present in Blender report", Number.isInteger(report.collectionObjects?.COL_colliders) && report.collectionObjects.COL_colliders >= 12, String(report.collectionObjects?.COL_colliders ?? "missing"));
    }
  } else {
    add("report present", false, "missing");
  }

  const bibleExists = Boolean(biblePath && existsSync(biblePath));
  const glb = join(dir, "art/out/xoyens-studio.raw.glb");
  if (existsSync(glb) && bibleExists) {
    try {
      for (const check of glbContract(parseGlb(readFileSync(glb)), JSON.parse(readFileSync(biblePath, "utf8")), {
        requirePhase7: currentPhase >= 7,
        requirePhase8: currentPhase >= 8,
      })) {
        add("GLB: " + check.name, check.pass, check.detail);
      }
    } catch (error) {
      add("GLB readable", false, error instanceof Error ? error.message : String(error));
    }
  } else {
    add("GLB and Scene Bible accessible", false, "missing");
  }

  const frontendGlb = join(dir, "public/models/camping/xoyens-studio.glb");
  const frontendMetadata = join(dir, "public/models/camping/xoyens-studio.model.json");
  if (existsSync(frontendGlb) && bibleExists) {
    try {
      const frontendJson = parseGlb(readFileSync(frontendGlb));
      for (const check of glbContract(frontendJson, JSON.parse(readFileSync(biblePath, "utf8")), {
        requirePhase7: currentPhase >= 7,
        requirePhase8: currentPhase >= 8,
      })) {
        add("Frontend GLB: " + check.name, check.pass, check.detail);
      }
      const used = new Set(frontendJson.extensionsUsed || []);
      add("frontend KTX2/Basis enabled", used.has("KHR_texture_basisu"));
      add("frontend Meshopt enabled", used.has("EXT_meshopt_compression"));
      if (existsSync(frontendMetadata)) {
        const metadata = JSON.parse(readFileSync(frontendMetadata, "utf8"));
        const digest = createHash("sha256").update(readFileSync(frontendGlb)).digest("hex");
        add("frontend metadata SHA-256 matches model", metadata.geometry && metadata.geometry.sha256 === digest, digest);
        add("frontend metadata points at canonical URL", metadata.model === "/models/camping/xoyens-studio.glb");
        add(
          "frontend metadata certifies Blender V3 Phase 08 production and Phase 07 surfaces",
          metadata.version === 3 && metadata.phase === currentPhase &&
            (currentPhase >= 8 ? metadata.productionPhase === currentPhase : metadata.productionPhase == null) &&
            (currentPhase < 7 || metadata.surfacePhase === 7) && metadata.status === "blender-v3-published",
          JSON.stringify({ version: metadata.version, phase: metadata.phase, productionPhase: metadata.productionPhase, surfacePhase: metadata.surfacePhase, status: metadata.status }),
        );
        add("frontend metadata byte count matches model", metadata.geometry?.bytes === statSync(frontendGlb).size);
        add("frontend delivery SHA-256 matches model", metadata.frontendDelivery?.sha256 === digest, metadata.frontendDelivery?.sha256 ?? "missing");
        add("frontend delivery byte count matches model", metadata.frontendDelivery?.bytes === statSync(frontendGlb).size);
        add("frontend delivery canonical URL matches", metadata.frontendDelivery?.canonicalUrl === metadata.model);
        add("frontend source commit recorded", /^[a-f0-9]{40}$/i.test(String(metadata.sourceCommit ?? "")), metadata.sourceCommit ?? "missing");
        const requiredExtensions = ["KHR_texture_basisu", "EXT_meshopt_compression"];
        for (const extension of requiredExtensions) {
          add(
            "frontend metadata extension " + extension,
            used.has(extension) && (metadata.geometry?.extensionsUsed ?? []).includes(extension),
          );
        }
        add("frontend metadata meshes match GLB", metadata.geometry?.meshes === (frontendJson.meshes ?? []).length);
        add(
          "frontend metadata primitives match GLB",
          metadata.geometry?.primitives === (frontendJson.meshes ?? []).reduce((sum, mesh) => sum + (mesh.primitives ?? []).length, 0),
        );
        add("frontend metadata materials match GLB", metadata.geometry?.materials === (frontendJson.materials ?? []).length);
        add("frontend metadata images match GLB", metadata.geometry?.embeddedImages === (frontendJson.images ?? []).length);
        const productionZone = metadata.geometry?.productionZone;
        if (currentPhase >= 8) {
          add("frontend metadata certifies Phase 08 production geometry", productionZone?.requiredElements === 19 &&
            productionZone?.chairUpholsteryTrianglesSource >= 14000 && productionZone?.chairUpholsteryTrianglesSource <= 18000 &&
            productionZone?.midiWhiteKeys === 36 && productionZone?.midiBlackKeys === 25 && productionZone?.acousticFabricPanels === 3 &&
            productionZone?.acousticFoamTiles === 30 && productionZone?.pendants === 4 && productionZone?.edisonBulbs === 4 &&
            productionZone?.trianglesAddedFromPhase7 > 0,
            JSON.stringify({ requiredElements: productionZone?.requiredElements, chairTriangles: productionZone?.chairUpholsteryTrianglesSource,
              triangleDelta: productionZone?.trianglesAddedFromPhase7 }));
          add("frontend metadata phase 08 report attached", productionZone?.sourceStatus === "source-validated");
        } else {
          add("frontend metadata phase 08 report attached", true, "deferred until Phase 08");
        }
      } else {
        add("frontend model metadata present", false, "missing file");
      }
    } catch (error) {
      add("Frontend GLB readable", false, error instanceof Error ? error.message : String(error));
    }
  } else {
    add("frontend GLB and Scene Bible accessible", false, "missing");
  }

  if (currentPhase >= 14) {
    const colliderFiles = [
      ["source", join(dir, "art/out/xoyens-studio.colliders.glb")],
      ["public", join(dir, "public/models/camping/xoyens-studio.colliders.glb")],
    ];
    for (const [label, colliderPath] of colliderFiles) {
      if (existsSync(colliderPath) && report) {
        try {
          for (const check of colliderGlbContract(parseGlb(readFileSync(colliderPath)), report.collectionObjects?.COL_colliders)) {
            add("Collider GLB (" + label + "): " + check.name, check.pass, check.detail);
          }
        } catch (error) {
          add("Collider GLB (" + label + ") readable", false, error instanceof Error ? error.message : String(error));
        }
      } else {
        add("collider GLB (" + label + ") present", false, "required from Phase 14; missing file or Blender report");
      }
    }
  } else {
    add("collider GLB gate ordered by phase", true, "collider GLB certification is deferred until Phase 14");
  }

  if (checkExitCodes) {
    const path = join(dir, "art/_delivery/exit-codes.txt");
    if (!existsSync(path)) {
      add("exit-codes present", false, "missing");
    } else {
      const codes = parseCodes(readFileSync(path, "utf8"));
      for (const key of ["validate", "blend", "blend-check", "frontend-model", "verify"]) {
        add("exit-code " + key + "=0", codes.get(key) === "0", codes.get(key) ?? "missing");
      }
    }
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [dir, ...args] = process.argv.slice(2);
  const bible = args.find((arg) => !arg.startsWith("--")) ?? "docs/camping-v3/scene-bible.json";
  const phaseToken = args.find((arg) => arg.startsWith("--phase="));
  const phaseIndex = args.findIndex((arg) => arg === "--phase");
  const phase = Number(phaseToken?.split("=")[1] ?? (phaseIndex >= 0 ? args[phaseIndex + 1] : undefined) ?? process.env.CAMPING_PHASE ?? 8);
  const checkExitCodes = args.includes("--check-exit-codes");
  if (!dir) {
    console.error("Usage: node scripts/3d/verify-delivery.mjs <delivery> [scene-bible.json] [--phase=8] [--check-exit-codes]");
    process.exit(2);
  }
  try {
    const checks = await verify(dir, bible, { checkExitCodes, phase });
    let failures = 0;
    for (const check of checks) {
      if (!check.pass) failures += 1;
      console.log((check.pass ? "PASS" : "FAIL") + "  " + check.name + (check.detail ? " · " + check.detail : ""));
    }
    if (failures) {
      console.log("\n" + failures + " checks failed. Phase 04 is NOT certified.");
      process.exit(1);
    }
    console.log("\nFase 04 certificável");
  } catch (error) {
    console.error("Verifier error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
