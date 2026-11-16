#!/usr/bin/env node
/**
 * Materialise Lovable-managed media in public/ before a Vercel/Vite build.
 * This copies the project's existing originals; it does not call the Lovable agent.
 * The public URLs in *.asset.json remain unchanged.
 */
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { resolve, dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const sourceDirectory = join(root, "src", "assets");
const publicDirectory = join(root, "public");
const assetPrefix = "/__l5e/assets-v1/";
const defaultOrigin = "https://id-preview--67a20cf5-03a6-4c64-ab1e-c6089a5ecca0.lovable.app";
const origin = (process.env.SYNDICATE_LOVABLE_ASSET_ORIGIN || defaultOrigin).replace(/\/+$/, "");

function publicPath(asset) {
  if (
    !asset?.url?.startsWith(assetPrefix) ||
    !/^[0-9a-f-]{36}$/i.test(asset.asset_id || "") ||
    !asset.url.startsWith(assetPrefix + asset.asset_id + "/") ||
    asset.url.split("/").some((part) => part === ".." || part === ".")
  ) throw new Error("Unsafe or invalid Lovable asset reference: " + String(asset?.url));
  const target = resolve(publicDirectory, "." + asset.url);
  if (!target.startsWith(publicDirectory + sep)) throw new Error("Asset path escapes public/: " + asset.url);
  if (!Number.isSafeInteger(asset.size) || asset.size < 1) throw new Error("Missing original asset length: " + asset.url);
  return target;
}

async function collect(directory, results) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) await collect(file, results);
    else if (entry.isFile() && entry.name.endsWith(".asset.json")) {
      const asset = JSON.parse(await readFile(file, "utf8"));
      publicPath(asset);
      results.push(asset);
    }
  }
}

function validMedia(bytes, asset) {
  if (bytes.length !== asset.size) return false;
  const name = asset.url.toLowerCase();
  if (name.endsWith(".png")) return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (name.endsWith(".mp3")) return bytes.toString("ascii", 0, 3) === "ID3" || (bytes[0] === 255 && (bytes[1] & 224) === 224);
  if (name.endsWith(".mp4")) return bytes.toString("ascii", 4, 8) === "ftyp";
  throw new Error("Unexpected Lovable media format: " + name);
}

async function validLocal(asset) {
  const target = publicPath(asset);
  try {
    if ((await stat(target)).size !== asset.size) return false;
    return validMedia(await readFile(target), asset);
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function downloadAsset(asset) {
  if (await validLocal(asset)) return "cached";
  const target = publicPath(asset);
  const url = new URL(asset.url, origin);
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const temporary = target + ".tmp-" + process.pid + "-" + attempt;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
      if (!response.ok) throw new Error("HTTP " + response.status + " at " + url.pathname);
      if ((response.headers.get("content-type") || "").includes("text/html")) throw new Error("HTML returned instead of media: " + url.pathname);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!validMedia(bytes, asset)) throw new Error("Original size or file signature mismatch: " + asset.url);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(temporary, bytes);
      await rename(temporary, target);
      return "downloaded";
    } catch (error) {
      lastError = error;
      await rm(temporary, { force: true }).catch(() => {});
    }
  }
  throw new Error("Unable to restore " + asset.url + ": " + lastError?.message);
}

async function main() {
  const assets = [];
  await collect(sourceDirectory, assets);
  if (!assets.length) throw new Error("No Lovable media descriptors found; refusing incomplete build");
  const urls = new Set(assets.map((asset) => asset.url));
  if (urls.size !== assets.length) throw new Error("Duplicate Lovable asset descriptors");
  const verifyOnly = process.argv.includes("--verify-only");
  let cursor = 0, downloaded = 0, cached = 0;
  const errors = [];
  async function worker() {
    while (cursor < assets.length) {
      const asset = assets[cursor++];
      try {
        if (verifyOnly) {
          if (!(await validLocal(asset))) throw new Error("Missing or corrupt published media: " + asset.url);
          cached++;
        } else if ((await downloadAsset(asset)) === "cached") cached++;
        else downloaded++;
      } catch (error) { errors.push(String(error?.message || error)); }
    }
  }
  await Promise.all(Array.from({ length: 5 }, () => worker()));
  if (errors.length) throw new Error(errors.join("\n"));
  console.log("[media] " + assets.length + " verified; " + downloaded + " downloaded; " + cached + " already present; " + assets.reduce((sum, asset) => sum + asset.size, 0) + " original bytes");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error("[media] " + error.message); process.exitCode = 1; });
}
