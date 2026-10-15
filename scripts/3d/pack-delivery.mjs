#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const PHASE_DEFAULT = Number(process.env.CAMPING_PHASE || 8);
const CORE_REQUIRED = [
  "art/xoyens-studio.blend",
  "art/xoyens-studio.report.json",
  "art/out/xoyens-studio.raw.glb",
  "public/models/camping/xoyens-studio.glb",
  "public/models/camping/xoyens-studio.model.json",
];

export function requiredFilesForPhase(phase = PHASE_DEFAULT) {
  const number = Number(phase);
  if (!Number.isInteger(number) || number < 1 || number > 22) {
    throw new Error("CAMPING phase must be an integer between 1 and 22");
  }
  const required = [...CORE_REQUIRED];
  if (number >= 5) required.push("art/textures/materials.manifest.json");
  if (number >= 7) {
    required.push("art/out/phase07-surfaces.json");
    required.push("art/xoyens-studio.phase07.report.json");
  }
  if (number >= 8) required.push("art/xoyens-studio.phase08.report.json");
  if (number >= 9) { required.push("art/xoyens-studio.phase09.report.json"); required.push("art/textures/brand/sindicato-selo.png"); required.push("art/textures/brand/xoyens.png"); }
  // Collision GLBs are mandatory release artifacts from Phase 14 onward.
  if (number >= 14) {
    required.push("art/out/xoyens-studio.colliders.glb");
    required.push("public/models/camping/xoyens-studio.colliders.glb");
  }
  return required;
}

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

