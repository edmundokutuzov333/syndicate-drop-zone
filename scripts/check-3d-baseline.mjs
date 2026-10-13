#!/usr/bin/env node
// Fase 01: confirma que o GLB original apresenta exactamente as quatro violações conhecidas.
// Não torna o modelo "verde" nem altera budgets. Quando o GLB for reconstruído nas fases 12-14,
// este gate deve ser substituído pela validação directa dos tiers de produção.
import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, [
  "scripts/check-3d-budgets.mjs",
  "public/models/camping/xoyens-studio.glb",
  "high",
], { encoding: "utf8" });

const output = (result.stdout ?? "") + (result.stderr ?? "");
process.stdout.write(output);
if (result.error) {
  console.error("Não foi possível executar o checker:", result.error.message);
  process.exit(2);
}

const expectedFailures = [
  "textura embebida mais pequena",
  "UV1 para lightmaps",
  "KTX2/BasisU",
  "Meshopt",
];
const failureLines = output.split(/\r?\n/).filter((line) => /^FALHA\s/.test(line));
const missing = expectedFailures.filter((name) => !failureLines.some((line) => line.includes(name)));
const unexpected = failureLines.filter((line) => !expectedFailures.some((name) => line.includes(name)));

if (result.status !== 1 || failureLines.length !== 4 || missing.length || unexpected.length) {
  console.error("\nFALHA: a baseline do GLB mudou de forma inesperada.");
  console.error(JSON.stringify({ exitStatus: result.status, failures: failureLines, missing, unexpected }, null, 2));
  process.exit(1);
}

console.log("\nBASELINE CONFIRMADA: exactamente quatro violações históricas; budgets mantidos.");
