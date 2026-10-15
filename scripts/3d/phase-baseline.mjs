// Pure validation of an already published Phase 07+ model checkpoint.
// This module deliberately has no CLI side effects so it can be imported by tests.
export function certifiedPhase7BaselineTriangles(metadata) {
  const phase = Number(metadata?.phase);
  if (metadata?.version !== 3 || ![7, 8].includes(phase) || metadata?.surfacePhase !== 7 ||
      metadata?.status !== "blender-v3-published" || metadata?.model !== "/models/camping/xoyens-studio.glb") {
    throw new Error("Canonical model is not a valid Phase 07+ publication checkpoint");
  }
  const geometry = metadata.geometry ?? {};
  const surfaces = geometry.heroSurfaces ?? {};
  if (Number(surfaces.floorBoards) < 100 || surfaces.floorHasColor0 !== true || surfaces.floorHasUv0Uv1 !== true ||
      Math.abs(Number(surfaces.vinylRadiusM) - 2.3) > 0.003 ||
      Math.abs(Number(surfaces.vinylThicknessM) - 0.0012) > 0.0001 ||
      Math.abs(Number(surfaces.vinylEdgeLiftM) - 0.004) > 0.0001 ||
      Math.abs(Number(surfaces.bambooTileMeters) - 1.2) > 0.0001 ||
      Math.abs(Number(surfaces.cycloramaRadiusM) - 0.35) > 0.0001 || surfaces.cycloramaContinuousToFloor !== true) {
    throw new Error("Canonical model checkpoint does not retain the certified Phase 07 hero surfaces");
  }
  if (phase === 7) {
    if (metadata.productionPhase != null && Number(metadata.productionPhase) >= 8) {
      throw new Error("Phase 07 checkpoint cannot claim a future production phase");
    }
    const baseline = Number(geometry.triangles);
    if (!Number.isInteger(baseline) || baseline <= 0) throw new Error("Phase 07 checkpoint has no valid triangle baseline");
    return baseline;
  }

  const production = geometry.productionZone ?? {};
  const requiredInteractions = ["studio.production-desk", "studio.imac", "studio.audio-system"];
  if (metadata.productionPhase !== 8 || production.sourceStatus !== "source-validated" ||
      production.requiredElements !== 19 || !Number.isInteger(production.chairUpholsteryTrianglesSource) ||
      production.chairUpholsteryTrianglesSource < 14000 || production.chairUpholsteryTrianglesSource > 18000 ||
      production.midiWhiteKeys !== 36 || production.midiBlackKeys !== 25 ||
      production.acousticFabricPanels !== 3 || production.acousticFoamTiles !== 30 ||
      production.pendants !== 4 || production.edisonBulbs !== 4 ||
      !requiredInteractions.every((id) => production.requiredInteractionsPreserved?.includes(id)) ||
      !Number.isInteger(production.baselineTriangles) || production.baselineTriangles <= 0 ||
      production.publishedTriangles !== geometry.triangles ||
      production.baselineTriangles + production.trianglesAddedFromPhase7 !== geometry.triangles ||
      !(production.trianglesAddedFromPhase7 > 0)) {
    throw new Error("Published Phase 08 checkpoint does not contain internally consistent Phase 07 baseline evidence");
  }
  return production.baselineTriangles;
}
