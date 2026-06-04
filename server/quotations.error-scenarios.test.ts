import { describe, expect, it, vi, beforeEach } from "vitest";
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

// Mock db module
vi.mock("./db", () => ({
  getQuotationById: vi.fn().mockResolvedValue(null),
  getQuotations: vi.fn().mockResolvedValue([]),
  getQuotationsByIds: vi.fn().mockResolvedValue([]),
  createQuotation: vi.fn().mockResolvedValue({ id: 1 }),
  updateQuotation: vi.fn().mockResolvedValue(undefined),
  updateQuotationStatus: vi.fn().mockResolvedValue(undefined),
  deleteQuotation: vi.fn().mockResolvedValue(undefined),
  batchUpdateQuotationStatus: vi.fn().mockResolvedValue(undefined),
  batchDeleteQuotations: vi.fn().mockResolvedValue(undefined),
  getQuotationAnalytics: vi.fn().mockResolvedValue({
    summary: {
      totalQuotations: 0,
      completedRevenue: 0,
      avgAmount: 0,
      conversionRate: 0,
    },
    byIndustry: [],
    byCustomer: [],
    bySalesRep: [],
    byTime: [],
    byStatus: [],
    topProducts: [],
  }),
  createActivityLog: vi.fn().mockResolvedValue(undefined),
  getMyDashboardStats: vi.fn().mockResolvedValue({
    totalQuotations: 0,
    completedRevenue: 0,
    statusCounts: {},
  }),
  getMyRecentQuotations: vi.fn().mockResolvedValue([]),
  searchQuotations: vi.fn().mockResolvedValue([]),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
  getUserByUsername: vi.fn().mockResolvedValue(null),
  getCplSheets: vi.fn().mockResolvedValue([]),
  getCplProducts: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  getLatestSummary: vi.fn().mockResolvedValue(null),
}));

type CookieCall = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

function createPublicContext(): { ctx: TrpcContext; setCookies: CookieCall[] } {
  const setCookies: CookieCall[] = [];
  const ctx: TrpcContext = {
    user: null,
    requestId: "test-request-id",
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        setCookies.push({ name, value, options });
      },
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
  return { ctx, setCookies };
}

