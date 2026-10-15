#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

const base = process.env.CAMPING_BRAND_ASSET_BASE_URL || "https://syndicate-drop-zone.vercel.app";
const assets = [
  { name: "sindicato-selo.png", path: "/__l5e/assets-v1/1fa67bdd-f452-442e-a0d5-a9fb482388de/sindicato-selo.png", minBytes: 10000 },
  { name: "xoyens.png", path: "/__l5e/assets-v1/b0478989-7ffd-43dd-92e0-a801662907ae/xoyens.png", minBytes: 5000 },
];
const out = "art/textures/brand";
await mkdir(out, { recursive: true });
for (const asset of assets) {
  const response = await fetch(new URL(asset.path, base), { cache: "no-store" });
  if (!response.ok) throw new Error("Official brand asset request failed: " + asset.path + " HTTP " + response.status);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < asset.minBytes || bytes.toString("hex", 0, 8) !== "89504e470d0a1a0a") {
    throw new Error("Official brand asset is not a valid PNG: " + asset.name + " (" + bytes.length + " bytes)");
  }
  const path = join(out, asset.name);
  await writeFile(path, bytes);
  console.log(JSON.stringify({ asset: asset.name, path, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), source: new URL(asset.path, base).href }));
}
