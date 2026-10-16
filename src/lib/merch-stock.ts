export type MerchStockVariant = {
  stockTotal: number;
  stockReserved: number;
  stockSold: number;
};

function safeStockNumber(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/** Variant stock is authoritative when variants exist. Product stock is a fallback, not an extra quantity. */
export function getAvailableMerchStock(variants: readonly MerchStockVariant[], fallbackAvailable: number): number {
  if (variants.length === 0) return safeStockNumber(fallbackAvailable);
  return variants.reduce((sum, variant) => {
    const available = safeStockNumber(variant.stockTotal) - safeStockNumber(variant.stockReserved) - safeStockNumber(variant.stockSold);
    return sum + Math.max(0, available);
  }, 0);
}
