#!/usr/bin/env node
// Valida CAMPING V3: Scene Bible, escala humana, envolvente fechada, contratos e cobertura angular.
import { readFileSync } from "node:fs";

const file = process.argv[2] ?? "docs/camping-v3/scene-bible.json";
let bible;
try {
  bible = JSON.parse(readFileSync(file, "utf8"));
} catch (error) {
  console.error("ERRO não foi possível ler JSON válido: " + (error instanceof Error ? error.message : String(error)));
  process.exit(2);
}

const REQUIRED_IDS = new Set([
  "studio.imac",
  "studio.artists-wall",
  "studio.merch-rack",
  "studio.photo-backdrop",
  "studio.production-desk",
  "studio.audio-system",
  "studio.inner-door",
]);
const SOURCES = new Set(["model", "cc0", "ai-or-cc0", "official-asset", "print-reference"]);
const ZONES = new Set(["shell", "production", "photo", "left", "right"]);
const errs = [];
const warns = [];
const ids = new Set();
const elements = Array.isArray(bible.elements) ? bible.elements : [];
const elementById = new Map();
const sectorCounts = new Array(24).fill(0);
const bandMidpoints = [-52.5, 5, 57.5];
const sectorBandCounts = Array.from({ length: 3 }, () => new Array(24).fill(0));
let polyBudget = 0;
let lightCount = 0;

function fail(message) { errs.push(message); }
function closeEnough(a, b, tolerance = 0.001) { return Number.isFinite(a) && Math.abs(a - b) <= tolerance; }
function requireElement(id, description = id) {
  const e = elementById.get(id);
  if (!e) fail(description + ": elemento em falta '" + id + "'");
  return e;
}

if (bible.version !== 3) fail("version deve ser 3");
if (!bible.referencePano || bible.referencePano.width !== 1774 || bible.referencePano.height !== 887) {
  fail("referencePano deve conservar a resolução 1774×887");
}
if (!bible.budget || bible.budget.totalTrianglesHigh !== 260000 || bible.budget.totalTrianglesLow !== 70000) {
  fail("budget global esperado: high=260000, low=70000; não reduzir os limites para esconder falhas");
}
if (!elements.length) fail("elements deve ser uma lista não vazia");

for (const e of elements) {
  const where = e.id ?? "(sem id)";
  for (const key of ["id", "zone", "name", "azimuth", "elevation", "size_m", "materials", "source", "polyBudget"]) {
    if (e[key] === undefined) fail(where + ": falta '" + key + "'");
  }
  if (ids.has(e.id)) fail(where + ": id duplicado");
  ids.add(e.id);
  elementById.set(e.id, e);

  if (!SOURCES.has(e.source)) fail(where + ": source inválido '" + e.source + "'");
  if (!ZONES.has(e.zone)) fail(where + ": zone inválida '" + e.zone + "'");

  const [a0, a1] = e.azimuth ?? [NaN, NaN];
  if (!(Number.isFinite(a0) && Number.isFinite(a1) && a0 >= 0 && a1 <= 360 && a0 < a1)) {
    fail(where + ": azimuth inválido " + JSON.stringify(e.azimuth));
    continue;
  }
  const [el0, el1] = e.elevation ?? [NaN, NaN];
  if (!(Number.isFinite(el0) && Number.isFinite(el1) && el0 >= -90 && el1 <= 90 && el0 < el1)) {
    fail(where + ": elevation inválida " + JSON.stringify(e.elevation));
    continue;
  }
  if (!Array.isArray(e.size_m) || e.size_m.length !== 3 || e.size_m.some((v) => !(Number.isFinite(v) && v >= 0.001 && v <= 30))) {
    fail(where + ": size_m fora de 0.001–30 m");
  }
  if (!Array.isArray(e.materials) || e.materials.length === 0 || e.materials.some((m) => typeof m !== "string" || !m.trim())) {
    fail(where + ": materials deve conter identificadores não vazios");
  }
  if (!(Number.isFinite(e.polyBudget) && e.polyBudget > 0 && e.polyBudget <= 30000)) {
    fail(where + ": polyBudget inválido");
  } else {
    polyBudget += e.polyBudget;
  }
  if (e.interactionId && !/^studio\./.test(e.interactionId)) fail(where + ": interactionId deve começar por 'studio.'");

  lightCount += Array.isArray(e.lights) ? e.lights.length : 0;
  for (const light of e.lights ?? []) {
    if (!(light.kelvin >= 1800 && light.kelvin <= 7000)) fail(where + ": kelvin fora de 1800–7000");
    if (!(light.lumens > 0 || light.lumensPerM > 0)) fail(where + ": luz sem lumens/lumensPerM");
  }

  const start = Math.max(0, Math.floor(a0 / 15));
  const end = Math.min(24, Math.ceil(a1 / 15));
  for (let sector = start; sector < end; sector += 1) {
    sectorCounts[sector] += 1;
    for (let band = 0; band < bandMidpoints.length; band += 1) {
      if (el0 <= bandMidpoints[band] && el1 >= bandMidpoints[band]) sectorBandCounts[band][sector] += 1;
    }
  }
}

