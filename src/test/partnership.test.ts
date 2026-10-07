import { describe, expect, it } from "vitest";
import { PartnershipRequestSchema } from "@/lib/partnership";

describe("PartnershipRequestSchema", () => {
  it("accepts a complete proposal", () => {
    const result = PartnershipRequestSchema.safeParse({
      name: "Kutuzov Studio",
      company: "Kutuzov Studio, Lda.",
      contact: "+258 84 000 0000 / studio@example.com",
      partnershipType: "Patrocínio · MASTER",
      budget: "150.000 MT",
      message: "Pretendemos activar a marca no camping e associá-la ao lançamento.",
    });

    expect(result.success).toBe(true);
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
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThanOrEqual(5);
    }
  });
});
