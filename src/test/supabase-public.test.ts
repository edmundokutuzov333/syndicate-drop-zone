import { describe, expect, it } from "vitest";
import { publicSupabaseHeaders, resolvePublicSupabaseConfig } from "@/lib/supabase-public";

describe("public Supabase configuration", () => {
  const input = {
    browserHost: "syndicate-drop-zone.vercel.app",
    configuredUrl: "https://lovable-managed.supabase.example",
    configuredKey: "sb_publishable_lovable",
    directUrl: "https://hhipwyixtbleiulfnvvm.supabase.co",
    directKey: "sb_publishable_direct",
  };

  it("pairs the production URL with the canonical public key", () => {
    expect(resolvePublicSupabaseConfig(input)).toEqual({ url: input.directUrl, key: input.directKey });
  });

  it("keeps Lovable preview on the same real backend as production", () => {
    expect(resolvePublicSupabaseConfig({ ...input, browserHost: "id-preview--project.lovable.app" }))
      .toEqual({ url: input.directUrl, key: input.directKey });
  });

  it("uses the canonical Supabase project during production server rendering", () => {
    expect(resolvePublicSupabaseConfig({ ...input, browserHost: "server-production" }))
      .toEqual({ url: input.directUrl, key: input.directKey });
  });

  it("fails closed if the production key is missing", () => {
    expect(() => resolvePublicSupabaseConfig({ ...input, directKey: "" }))
      .toThrow("VITE_SUPABASE_DIRECT_PUBLISHABLE_KEY");
  });

  it("rejects a secret key from browser use", () => {
    expect(() => resolvePublicSupabaseConfig({ ...input, directKey: "sb_secret_nope" }))
      .toThrow("não pode ser usada no cliente público");
  });
});

describe("public Supabase headers", () => {
  it("does not treat a publishable key as a JWT", () => {
    const key = "sb_publishable_test";
    const headers = publicSupabaseHeaders(key, { Authorization: "Bearer " + key, "Content-Type": "application/json" });
    expect(headers.get("apikey")).toBe(key);
    expect(headers.get("Authorization")).toBeNull();
  });

  it("preserves a signed-in user's token", () => {
    const key = "sb_publishable_test";
    const jwt = "eyJhbGciOiJIUzI1NiJ9.user-signed-token.signature";
    const headers = publicSupabaseHeaders(key, { Authorization: "Bearer " + jwt });
    expect(headers.get("Authorization")).toBe("Bearer " + jwt);
  });

  it("supports legacy JWT anon keys", () => {
    const key = "eyJhbGciOiJIUzI1NiJ9.anon.signature";
    const headers = publicSupabaseHeaders(key);
    expect(headers.get("Authorization")).toBe("Bearer " + key);
  });
});
