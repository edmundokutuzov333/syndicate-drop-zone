import { describe, expect, it } from "vitest";
import { getAvailableMerchStock } from "./merch-stock";

describe("published merch stock", () => {
  it("uses variant availability without adding product total a second time", () => {
    expect(getAvailableMerchStock([
      { stockTotal: 10, stockReserved: 2, stockSold: 3 },
      { stockTotal: 6, stockReserved: 1, stockSold: 1 },
    ], 100)).toBe(9);
  });
  it("uses product-level stock only when no variants exist", () => {
    expect(getAvailableMerchStock([], 7)).toBe(7);
    expect(getAvailableMerchStock([], -2)).toBe(0);
  });
  it("never returns negative availability", () => {
    expect(getAvailableMerchStock([{ stockTotal: 1, stockReserved: 4, stockSold: 0 }], 8)).toBe(0);
  });
});
