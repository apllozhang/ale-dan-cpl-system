import { describe, it, expect } from "vitest";
import { calculateSubtotal } from "@shared/quotationMath";

describe("Discount calculation", () => {
  it("applies 10% discount as multiply by 0.1", () => {
    expect(calculateSubtotal(1000, 2, 10)).toBe(200);
  });

  it("applies 100% (full price, no discount)", () => {
    expect(calculateSubtotal(500, 3, 100)).toBe(1500);
  });

  it("applies 0% discount as zero", () => {
    expect(calculateSubtotal(1000, 2, 0)).toBe(0);
  });

  it("applies 50% discount correctly", () => {
    expect(calculateSubtotal(200, 5, 50)).toBe(500);
  });

  it("handles decimal discount rates", () => {
    expect(calculateSubtotal(1000, 1, 12.5)).toBe(125);
  });

  it("calculates total amount from multiple items", () => {
    const items = [
      { unitPrice: 1000, quantity: 2, discountRate: 10 },
      { unitPrice: 500, quantity: 3, discountRate: 100 },
      { unitPrice: 200, quantity: 1, discountRate: 50 },
    ];
    const total = items.reduce((sum, it) => sum + calculateSubtotal(it.unitPrice, it.quantity, it.discountRate), 0);
    expect(total).toBe(200 + 1500 + 100);
  });

  it("handles edge case: very small discount", () => {
    expect(calculateSubtotal(10000, 1, 0.01)).toBeCloseTo(1);
  });
});
