import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import * as db from "./db";

describe("quotations.analytics", () => {
  it("should return analytics data for all quotations", async () => {
    const result = await db.getQuotationAnalytics({});
    
    expect(result).toBeDefined();
    expect(result).toHaveProperty("summary");
    expect(result).toHaveProperty("byIndustry");
    expect(result).toHaveProperty("byCustomer");
    expect(result).toHaveProperty("bySalesRep");
    expect(result).toHaveProperty("byTime");
    expect(result).toHaveProperty("byStatus");
    expect(result).toHaveProperty("topProducts");
  });

  it("should have correct summary structure", async () => {
    const result = await db.getQuotationAnalytics({});
    const { summary } = result;
    
    expect(summary).toHaveProperty("totalQuotations");
    expect(summary).toHaveProperty("completedRevenue");
    expect(summary).toHaveProperty("avgAmount");
    expect(summary).toHaveProperty("conversionRate");
    
    expect(typeof summary.totalQuotations).toBe("number");
    expect(typeof summary.completedRevenue).toBe("number");
    expect(typeof summary.avgAmount).toBe("number");
    expect(typeof summary.conversionRate).toBe("number");
  });

  it("should return data for date range", async () => {
    const startDate = new Date("2026-05-01");
    const endDate = new Date("2026-05-31");
    
    const result = await db.getQuotationAnalytics({
      startDate,
      endDate,
    });
    
    expect(result).toBeDefined();
    expect(result.summary).toBeDefined();
  });

  it("should handle empty date range gracefully", async () => {
    const startDate = new Date("2025-01-01");
    const endDate = new Date("2025-01-31");
    
    const result = await db.getQuotationAnalytics({
      startDate,
      endDate,
    });
    
    expect(result).toBeDefined();
    expect(result.summary.totalQuotations).toBe(0);
  });

  it("should return byStatus data", async () => {
    const result = await db.getQuotationAnalytics({});
    const { byStatus } = result;
    
    expect(Array.isArray(byStatus)).toBe(true);
    if (byStatus.length > 0) {
      const item = byStatus[0];
      expect(item).toHaveProperty("status");
      expect(item).toHaveProperty("count");
      expect(item).toHaveProperty("totalAmount");
    }
  });

  it("should return byIndustry data", async () => {
    const result = await db.getQuotationAnalytics({});
    const { byIndustry } = result;
    
    expect(Array.isArray(byIndustry)).toBe(true);
  });

  it("should return topProducts data", async () => {
    const result = await db.getQuotationAnalytics({});
    const { topProducts } = result;
    
    expect(Array.isArray(topProducts)).toBe(true);
  });
});
