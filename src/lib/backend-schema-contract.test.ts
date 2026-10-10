import { describe, expect, it } from "vitest";
import { classifyProbe, BACKEND_TABLES, READ_ONLY_RPCS } from "./backend-schema-contract";

describe("backend schema contract", () => {
  it("classifies successful, missing, restricted and failed probes", () => {
    expect(classifyProbe(200)).toBe("present");
    expect(classifyProbe(404, "PGRST205")).toBe("missing");
    expect(classifyProbe(403, "42501")).toBe("restricted");
    expect(classifyProbe(503)).toBe("error");
  });

  it("declares the content and Control Room tables required by Phase 5", () => {
    const names = new Set(BACKEND_TABLES.map((item) => item.name));
    for (const name of ["artists", "artist_releases", "artist_status", "camping_sessions", "site_flags", "gallery_items", "media_assets", "tapes", "releases", "merch_products", "merch_variants", "reservations", "admin_profiles", "audit_logs", "site_settings", "site_sections", "drop_campaigns", "radio_tracks", "radio_station", "radio_blocks", "members", "fan_memberships"]) {
      expect(names.has(name), name).toBe(true);
    }
    expect(READ_ONLY_RPCS.every((rpc) => !/create|delete|reserve|register|join|submit/i.test(rpc.name))).toBe(true);
    expect(BACKEND_TABLES.find((item) => item.name === "frequency_listeners")?.access).toBe("rpc-only");
    expect(BACKEND_TABLES.find((item) => item.name === "beats")?.access).toBe("authenticated");
    expect(BACKEND_TABLES.find((item) => item.name === "beats_public")?.access).toBe("public");
  });
});
