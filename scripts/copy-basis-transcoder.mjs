#!/usr/bin/env node
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = resolve(root, "node_modules/three/examples/jsm/libs/basis");
const targetDir = resolve(root, "public/basis");
const files = ["basis_transcoder.js", "basis_transcoder.wasm"];

if (!existsSync(sourceDir)) {
  console.error("Basis não encontrado em " + sourceDir + ". Instale as dependências antes de executar este comando.");
  process.exit(2);
}

mkdirSync(targetDir, { recursive: true });
for (const name of files) {
  const source = resolve(sourceDir, name);
  const target = resolve(targetDir, name);
  if (!existsSync(source)) {
    console.error("O pacote Three.js instalado não contém " + name + " em " + sourceDir);
    process.exit(2);
  }
  copyFileSync(source, target);
  const sha256 = createHash("sha256").update(readFileSync(target)).digest("hex");
  console.log("Basis " + name + " -> public/basis/" + name + " SHA-256 " + sha256);
}
console.log("Basis runtime assets preparados a partir da versão de Three.js instalada.");