function createAuthedContext(): { ctx: TrpcContext; setCookies: CookieCall[] } {
  const setCookies: CookieCall[] = [];
  const ctx: TrpcContext = {
    user: {
      id: 1,
      username: "testuser",
      name: "Test User",
      role: "user",
      isSuperAdmin: false,
      organizationId: null,
      groupId: null,
      openId: "test-open-id",
      email: null,
      loginMethod: null,
      passwordHash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as TrpcContext["user"],
    requestId: "test-request-id",
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        setCookies.push({ name, value, options });
      },
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
  return { ctx, setCookies };
}

// Helper: a quotation owned by a different user (id: 999)
const otherUsersQuotation = {
  id: 42,
  quotationNo: "QT-2026-001",
  customerName: "Other Corp",
  status: "draft",
  createdBy: 999,
  totalAmount: "10000",
  discountRate: "0",
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ────────────────────────────────────────────────────────────
// 1. NOT_FOUND on getById
// ────────────────────────────────────────────────────────────
describe("quotations.getById — NOT_FOUND", () => {
  it("throws NOT_FOUND when quotation does not exist", async () => {
    const { ctx } = createAuthedContext();
    const caller = appRouter.createCaller(ctx);

    const { getQuotationById } = await import("./db");
    (getQuotationById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    await expect(
      caller.quotations.getById({ id: 999 })
    ).rejects.toThrow("Quotation not found");
  });
});

// ────────────────────────────────────────────────────────────
// 2. FORBIDDEN on update (ownership check)
// ────────────────────────────────────────────────────────────
describe("quotations.update — FORBIDDEN", () => {
  it("throws FORBIDDEN when a non-admin user updates another user's quotation", async () => {
    const { ctx } = createAuthedContext();
    const caller = appRouter.createCaller(ctx);

    const { getQuotationById } = await import("./db");
    (getQuotationById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(otherUsersQuotation);

    await expect(
      caller.quotations.update({
        id: 42,
        customerName: "Hacked Name",
      })
    ).rejects.toThrow("Not authorized");
  });
});

// ────────────────────────────────────────────────────────────
// 3. FORBIDDEN on delete (ownership check)
// ────────────────────────────────────────────────────────────
describe("quotations.delete — FORBIDDEN", () => {
  it("throws FORBIDDEN when a non-admin user deletes another user's quotation", async () => {
    const { ctx } = createAuthedContext();
    const caller = appRouter.createCaller(ctx);

    const { getQuotationById } = await import("./db");
    (getQuotationById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(otherUsersQuotation);

    await expect(
      caller.quotations.delete({ id: 42 })
    ).rejects.toThrow("Not authorized");
  });
});

// ────────────────────────────────────────────────────────────
// 4. BAD_REQUEST on invalid status transition
// ────────────────────────────────────────────────────────────
describe("quotations.updateStatus — BAD_REQUEST", () => {
  it("throws BAD_REQUEST when transitioning from draft to completed (not allowed)", async () => {
    const { ctx } = createAuthedContext();
    const caller = appRouter.createCaller(ctx);

    const { getQuotationById } = await import("./db");
    (getQuotationById as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...otherUsersQuotation,
      createdBy: 1, // owned by current user so we pass ownership check
    });

    await expect(
      caller.quotations.updateStatus({ id: 42, status: "completed" })
    ).rejects.toThrow(/Invalid status transition from "draft" to "completed"/);
  });

  it("throws BAD_REQUEST when transitioning from completed to any status (terminal state)", async () => {
    const { ctx } = createAuthedContext();
    const caller = appRouter.createCaller(ctx);

    const { getQuotationById } = await import("./db");
    (getQuotationById as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...otherUsersQuotation,
      status: "completed",
      createdBy: 1,
    });

    await expect(
      caller.quotations.updateStatus({ id: 42, status: "draft" })
    ).rejects.toThrow(/Invalid status transition from "completed" to "draft"/);
  });
});

// ────────────────────────────────────────────────────────────
// 5. INTERNAL_SERVER_ERROR on DB failure
// ────────────────────────────────────────────────────────────
describe("quotations — INTERNAL_SERVER_ERROR on DB failure", () => {
  it("throws INTERNAL_SERVER_ERROR when getQuotations rejects", async () => {
    const { ctx } = createAuthedContext();
    const caller = appRouter.createCaller(ctx);

    const { getQuotations } = await import("./db");
    (getQuotations as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Connection lost")
    );

    await expect(
      caller.quotations.list({ page: 1, pageSize: 20 })
    ).rejects.toThrow("Failed to list quotations");
  });

  it("throws INTERNAL_SERVER_ERROR when getQuotationById rejects (getById)", async () => {
    const { ctx } = createAuthedContext();
    const caller = appRouter.createCaller(ctx);

    const { getQuotationById } = await import("./db");
    (getQuotationById as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("DB timeout")
    );

    await expect(
      caller.quotations.getById({ id: 1 })
    ).rejects.toThrow("Failed to get quotation");
  });

  it("throws INTERNAL_SERVER_ERROR when getQuotationAnalytics rejects", async () => {
    const { ctx } = createAuthedContext();
    const caller = appRouter.createCaller(ctx);

    const { getQuotationAnalytics } = await import("./db");
    (getQuotationAnalytics as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Analytics query failed")
    );

    await expect(
      caller.quotations.analytics({})
    ).rejects.toThrow("Failed to get quotation analytics");
  });
});

// ────────────────────────────────────────────────────────────
// 6. UNAUTHORIZED when not authenticated
// ────────────────────────────────────────────────────────────
describe("quotations — UNAUTHORIZED when not authenticated", () => {
  it("rejects list call for unauthenticated user", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.quotations.list({ page: 1, pageSize: 20 })
    ).rejects.toThrow();
  });

  it("rejects getById call for unauthenticated user", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.quotations.getById({ id: 1 })
    ).rejects.toThrow();
  });
});
