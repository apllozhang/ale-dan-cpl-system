import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock ENV before routers imports it
vi.mock("./_core/env", () => ({
  ENV: {
    appId: "test-app",
    cookieSecret: "test-secret-key-for-jwt-signing-at-least-32-chars",
    isProduction: false,
  },
}));

// Mock bcryptjs
vi.mock("bcryptjs", () => ({
  hash: vi.fn().mockResolvedValue("$2a$10$hashedpassword"),
  compare: vi.fn().mockResolvedValue(false),
}));

// Mock db module with stubs for all functions
vi.mock("./db", () => ({
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
  getUserByUsername: vi.fn().mockResolvedValue(null),
  getCplSheets: vi.fn().mockResolvedValue([]),
  getCplProducts: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  getLatestSummary: vi.fn().mockResolvedValue(null),
  clearAllProducts: vi.fn().mockResolvedValue(undefined),
  clearAndInsertSheets: vi.fn().mockResolvedValue(undefined),
  bulkInsertProducts: vi.fn().mockResolvedValue(undefined),
  insertSummary: vi.fn().mockResolvedValue(undefined),
  createQuotation: vi.fn().mockResolvedValue({ id: 1 }),
  getQuotations: vi.fn().mockResolvedValue([]),
  getQuotationById: vi.fn().mockResolvedValue(null),
  updateQuotation: vi.fn().mockResolvedValue(undefined),
  updateQuotationStatus: vi.fn().mockResolvedValue(undefined),
  deleteQuotation: vi.fn().mockResolvedValue(undefined),
  batchUpdateQuotationStatus: vi.fn().mockResolvedValue(undefined),
  getQuotationsByIds: vi.fn().mockResolvedValue([]),
  searchQuotations: vi.fn().mockResolvedValue([]),
  createActivityLog: vi.fn().mockResolvedValue(undefined),
}));

function createPublicContext(): TrpcContext {
  return {
    user: null,
    requestId: "test-request-id",
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("Auth bypass protection", () => {
  it("rejects unauthenticated quotations.create", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.quotations.create({
        customerName: "Test Customer",
        items: [],
      })
    ).rejects.toThrow("Please login");
  });

  it("rejects unauthenticated quotations.update", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.quotations.update({
        id: 1,
        customerName: "Updated Customer",
      })
    ).rejects.toThrow("Please login");
  });

  it("rejects unauthenticated quotations.delete", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.quotations.delete({ id: 1 })
    ).rejects.toThrow("Please login");
  });

  it("rejects unauthenticated quotations.batchUpdateStatus", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.quotations.batchUpdateStatus({
        ids: [1, 2, 3],
        status: "submitted",
      })
    ).rejects.toThrow("Please login");
  });

  it("rejects unauthenticated cpl.import", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.cpl.import({
        fileBase64: "dGVzdA==",
        fileName: "test.xlsx",
      })
    ).rejects.toThrow();
  });
});
