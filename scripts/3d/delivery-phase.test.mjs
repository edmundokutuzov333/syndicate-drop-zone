import { describe, expect, it } from "vitest";
import { requiredFilesForPhase } from "./pack-delivery.mjs";

describe("CAMPING delivery phase gates", () => {
  it("requires Phase 08 production evidence without prematurely requiring colliders", () => {
    const required = new Set(requiredFilesForPhase(8));
    expect(required.has("art/xoyens-studio.phase08.report.json")).toBe(true);
    expect(required.has("art/out/xoyens-studio.colliders.glb")).toBe(false);
    expect(required.has("public/models/camping/xoyens-studio.colliders.glb")).toBe(false);
  });

  it("requires source and public collider GLBs from Phase 14", () => {
    const required = new Set(requiredFilesForPhase(14));
    expect(required.has("art/out/xoyens-studio.colliders.glb")).toBe(true);
    expect(required.has("public/models/camping/xoyens-studio.colliders.glb")).toBe(true);
    expect(required.has("art/xoyens-studio.phase08.report.json")).toBe(true);
  });

  it("rejects undefined delivery phases", () => {
    expect(() => requiredFilesForPhase(0)).toThrow(/integer between 1 and 22/);
    expect(() => requiredFilesForPhase(23)).toThrow(/integer between 1 and 22/);
    expect(() => requiredFilesForPhase(8.5)).toThrow(/integer between 1 and 22/);
  });
});
