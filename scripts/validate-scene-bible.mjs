#!/usr/bin/env node
// Valida o manifesto de cena sem dependências externas.
import { readFileSync } from "node:fs";

const file = process.argv[2] ?? "docs/camping-v3/scene-bible.json";
const bible = JSON.parse(readFileSync(file, "utf8"));
const legacyIds = new Set([
  "studio.imac",
  "studio.artists-wall",
  "studio.merch-rack",
  "studio.photo-backdrop",
  "studio.production-desk",
  "studio.audio-system",
  "studio.inner-door",
]);
const validSources = new Set(["model", "cc0", "ai-or-cc0", "official-asset", "print-reference"]);
const errors = [];
const warnings = [];
const ids = new Set();
const sectors = new Array(24).fill(0);
let polygonBudget = 0;

if (bible.version !== 3) errors.push("version deve ser 3");
if (!bible.referencePano || bible.referencePano.width !== 1774 || bible.referencePano.height !== 887) {
  errors.push("referencePano deve conservar a resolução 1774x887");
}
if (!Array.isArray(bible.elements) || bible.elements.length === 0) errors.push("elements deve ser uma lista não vazia");

for (const element of bible.elements ?? []) {
  const where = element.id ?? "(sem id)";
  for (const key of ["id", "zone", "name", "azimuth", "elevation", "size_m", "materials", "source", "polyBudget"]) {
    if (element[key] === undefined) errors.push(where + ": falta '" + key + "'");
  }
  if (ids.has(element.id)) errors.push(where + ": id duplicado");
  ids.add(element.id);
  if (!validSources.has(element.source)) errors.push(where + ": source inválido '" + element.source + "'");

  const [az0, az1] = element.azimuth ?? [NaN, NaN];
  if (!(az0 >= 0 && az1 <= 360 && az0 < az1)) errors.push(where + ": azimute inválido");
  const [el0, el1] = element.elevation ?? [NaN, NaN];
  if (!(el0 >= -90 && el1 <= 90 && el0 < el1)) errors.push(where + ": elevação inválida");
  if (!Array.isArray(element.size_m) || element.size_m.length !== 3 ||
      element.size_m.some((value) => !(value >= 0.005 && value <= 30))) {
    errors.push(where + ": size_m fora de 0.005 a 30 metros");
  }
  if (!Array.isArray(element.materials) || element.materials.length === 0) errors.push(where + ": sem materiais");
  if (!(element.polyBudget > 0 && element.polyBudget <= 30000)) errors.push(where + ": polyBudget inválido");
  if (element.interactionId && !/^studio\./.test(element.interactionId)) errors.push(where + ": interactionId inválido");

  polygonBudget += Number(element.polyBudget) || 0;
  const from = Math.floor(az0 / 15);
  const to = Math.min(24, Math.ceil(az1 / 15));
  for (let sector = from; sector < to; sector += 1) if (sector >= 0 && sector < 24) sectors[sector] += 1;

  for (const light of element.lights ?? []) {
    if (!(light.kelvin >= 1800 && light.kelvin <= 7000)) errors.push(where + ": kelvin fora de 1800 a 7000");
    if (!(light.lumens > 0 || light.lumensPerM > 0)) errors.push(where + ": luz sem lúmenes");
  }
}
for (const id of legacyIds) {
  if (!(bible.elements ?? []).some((element) => element.interactionId === id)) errors.push("ID legado em falta: " + id);
}
sectors.forEach((count, index) => {
  if (count === 0) errors.push("sector " + (index * 15) + " a " + (index * 15 + 15) + " graus sem elementos");
});
if (polygonBudget > bible.budget.totalTrianglesHigh) {
  warnings.push("soma do orçamento " + polygonBudget + " excede o alvo high " + bible.budget.totalTrianglesHigh);
}
console.log("elementos: " + (bible.elements?.length ?? 0) + " | orçamento de polígonos: " + polygonBudget +
  " / " + bible.budget.totalTrianglesHigh + " | cobertura sectorial mínima: " + Math.min(...sectors));
warnings.forEach((warning) => console.warn("AVISO " + warning));
if (errors.length) {
  errors.forEach((error) => console.error("ERRO " + error));
  process.exit(1);
}
console.log("scene-bible OK");
