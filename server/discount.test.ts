import { describe, it, expect } from "vitest";

describe("Discount calculation", () => {
  function calcSubtotal(unitPrice: number, quantity: number, discountRate: number): number {
    return unitPrice * quantity * (discountRate / 100);
  }

  it("applies 10% discount as multiply by 0.1", () => {
    expect(calcSubtotal(1000, 2, 10)).toBe(200);
  });

  it("applies 100% (full price, no discount)", () => {
    expect(calcSubtotal(500, 3, 100)).toBe(1500);
  });

  it("applies 0% discount as zero", () => {
    expect(calcSubtotal(1000, 2, 0)).toBe(0);
  });

  it("applies 50% discount correctly", () => {
    expect(calcSubtotal(200, 5, 50)).toBe(500);
  });

  it("handles decimal discount rates", () => {
    expect(calcSubtotal(1000, 1, 12.5)).toBeCloseTo(125);
  });

  it("calculates total amount from multiple items", () => {
    const items = [
      { unitPrice: 1000, quantity: 2, discountRate: 10 },
      { unitPrice: 500, quantity: 3, discountRate: 100 },
      { unitPrice: 200, quantity: 1, discountRate: 50 },
    ];
    const total = items.reduce((sum, it) => sum + calcSubtotal(it.unitPrice, it.quantity, it.discountRate), 0);
    expect(total).toBe(200 + 1500 + 100);
  });

  it("handles edge case: very small discount", () => {
    expect(calcSubtotal(10000, 1, 0.01)).toBeCloseTo(1);
  });
});
