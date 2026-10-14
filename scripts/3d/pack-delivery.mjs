#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const PHASE_DEFAULT = Number(process.env.CAMPING_PHASE || 8);
const CORE_REQUIRED = [
  "art/xoyens-studio.blend",
  "art/xoyens-studio.report.json",
  "art/out/xoyens-studio.raw.glb",
  "art/out/phase07-surfaces.json",
  "art/xoyens-studio.phase07.report.json",
  "art/textures/materials.manifest.json",
  "public/models/camping/xoyens-studio.glb",
  "public/models/camping/xoyens-studio.model.json",
];

export function requiredFilesForPhase(phase = PHASE_DEFAULT) {
  const number = Number(phase);
  if (!Number.isInteger(number) || number < 1 || number > 22) {
    throw new Error("CAMPING phase must be an integer between 1 and 22");
  }
  const required = [...CORE_REQUIRED];
  if (number >= 8) required.push("art/xoyens-studio.phase08.report.json");
  // The source and public collision GLBs become release gates at Phase 14,
  // as specified in the CAMPING V3 addendum. They are not Phase 04-13 blockers.
  if (number >= 14) {
    required.push("art/out/xoyens-studio.colliders.glb");
    required.push("public/models/camping/xoyens-studio.colliders.glb");
  }
  return required;
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
  const materialImages = walk(join(root, "art/textures/materials"))
    .filter((file) => /\.png$/i.test(file))
    .map((file) => relative(root, file));
  const phaseEvidence = [
    ...walk(join(root, "art/_delivery/phase-06")),
    ...walk(join(root, "art/_delivery/phase-08")),
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
    console.log(`manifest: ${relative(root, manifestPath)}\nphase: ${phase}\nmissing required: ${manifest.missing.join(", ") || "none"}`);
    process.exit(manifest.missing.length ? 3 : 0);
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
  console.log(`manifest: ${relative(root, manifestPath)}\narchive: ${relative(root, archive)}\nSHA-256: ${digest}\nphase: ${phase}\nfiles: ${manifest.files.length}\nmissing required: ${manifest.missing.join(", ") || "none"}`);
  process.exit(manifest.missing.length ? 3 : 0);
}
