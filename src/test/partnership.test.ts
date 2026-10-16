import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase-public", () => ({
  getPublicSupabaseConfig: () => ({
    url: "https://hhipwyixtbleiulfnvvm.supabase.co",
    key: "sb_publishable_test",
  }),
  publicSupabaseHeaders: (key: string, init?: HeadersInit) => {
    const headers = new Headers(init);
    headers.set("apikey", key);
    return headers;
  },
}));

import { PartnershipRequestSchema, submitPartnershipRequest } from "@/lib/partnership";

afterEach(() => {
  vi.unstubAllGlobals();
});

const validProposal = {
  name: "Kutuzov Studio",
  company: "Kutuzov Studio, Lda.",
  contact: "+258 84 000 0000 / studio@example.com",
  partnershipType: "Patrocínio · MASTER",
  budget: "150.000 MT",
  message: "Pretendemos activar a marca no camping e associá-la ao lançamento.",
};

describe("PartnershipRequestSchema", () => {
  it("accepts a complete proposal", () => {
    expect(PartnershipRequestSchema.safeParse(validProposal).success).toBe(true);
  });

  it("defaults an omitted budget to an empty string", () => {
    const result = PartnershipRequestSchema.safeParse({
      name: "Sindicato",
      company: "Sindicato do Trap",
      contact: "parcerias@example.com",
      partnershipType: "Patrocínio",
      message: "Proposta válida sem orçamento definido.",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.budget).toBe("");
  });

  it("rejects incomplete proposals", () => {
    const result = PartnershipRequestSchema.safeParse({
      name: "A",
      company: "",
      contact: "",
      partnershipType: "",
      budget: "",
      message: "curto",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.length).toBeGreaterThanOrEqual(5);
  });
});

describe("submitPartnershipRequest", () => {
  it("sends a complete proposal to the database RPC", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify("a50bdcb6-7a20-4b2f-9d0f-4bfe00123456"), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(submitPartnershipRequest(validProposal)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://hhipwyixtbleiulfnvvm.supabase.co/rest/v1/rpc/submit_partnership_request");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toMatchObject({
      p_name: validProposal.name,
      p_company: validProposal.company,
      p_contact: validProposal.contact,
      p_partnership_type: validProposal.partnershipType,
      p_budget: validProposal.budget,
      p_message: validProposal.message,
    });
  });

  it("surfaces backend failures instead of reporting false success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ message: "Invalid API key" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    )));

    await expect(submitPartnershipRequest(validProposal)).rejects.toThrow("Invalid API key");
  });
});
