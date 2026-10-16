import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  auditBackendSchema,
  classifyProbe,
  BACKEND_TABLES,
  READ_ONLY_RPCS,
  REQUIRED_COLUMNS,
  summarizeProbes,
} from "./backend-schema-contract";

describe("backend schema contract", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("classifies successful, missing, restricted and failed probes", () => {
    expect(classifyProbe(200)).toBe("present");
    expect(classifyProbe(404, "PGRST205")).toBe("missing");
    expect(classifyProbe(400, "42703")).toBe("missing");
    expect(classifyProbe(400, "PGRST204")).toBe("missing");
    expect(classifyProbe(403, "42501")).toBe("restricted");
    expect(classifyProbe(503)).toBe("error");
  });

  it("declares the content and Control Room tables required by Phase 5", () => {
    const names = new Set(BACKEND_TABLES.map((item) => item.name));
    for (const name of [
      "artists", "artist_releases", "artist_status", "camping_sessions", "site_flags",
      "gallery_items", "media_assets", "tapes", "releases", "merch_products",
      "merch_variants", "reservations", "admin_profiles", "audit_logs",
      "site_settings", "site_sections", "drop_campaigns", "radio_tracks",
      "radio_station", "radio_blocks", "members", "fan_memberships",
    ]) {
      expect(names.has(name), name).toBe(true);
    }
    expect(READ_ONLY_RPCS.every((rpc) => !/create|delete|reserve|register|join|submit/i.test(rpc.name))).toBe(true);
    expect(BACKEND_TABLES.find((item) => item.name === "frequency_listeners")?.access).toBe("rpc-only");
    expect(BACKEND_TABLES.find((item) => item.name === "beats")?.access).toBe("authenticated");
    expect(BACKEND_TABLES.find((item) => item.name === "beats_public")?.access).toBe("public");
  });

  it("requires concrete columns for every direct table or view endpoint", () => {
    for (const item of BACKEND_TABLES.filter((entry) => entry.access !== "rpc-only")) {
      expect(REQUIRED_COLUMNS[item.name]?.length ?? 0, item.name).toBeGreaterThan(0);
    }
    expect(REQUIRED_COLUMNS.camping_sessions).toEqual(expect.arrayContaining([
      "id", "title", "starts_at", "ends_at", "room_id", "status",
    ]));
    expect(REQUIRED_COLUMNS.media_assets).toEqual(expect.arrayContaining([
      "id", "public_url", "storage_url", "status",
    ]));
  });

  it("does not expose the private beat audio URL through the public view contract", () => {
    expect(REQUIRED_COLUMNS.beats).toContain("audio_url");
    expect(REQUIRED_COLUMNS.beats_public).not.toContain("audio_url");
    expect(REQUIRED_COLUMNS.beats_public).toContain("preview_url");
  });

  it("only certifies endpoints when every probe is accessible", () => {
    const checkedAt = "2026-10-10T00:00:00.000Z";
    expect(summarizeProbes([
      { name: "artists", area: "ARTISTAS", kind: "table", status: "present", checkedAt },
      { name: "missing", area: "CAMPING", kind: "table", status: "missing", checkedAt },
    ])).toMatchObject({ present: 1, missing: 1, certified: false });
  });

  it("probes the declared columns rather than silently accepting SELECT *", async () => {
    const urls: string[] = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
    }) as unknown as typeof fetch;

    await auditBackendSchema({ fetcher });

    const artistRequest = urls.find((url) => url.includes("/rest/v1/artists?"));
    const beatViewRequest = urls.find((url) => url.includes("/rest/v1/beats_public?"));
    expect(artistRequest).toContain("select=");
    expect(decodeURIComponent(artistRequest ?? "")).toContain("id,slug,code,name");
    expect(decodeURIComponent(artistRequest ?? "")).not.toContain("select=*");
    expect(decodeURIComponent(beatViewRequest ?? "")).toContain("preview_url");
    expect(decodeURIComponent(beatViewRequest ?? "")).not.toContain("audio_url");
  });
});
