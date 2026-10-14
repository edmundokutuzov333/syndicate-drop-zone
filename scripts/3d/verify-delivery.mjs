#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

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

export function glbContract(j, bible) {
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

export async function verify(dir, biblePath, { checkExitCodes = false } = {}) {
  const out = [];
  const add = (name, pass, detail = "") => out.push({ name, pass, detail });
  const manifestPath = [join(dir, "art/_delivery/manifest.json"), join(dir, "manifest.json")].find(existsSync);
  const manifest = manifestPath ? JSON.parse(readFileSync(manifestPath, "utf8")) : null;
  add("manifest present", Boolean(manifest));

  if (manifest) {
    add("all required files in manifest", (manifest.missing ?? []).length === 0, (manifest.missing ?? []).join(", "));
    add("commit recorded", Boolean(manifest.commit && manifest.commit !== "unknown"), manifest.commit ?? "");
    const manifestPaths = new Set((manifest.files ?? []).map((file) => file.path));
    add("collider GLB included in manifest", manifestPaths.has("art/out/xoyens-studio.colliders.glb"));
    add("frontend canonical GLB included in manifest", manifestPaths.has("public/models/camping/xoyens-studio.glb"));
    add("frontend model metadata included in manifest", manifestPaths.has("public/models/camping/xoyens-studio.model.json"));
    add("PBR material manifest included in delivery", manifestPaths.has("art/textures/materials.manifest.json"));
    add("PBR material manifest included in delivery", manifestPaths.has("art/textures/materials.manifest.json"));
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
    add("collider count present in Blender report", Number.isInteger(report.collectionObjects?.COL_colliders) && report.collectionObjects.COL_colliders > 0, String(report.collectionObjects?.COL_colliders ?? "missing"));
  } else {
    add("report present", false, "missing");
  }

  const bibleExists = Boolean(biblePath && existsSync(biblePath));
  const glb = join(dir, "art/out/xoyens-studio.raw.glb");
  if (existsSync(glb) && bibleExists) {
    try {
      for (const check of glbContract(parseGlb(readFileSync(glb)), JSON.parse(readFileSync(biblePath, "utf8")))) {
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
      for (const check of glbContract(frontendJson, JSON.parse(readFileSync(biblePath, "utf8")))) {
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
          "frontend metadata certifies Blender V3 phase 6",
          metadata.version === 3 && metadata.phase === 6 && metadata.status === "blender-v3-published",
          JSON.stringify({ version: metadata.version, phase: metadata.phase, status: metadata.status }),
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
      } else {
        add("frontend model metadata present", false, "missing file");
      }
    } catch (error) {
      add("Frontend GLB readable", false, error instanceof Error ? error.message : String(error));
    }
  } else {
    add("frontend GLB and Scene Bible accessible", false, "missing");
  }

  const colliderGlb = join(dir, "art/out/xoyens-studio.colliders.glb");
  if (existsSync(colliderGlb) && report) {
    try {
      for (const check of colliderGlbContract(parseGlb(readFileSync(colliderGlb)), report.collectionObjects?.COL_colliders)) {
        add("Collider GLB: " + check.name, check.pass, check.detail);
      }
    } catch (error) {
      add("Collider GLB readable", false, error instanceof Error ? error.message : String(error));
    }
  } else {
    add("collider GLB present", false, "missing file or Blender report");
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
  const checkExitCodes = args.includes("--check-exit-codes");
  if (!dir) {
    console.error("Usage: node scripts/3d/verify-delivery.mjs <delivery> [scene-bible.json] [--check-exit-codes]");
    process.exit(2);
  }
  try {
    const checks = await verify(dir, bible, { checkExitCodes });
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
