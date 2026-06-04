import { describe, it, expect } from "vitest";
import { calculateSubtotal, calculateTotalAmount, roundMoney } from "@shared/quotationMath";

describe("quotationMath", () => {
  describe("roundMoney", () => {
    it("rounds to 2 decimal places", () => {
      expect(roundMoney(1.005)).toBe(1.01);
      expect(roundMoney(1.004)).toBe(1.0);
      expect(roundMoney(2.555)).toBe(2.56);
    });

    it("handles integers unchanged", () => {
      expect(roundMoney(100)).toBe(100);
      expect(roundMoney(0)).toBe(0);
    });
  });

  describe("calculateSubtotal", () => {
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

    it("handles edge case: very small discount", () => {
      expect(calculateSubtotal(10000, 1, 0.01)).toBeCloseTo(1);
    });
  });

  describe("calculateTotalAmount", () => {
    it("sums numeric subtotals", () => {
      const items = [
        { subtotal: 200 },
        { subtotal: 1500 },
        { subtotal: 100 },
      ];
      expect(calculateTotalAmount(items)).toBe(1800);
    });

    it("handles string subtotals from DB", () => {
      const items = [
        { subtotal: "200.50" },
        { subtotal: "300.25" },
        { subtotal: 100 },
      ];
      expect(calculateTotalAmount(items)).toBe(600.75);
    });

    it("handles empty items", () => {
      expect(calculateTotalAmount([])).toBe(0);
    });

    it("handles nullish subtotals", () => {
      const items = [
        { subtotal: 100 },
        { subtotal: "" },
        { subtotal: 200 },
      ];
      expect(calculateTotalAmount(items)).toBe(300);
    });
  });
});
