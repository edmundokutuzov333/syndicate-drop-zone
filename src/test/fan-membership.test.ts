import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase-public", () => ({
  getPublicSupabaseConfig: () => ({ url: "https://hhipwyixtbleiulfnvvm.supabase.co", key: "sb_publishable_test" }),
  publicSupabaseHeaders: (key: string, init?: HeadersInit) => {
    const headers = new Headers(init);
    headers.set("apikey", key);
    return headers;
  },
}));

import { fanPublic, registerFan } from "@/lib/fan-membership";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("cartão de fã", () => {
  it("regista apenas nome, versão das regras e código de referência", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([{
      code: "FAN123", fan_number: 9, alias: "FÃ TESTE", since: "2026-10-09T08:00:00.000Z",
    }]), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(registerFan({ alias: "FÃ TESTE", rulesVersion: "v1", referredBy: "REF123" })).resolves.toEqual({
      code: "FAN123", fanNumber: 9, alias: "FÃ TESTE", since: "2026-10-09T08:00:00.000Z",
    });
    const request = fetchMock.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit];
    expect(String(request[0])).toContain("/rest/v1/rpc/register_fan");
    expect(JSON.parse(String(request[1].body))).toEqual({ p_alias: "FÃ TESTE", p_rules_version: "v1", p_referred_by: "REF123" });
  });

  it("lê um cartão apenas pelo código público", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([{
      code: "FAN123", fan_number: 9, alias: "FÃ TESTE", since: "2026-10-09T08:00:00.000Z",
    }]), { status: 200, headers: { "Content-Type": "application/json" } })));
    await expect(fanPublic("fan123")).resolves.toMatchObject({ code: "FAN123", fanNumber: 9 });
    await expect(fanPublic("bad-code")).resolves.toBeNull();
  });
});
