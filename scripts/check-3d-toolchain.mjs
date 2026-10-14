#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const packages = [
  "postprocessing", "n8ao", "three-mesh-bvh", "detect-gpu",
  "@gltf-transform/core", "@gltf-transform/extensions",
  "@gltf-transform/functions", "@gltf-transform/cli",
  "meshoptimizer", "sharp", "ktx-parse"
];

let failures = 0;
function fail(message) {
  console.error("FALHA " + message);
  failures += 1;
}
function ok(message) {
  console.log("OK    " + message);
}

for (const name of packages) {
  const declared = packageJson.dependencies?.[name] ?? packageJson.devDependencies?.[name];
  if (!declared) {
    fail(name + " não está declarado em package.json");
    continue;
  }
  try {
    require.resolve(name);
    ok(name + " @" + declared);
  } catch (error) {
    fail(name + " declarado (" + declared + "), mas indisponível: " + (error instanceof Error ? error.message : String(error)));
  }
}

const basisSource = resolve(root, "node_modules/three/examples/jsm/libs/basis");
const basisOutput = resolve(root, "public/basis");
for (const name of ["basis_transcoder.js", "basis_transcoder.wasm"]) {
  if (!existsSync(resolve(basisSource, name))) fail("Basis de origem em falta: " + name);
  else ok("Basis de origem: " + name);
  if (!existsSync(resolve(basisOutput, name))) fail("Basis de public/basis em falta: " + name + " (execute npm run 3d:basis)");
  else ok("Basis publicado no build: " + name);
}

if (!process.argv.includes("--packages-only")) {
  const home = homedir();
  const blenderCandidates = [
    process.env.BLENDER_BIN,
    join(home, "tools", "blender-4.5.14", "blender"),
    join(home, "tools", "blender-4.5.14", "Blender.app", "Contents", "MacOS", "Blender"),
    "/Applications/Blender.app/Contents/MacOS/Blender",
    "blender"
  ].filter(Boolean);
  let resolvedBlender = null;
  for (const candidate of blenderCandidates) {
    const probe = spawnSync(candidate, ["--version"], { cwd: root, encoding: "utf8" });
    if (probe.error || probe.status !== 0) continue;
    resolvedBlender = candidate;
    const line = (probe.stdout || probe.stderr || "").trim().split(/\\r?\\n/)[0];
    const match = line.match(/Blender\\s+(\\d+)\\.(\\d+)/i);
    if (!match || Number(match[1]) !== 4 || Number(match[2]) !== 5) fail("Blender 4.5.x obrigatório; recebido: " + line);
    else ok("blender: " + line + " (" + candidate + ")");
    break;
  }
  if (!resolvedBlender) fail("Blender não encontrado; defina BLENDER_BIN ou instale Blender 4.5.14");
  if (process.platform === "linux") {
    for (const command of [{ name: "toktx", args: ["--version"] }, { name: "ktx", args: ["--version"] }]) {
      const result = spawnSync(command.name, command.args, { cwd: root, encoding: "utf8" });
      if (result.error || result.status !== 0) {
        fail(command.name + " não executou: " + (result.error?.message ?? (result.stderr || result.stdout || "exit " + result.status).trim()));
      } else {
        ok(command.name + ": " + (result.stdout || result.stderr || "").trim().split(/\\r?\\n/)[0]);
      }
    }
  } else {
    ok("KTX CLI não bloqueia build da Fase 04 em macOS; é verificado noutra fase.");
  }
} else {
  console.log("Modo --packages-only: valida dependências Node e ficheiros Basis; ferramentas de sistema ficam para o workflow próprio.");
}

if (failures) {
  console.error("Toolchain CAMPING: " + failures + " falha(s).");
  process.exit(1);
}
console.log("Toolchain CAMPING: contrato satisfeito neste ambiente.");
