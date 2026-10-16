#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

const projectId = "67a20cf5-03a6-4c64-ab1e-c6089a5ecca0";
const assets = [
  { manifest: "src/assets/brand/sindicato-selo.png.asset.json", output: "sindicato-selo.png" },
  { manifest: "src/assets/brand/xoyens.png.asset.json", output: "xoyens.png" },
];
const out = "art/textures/brand";
await mkdir(out, { recursive: true });
for (const item of assets) {
  const manifest = JSON.parse(await readFile(item.manifest, "utf8"));
  if (manifest.content_type !== "image/png" || !manifest.url || !manifest.asset_id || !manifest.size) {
    throw new Error("Official brand asset manifest is incomplete: " + item.manifest);
  }
  const previewOrigin = "https://id-preview--" + projectId + ".lovable.app";
  const origins = [...new Set([
    process.env.CAMPING_BRAND_ASSET_BASE_URL?.trim(),
    previewOrigin,
    "https://sindicato-do-trap.lovable.app",
    "https://syndicate-drop-zone.vercel.app",
  ].filter(Boolean))];
  const failures = [];
  let bytes = null;
  let source = "";
  for (const origin of origins) {
    const url = new URL(manifest.url, origin);
    try {
      const response = await fetch(url, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(12000) });
      if (!response.ok) {
        failures.push(origin + " -> HTTP " + response.status);
        continue;
      }
      const candidate = Buffer.from(await response.arrayBuffer());
      if (candidate.length !== Number(manifest.size)) {
        failures.push(origin + " -> byte count " + candidate.length + ", expected " + manifest.size);
        continue;
      }
      if (candidate.toString("hex", 0, 8) !== "89504e470d0a1a0a") {
        failures.push(origin + " -> response is not a PNG");
        continue;
      }
      bytes = candidate;
      source = url.href;
      break;
    } catch (error) {
      failures.push(origin + " -> " + (error instanceof Error ? error.message : String(error)));
    }
  }
  if (!bytes) {
    throw new Error("Could not retrieve official asset " + item.output + " from any registered origin: " + failures.join(" | "));
  }
  const path = join(out, item.output);
  await writeFile(path, bytes);
  console.log(JSON.stringify({
    asset: item.output,
    assetId: manifest.asset_id,
    path,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    source,
    manifestUrl: manifest.url,
  }));
}