export function phasePrerequisiteFailures(root = ".", phase = PHASE_DEFAULT) {
  const number = Number(phase);
  if (!Number.isInteger(number) || number < 1 || number > 22) {
    throw new Error("CAMPING phase must be an integer between 1 and 22");
  }
  const failures = [];
  const add = (condition, message) => { if (!condition) failures.push(message); };
  const load = (relativePath, label) => {
    const path = join(root, relativePath);
    if (!existsSync(path)) {
      failures.push(label + " missing: " + relativePath);
      return null;
    }
    try {
      const value = readJson(path);
      if (!isObject(value)) throw new Error("expected a JSON object");
      return value;
    } catch (error) {
      failures.push(label + " invalid: " + relativePath + " (" + (error instanceof Error ? error.message : String(error)) + ")");
      return null;
    }
  };

  if (number >= 7) {
    const source = load("art/out/phase07-surfaces.json", "Phase 07 source evidence");
    if (source) {
      add(source.phase === 7, "Phase 07 source evidence has incorrect phase");
      add(Number(source.floor?.boardCount) >= 100, "Phase 07 source evidence needs at least 100 floor boards");
      add(Number(source.vinyl?.radiusM) === 2.3, "Phase 07 source evidence has incorrect vinyl radius");
      add(Number(source.bamboo?.tileMeters) === 1.2, "Phase 07 source evidence has incorrect bamboo tile length");
      add(source.cyclorama?.continuesToFloor === true, "Phase 07 source evidence is missing continuous cyclorama");
    }

    const report = load("art/xoyens-studio.phase07.report.json", "Phase 07 Blender validation");
    if (report) {
      add(report.phase === 7 && report.status === "source-validated", "Phase 07 Blender validation is not source-validated");
      add(Number(report.floor?.boards) >= 100, "Phase 07 validation requires at least 100 boards");
      add(report.floor?.verticalRaycastHits === report.floor?.boards, "Phase 07 validation raycasts do not cover every floor board");
      add(Number(report.floor?.roughness?.roughnessRange) >= 0.08, "Phase 07 floor roughness variation is below the acceptance threshold");
    }
  }

  if (number >= 8) {
    const report = load("art/xoyens-studio.phase08.report.json", "Phase 08 production validation");
    if (report) {
      const zone = report.productionZone ?? {};
      add(report.version === 1 && report.phase === 8 && report.status === "source-validated",
        "Phase 08 production report is not source-validated");
      for (const [field, expected] of Object.entries({
        requiredElements: 19, midiWhiteKeys: 36, midiBlackKeys: 25,
        acousticFabricPanels: 3, acousticFoamTiles: 30, pendants: 4, edisonBulbs: 4,
      })) add(zone[field] === expected, "Phase 08 " + field + " must equal " + expected);
      add(Number.isInteger(zone.chairUpholsteryTrianglesSource) &&
        zone.chairUpholsteryTrianglesSource >= 14000 && zone.chairUpholsteryTrianglesSource <= 18000,
        "Phase 08 chair upholstery must contain 14,000 to 18,000 source triangles");
    }
  }

  if (number >= 9) {
    const report = load("art/xoyens-studio.phase09.report.json", "Phase 09 photo validation");
    if (report) {
      add(report.phase === 9 && report.status === "source-validated", "Phase 09 photo report is not source-validated");
      add(report.photoElements === 9 && report.photoRootsFound === 9, "Phase 09 must validate all nine photo element roots");
      add(report.garments === 5, "Phase 09 requires exactly five garments");
    }
    for (const path of ["art/textures/brand/sindicato-selo.png", "art/textures/brand/xoyens.png"]) add(existsSync(join(root, path)), "Phase 09 official brand asset missing: " + path);
  }

  if (number >= 7) {
    const modelPath = join(root, "public/models/camping/xoyens-studio.glb");
    const metadata = load("public/models/camping/xoyens-studio.model.json", "Canonical frontend model metadata");
    if (!existsSync(modelPath)) failures.push("Canonical frontend GLB missing: public/models/camping/xoyens-studio.glb");
    if (metadata && existsSync(modelPath)) {
      try {
        const bytes = readFileSync(modelPath);
        const digest = createHash("sha256").update(bytes).digest("hex");
        const expectedModelPhase = number >= 8 ? number : 7;
        add(metadata.version === 3 && metadata.phase === expectedModelPhase,
          "Canonical model metadata phase must be " + expectedModelPhase);
        add(metadata.surfacePhase === 7 && metadata.status === "blender-v3-published",
          "Canonical model metadata does not certify the Phase 07 surfaces");
        add(metadata.model === "/models/camping/xoyens-studio.glb" &&
          metadata.frontendDelivery?.canonicalUrl === metadata.model &&
          metadata.frontendDelivery?.hashAlgorithm === "SHA-256",
          "Canonical model metadata URL or hash algorithm is incorrect");
        add(metadata.geometry?.bytes === bytes.length && metadata.frontendDelivery?.bytes === bytes.length,
          "Canonical model byte count does not match metadata");
        add(metadata.geometry?.sha256 === digest && metadata.frontendDelivery?.sha256 === digest,
          "Canonical model SHA-256 does not match metadata");
        add(/^[a-f0-9]{40}$/i.test(String(metadata.sourceCommit ?? "")),
          "Canonical model sourceCommit is missing or invalid");
        if (number >= 8) {
          add(metadata.productionPhase === number, "Canonical model productionPhase must be " + number);
          const production = metadata.geometry?.productionZone ?? {};
          add(production.sourceStatus === "source-validated" && production.requiredElements === 19 &&
            production.midiWhiteKeys === 36 && production.midiBlackKeys === 25 &&
            production.acousticFabricPanels === 3 && production.acousticFoamTiles === 30 &&
            production.pendants === 4 && production.edisonBulbs === 4 &&
            Number(production.chairUpholsteryTrianglesSource) >= 14000 &&
            Number(production.chairUpholsteryTrianglesSource) <= 18000 &&
            Number(production.trianglesAddedFromPhase7) > 0,
            "Canonical model metadata does not contain certified Phase 08 geometry");
          for (const interactionId of ["studio.production-desk", "studio.imac", "studio.audio-system"]) {
            add(production.requiredInteractionsPreserved?.includes(interactionId) === true,
              "Canonical model metadata does not certify preserved interaction " + interactionId);
          }
        } else {
          add(metadata.productionPhase == null || Number(metadata.productionPhase) < 8,
            "Phase 07 publication cannot claim production geometry from a later phase");
        }
        if (number >= 9) {
          const photo = metadata.geometry?.photoZone ?? {};
          add(photo.sourceStatus === "source-validated" && photo.requiredElements === 9 &&
            photo.taggedPhotoObjects === 9 && photo.garments === 5 &&
            photo.sealDiameterM === 2.2 && photo.rackWidthM === 1.6,
            "Canonical model metadata does not certify Phase 09 photo geometry");
          for (const materialName of ["print_official_seal", "print_official_xoyens", "led_panel_emissive", "led_warm_emissive"]) {
            add(photo.requiredMaterialsLinked?.includes(materialName) === true,
              "Canonical model metadata does not certify Phase 09 material " + materialName);
          }
          for (const interactionId of ["studio.photo-backdrop", "studio.merch-rack"]) {
            add(photo.requiredInteractionsPreserved?.includes(interactionId) === true,
              "Canonical model metadata does not certify preserved Phase 09 interaction " + interactionId);
          }
          add(JSON.stringify(photo.garmentTypes) === JSON.stringify(["tee-seal", "tee-seal", "tee-xoyens", "hoodie", "hoodie-grey-sleeve"]),
            "Canonical model metadata does not certify the five Phase 09 garment types");
        }
      } catch (error) {
        failures.push("Canonical frontend model could not be verified: " + (error instanceof Error ? error.message : String(error)));
      }
    }
  }

  if (number >= 14) {
    for (const path of ["art/out/xoyens-studio.colliders.glb", "public/models/camping/xoyens-studio.colliders.glb"]) {
      add(existsSync(join(root, path)), "Phase 14 collider artifact missing: " + path);
    }
  }
  return failures;
}
export const REQUIRED = requiredFilesForPhase(PHASE_DEFAULT);
export const sha256 = (file) => new Promise((resolve, reject) => {
  const hash = createHash("sha256");
  createReadStream(file).on("data", (chunk) => hash.update(chunk))
    .on("end", () => resolve(hash.digest("hex")))
    .on("error", reject);
});
const walk = (dir) => existsSync(dir)
  ? readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)])
  : [];