for (const id of REQUIRED_IDS) {
  if (!elements.some((e) => e.interactionId === id)) fail("ID de interacção legado em falta: " + id);
}
for (let slot = 1; slot <= 17; slot += 1) {
  const id = "studio.artist-slot-" + String(slot).padStart(3, "0");
  const slots = bible.metricPlan?.contracts?.artistSlotIds ?? [];
  if (slots[slot - 1] !== id) fail("contrato dos 17 retratos deve incluir sequencialmente " + id);
}

if (polyBudget > (bible.budget?.totalTrianglesHigh ?? 260000)) {
  fail("orçamento somado " + polyBudget + " excede o limite high " + bible.budget.totalTrianglesHigh);
}
if (sectorCounts.some((count) => count === 0)) {
  sectorCounts.forEach((count, i) => { if (count === 0) fail("sector " + (i * 15) + "°–" + (i * 15 + 15) + "° sem elementos"); });
}
sectorBandCounts.forEach((counts, band) => {
  counts.forEach((count, sector) => {
    if (count === 0) fail("cobertura angular/elevacional em falta: sector " + (sector * 15) + "°–" + (sector * 15 + 15) + "°, elevação banda " + band + " (centro " + bandMidpoints[band] + "°)");
  });
});

const plan = bible.metricPlan;
if (!plan || plan.version !== 1) {
  fail("metricPlan.version=1 é obrigatório");
} else {
  const room = plan.room;
  if (!room) fail("metricPlan.room em falta");
  else {
    for (const [key, expected] of [
      ["clearWidthM", 7.6], ["clearDepthM", 5.6], ["halfWidthM", 3.8], ["halfDepthM", 2.8],
      ["floorY", 0], ["wallHeightM", 2.85], ["vaultCrownY", 3.45], ["vaultRiseM", 0.6], ["wallThicknessM", 0.14]
    ]) {
      if (!closeEnough(room[key], expected)) fail("metricPlan.room." + key + " deve ser " + expected);
    }
    if (!room.interiorBounds ||
        !closeEnough(room.interiorBounds.minX, -3.8) || !closeEnough(room.interiorBounds.maxX, 3.8) ||
        !closeEnough(room.interiorBounds.minZ, -2.8) || !closeEnough(room.interiorBounds.maxZ, 2.8)) {
      fail("interiorBounds deve fechar a planta útil 7.6×5.6 m");
    }
  }

  const enclosure = plan.enclosure;
  const expectedWalls = new Map([
    ["wall.back", { axis: "z", insideFaceM: -2.8, spanM: [-3.8, 3.8] }],
    ["wall.front", { axis: "z", insideFaceM: 2.8, spanM: [-3.8, 3.8] }],
    ["wall.left", { axis: "x", insideFaceM: -3.8, spanM: [-2.8, 2.8] }],
    ["wall.right", { axis: "x", insideFaceM: 3.8, spanM: [-2.8, 2.8] }],
  ]);
  if (!enclosure?.closed || !enclosure?.allWallsClosedByDefault) fail("enclosure deve estar marcada como fechada por defeito");
  const walls = Array.isArray(enclosure?.walls) ? enclosure.walls : [];
  if (walls.length !== 4) fail("enclosure deve definir exactamente quatro paredes");
  for (const [id, expected] of expectedWalls) {
    const wall = walls.find((w) => w.id === id);
    if (!wall) { fail("parede em falta: " + id); continue; }
    if (wall.axis !== expected.axis || !closeEnough(wall.insideFaceM, expected.insideFaceM) ||
        !Array.isArray(wall.spanM) || !closeEnough(wall.spanM[0], expected.spanM[0]) || !closeEnough(wall.spanM[1], expected.spanM[1]) ||
        !closeEnough(wall.heightM, 2.85)) {
      fail(id + ": plano, vão e altura não correspondem à planta aprovada");
    }
  }
  for (const opening of enclosure?.openings ?? []) {
    const door = requireElement(opening.elementId, "vão de porta");
    const wall = walls.find((w) => w.id === opening.wallId);
    if (!wall) fail(opening.elementId + ": parede referenciada em falta '" + opening.wallId + "'");
    if (!wall?.openings?.includes(opening.elementId)) fail(opening.elementId + ": a parede não declara este vão");
    if (!opening.closedByDoorLeaf) fail(opening.elementId + ": vão deve ter uma folha de porta que feche a sala");
    if (door?.size_m && (!closeEnough(door.size_m[0], opening.widthM) || !closeEnough(door.size_m[1], opening.heightM))) {
      fail(opening.elementId + ": dimensions no Scene Bible não coincidem com o vão métrico");
    }
  }

  const camera = plan.cameraReference;
  if (!camera || JSON.stringify(camera.positionM) !== JSON.stringify([0, 1.45, 0]) ||
      JSON.stringify(camera.forward) !== JSON.stringify([0, 0, -1])) {
    fail("cameraReference deve começar em (0, 1.45, 0) a olhar para -Z");
  }

  const requiredAnchors = [
    ["arch.door_main", 1, 2.04],
    ["prod.desk_l", 1, 0.75],
    ["prod.monitor_daw", 0, 0.62],
    ["prod.monitor_daw", 1, 0.37],
    ["prod.chair_leather", 1, 1.15],
    ["photo.rack", 1, 1.7],
    ["photo.softbox_octa", 1, 2.0],
  ];
  for (const [id, dim, expected] of requiredAnchors) {
    const e = requireElement(id, "âncora humana");
    if (e?.size_m && !closeEnough(e.size_m[dim], expected)) fail(id + ": dimensão humana deve ser " + expected + " m");
  }

  const placements = Array.isArray(plan.anchorPlacements) ? plan.anchorPlacements : [];
  const placementIds = new Set();
  for (const placement of placements) {
    const id = placement.elementId;
    const e = requireElement(id, "anchorPlacements");
    if (placementIds.has(id)) fail("anchorPlacements duplicado para " + id);
    placementIds.add(id);
    if (!Array.isArray(placement.centerM) || placement.centerM.length !== 3 || placement.centerM.some((v) => !Number.isFinite(v))) {
      fail(id + ": centerM deve conter [x,y,z] em metros");
    }
    if (!Number.isFinite(placement.rotationYDeg)) fail(id + ": rotationYDeg inválido");
    if (e?.size_m && Array.isArray(placement.centerM) && placement.centerM.length === 3) {
      const [x, y, z] = placement.centerM;
      const [sx, sy, sz] = e.size_m;
      const theta = (placement.rotationYDeg * Math.PI) / 180;
      const ex = Math.abs(Math.cos(theta)) * sx / 2 + Math.abs(Math.sin(theta)) * sz / 2;
      const ez = Math.abs(Math.sin(theta)) * sx / 2 + Math.abs(Math.cos(theta)) * sz / 2;
      const wallMounted = /^(arch\.(door|ac_split|conduit|outlet|switch)|prod\.(plank_wall|panels_fabric|foam_tiles|frame_mirror)|left\.(mural_print|roller_white|flag_yen)|photo\.(roller_backdrop|backdrop_seal)|right\.painting|artists\.wall)/.test(id);
      const tolerance = wallMounted ? 0.14 : 0.001;
      if (x - ex < -3.8 - tolerance || x + ex > 3.8 + tolerance ||
          z - ez < -2.8 - tolerance || z + ez > 2.8 + tolerance) {
        fail(id + ": footprint excede a planta útil e a tolerância de montagem na parede");
      }
      if (y - sy / 2 < -0.001 || y + sy / 2 > 3.45 + 0.001) fail(id + ": altura excede floorY/coroamento");
    }
  }

  const assemblyRules = Array.isArray(plan.assemblyRules) ? plan.assemblyRules : [];
  const assemblyIds = new Set();
  for (const rule of assemblyRules) {
    if (assemblyIds.has(rule.elementId)) {
      if (!(rule.elementId === "prod.monitors_pair" && rule.method === "two-instances")) fail("assemblyRules duplicado para " + rule.elementId);
    }
    assemblyIds.add(rule.elementId);
    requireElement(rule.elementId, "assemblyRules");
    for (const parentId of rule.parentIds ?? []) requireElement(parentId, rule.elementId + " parent");
    for (const childId of rule.doorOpeningIds ?? []) requireElement(childId, rule.elementId + " opening");
  }
  for (const e of elements) {
    if (!placementIds.has(e.id) && !assemblyIds.has(e.id)) fail(e.id + ": falta uma âncora métrica ou regra de montagem");
  }

  const contracts = plan.contracts;
  for (const id of REQUIRED_IDS) {
    if (!(contracts?.interactionIds ?? []).includes(id)) fail("metricPlan.contracts não regista " + id);
  }
  const slots = contracts?.artistSlotIds ?? [];
  if (slots.length !== 17) fail("artistSlotIds deve conter exactamente 17 entradas");
  if (contracts?.portraitSource !== "backend" || contracts?.portraitFallback !== "empty-numbered-frame") {
    fail("retratos devem vir do backend com fallback de moldura numerada vazia");
  }
  if (contracts?.brandAssetsPolicy !== "official-manifests-only") fail("política de marca oficial em falta");

  const requiredDetails = plan.layoutAcceptance?.requiredDetailElements ?? [];
  for (const id of requiredDetails) requireElement(id, "detalhe pedido na Fase 03");
  if (plan.layoutAcceptance?.azimuthSectors !== 24 || plan.layoutAcceptance?.sectorWidthDeg !== 15) {
    fail("layoutAcceptance deve preservar 24 sectores de 15°");
  }
  if (plan.runtimeCompatibility?.publishedBoundsMeters) {
    const current = plan.runtimeCompatibility.publishedBoundsMeters;
    if (current.width !== 7.6 || current.depth !== 5.6) warns.push("o GLB publicado mantém envelope legacy " + current.width + "×" + current.depth + " m; o alvo métrico é 7.6×5.6 m e a migração de runtime fica para as fases de modelo/runtime");
  }
}

console.log("elementos: " + elements.length + " | triângulos orçamentados: " + polyBudget + " / " + (bible.budget?.totalTrianglesHigh ?? "?") + " | luzes: " + lightCount);
console.log("sectores azimutais cobertos: " + sectorCounts.filter((count) => count > 0).length + "/24");
console.log("cobertura sector/elev: " + sectorBandCounts.flat().filter((count) => count > 0).length + "/72");
console.log("âncoras métricas: " + (plan?.anchorPlacements?.length ?? 0) + " | regras de montagem: " + (plan?.assemblyRules?.length ?? 0));
warns.forEach((warning) => console.warn("AVISO " + warning));
if (errs.length) {
  errs.forEach((error) => console.error("ERRO " + error));
  process.exit(1);
}
console.log("scene-bible OK");