const git = (args) => {
  try { return execFileSync("git", args, { encoding: "utf8" }).trim(); }
  catch { return "unknown"; }
};

export async function buildManifest(root = ".", phase = PHASE_DEFAULT) {
  const required = requiredFilesForPhase(phase);
  const materialImages = [...walk(join(root, "art/textures/materials")), ...walk(join(root, "art/textures/brand"))]
    .filter((file) => /\.png$/i.test(file)).map((file) => relative(root, file));
  const phaseEvidence = [
    ...walk(join(root, "art/_delivery/phase-06")),
    ...walk(join(root, "art/_delivery/phase-08")),
    ...walk(join(root, "art/_delivery/phase-09")),
  ].map((file) => relative(root, file));
  const deliveryLogs = walk(join(root, "art/_delivery/logs")).map((file) => relative(root, file));
  const paths = [
    ...required,
    ...materialImages,
    ...phaseEvidence,
    ...deliveryLogs,
    "art/_delivery/environment.txt",
    "art/_delivery/exit-codes.txt",
  ].filter((file) => existsSync(join(root, file)));
  const files = [];
  for (const path of [...new Set(paths)].sort()) {
    const fullPath = join(root, path);
    files.push({ path, bytes: statSync(fullPath).size, sha256: await sha256(fullPath) });
  }
  return {
    version: 2,
    phase: Number(phase),
    generated_at: new Date().toISOString(),
    commit: git(["rev-parse", "HEAD"]),
    branch: git(["rev-parse", "--abbrev-ref", "HEAD"]),
    working_tree_dirty: git(["status", "--porcelain"]) !== "",
    required,
    missing: required.filter((file) => !existsSync(join(root, file))),
    phase_prerequisite_failures: phasePrerequisiteFailures(root, phase),
    files,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const phaseToken = args.find((arg) => arg.startsWith("--phase="));
  const phaseIndex = args.findIndex((arg) => arg === "--phase");
  const phase = Number(
    phaseToken?.split("=")[1]
    ?? (phaseIndex >= 0 ? args[phaseIndex + 1] : undefined)
    ?? process.env.CAMPING_PHASE
    ?? 8,
  );
  const root = process.cwd();
  mkdirSync(join(root, "art/_delivery"), { recursive: true });
  const manifest = await buildManifest(root, phase);
  const manifestPath = join(root, "art/_delivery/manifest.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

  if (args.includes("--manifest-only")) {
    console.log(`manifest: ${relative(root, manifestPath)}\nphase: ${phase}\nmissing required: ${manifest.missing.join(", ") || "none"}\nphase prerequisite failures: ${manifest.phase_prerequisite_failures.join("; ") || "none"}`);
    process.exit(manifest.missing.length || manifest.phase_prerequisite_failures.length ? 3 : 0);
  }

  const stamp = manifest.generated_at.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z").slice(0, 15);
  const zip = join(root, `art/_delivery/phase04-delivery-${manifest.commit.slice(0, 7)}-${stamp}.zip`);
  const entries = [...manifest.files.map((file) => file.path), "art/_delivery/manifest.json"];
  let archive = zip;
  try {
    execFileSync("zip", ["-q", "-9", zip, ...entries], { cwd: root, stdio: "inherit" });
  } catch {
    archive = zip.replace(/\.zip$/, ".tar.gz");
    execFileSync("tar", ["-czf", archive, ...entries], { cwd: root, stdio: "inherit" });
  }
  const digest = await sha256(archive);
  writeFileSync(archive + ".sha256", `${digest}  ${relative(root, archive)}\n`);
  console.log(`manifest: ${relative(root, manifestPath)}\narchive: ${relative(root, archive)}\nSHA-256: ${digest}\nphase: ${phase}\nfiles: ${manifest.files.length}\nmissing required: ${manifest.missing.join(", ") || "none"}\nphase prerequisite failures: ${manifest.phase_prerequisite_failures.join("; ") || "none"}`);
  process.exit(manifest.missing.length || manifest.phase_prerequisite_failures.length ? 3 : 0);
}
