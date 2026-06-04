import { describe, expect, it, vi, beforeEach } from "vitest";

// ──────────────────────── Mocks ────────────────────────

vi.mock("../quotation.repo", () => ({
  getQuotationById: vi.fn(),
  getQuotations: vi.fn(),
  getQuotationsByIds: vi.fn(),
  createQuotation: vi.fn(),
  updateQuotationFields: vi.fn(),
  replaceQuotationItems: vi.fn(),
  updateQuotationStatus: vi.fn(),
  deleteQuotation: vi.fn(),
  batchUpdateQuotationStatus: vi.fn(),
  batchDeleteQuotations: vi.fn(),
}));

vi.mock("../quotation.analytics", () => ({
  getQuotationAnalytics: vi.fn(),
  getMyDashboardStats: vi.fn(),
  getMyRecentQuotations: vi.fn(),
}));

vi.mock("../../../routers/helpers", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../db/index", () => ({
  requireDb: vi.fn().mockResolvedValue({
    transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn({})),
  }),
}));

// ──────────────────────── Imports ────────────────────────

import {
  createQuotation,
  updateStatus,
  deleteQuotation,
  batchUpdateStatus,
  getQuotationDetail,
  listQuotations,
  getAnalytics,
  getDashboard,
} from "../quotation.service";
import * as repo from "../quotation.repo";
import * as analytics from "../quotation.analytics";
import { calculateSubtotal, calculateTotalAmount } from "@shared/quotationMath";
import { QUOTATION_STATUS_TRANSITIONS } from "@shared/const";

// ──────────────────────── Helpers ────────────────────────

interface CtxUser {
  id: number;
  role: string;
  isSuperAdmin: boolean;
  name?: string | null;
  username?: string | null;
}

function makeCtx(user: Partial<CtxUser> = {}) {
  return {
    user: {
      id: 1,
      role: "user",
      isSuperAdmin: false,
      name: "Test User",
      username: "testuser",
      ...user,
    },
    req: { ip: "127.0.0.1", headers: {} },
  };
}

function makeQuotation(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    quotationNo: "QT-20260604-001",
    customerName: "Test Corp",
    customerContact: null,
    customerPhone: null,
    customerEmail: null,
    industry: null,
    projectName: null,
    status: "draft",
    discountRate: "0",
    totalAmount: "0",
    notes: null,
    createdBy: 1,
    validUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    creatorName: "Test User",
    creatorUsername: "testuser",
    version: 1,
    shareToken: null,
    items: [],
    ...overrides,
  };
}

// ──────────────────────── Tests ────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── createQuotation ───

describe("createQuotation", () => {
  it("uses calculateSubtotal for each item (not manual multiplication)", async () => {
    const repoCreate = vi.mocked(repo.createQuotation);
    const repoUpdateFields = vi.mocked(repo.updateQuotationFields);
    const repoReplaceItems = vi.mocked(repo.replaceQuotationItems);

    repoCreate.mockResolvedValue({ id: 10, quotationNo: "QT-20260604-010" });

    const ctx = makeCtx();
    const items = [
      { productModel: "AP-305C", quantity: 5, unitPrice: 1000, discountRate: 20 },
      { productModel: "SW-4150", quantity: 2, unitPrice: 500, discountRate: 10 },
    ];

    await createQuotation(ctx, {
      customerName: "Acme Inc",
      items,
    });

    // Verify repo.createQuotation was called
    expect(repoCreate).toHaveBeenCalledTimes(1);

    // Verify the transaction updates used calculated subtotals
    expect(repoUpdateFields).toHaveBeenCalledTimes(1);
    const [, , updateData] = repoUpdateFields.mock.calls[0];

    // Calculate expected total using the shared math module
    const expectedItem0 = calculateSubtotal(1000, 5, 20);
    const expectedItem1 = calculateSubtotal(500, 2, 10);
    const expectedTotal = calculateTotalAmount([
      { subtotal: expectedItem0 },
      { subtotal: expectedItem1 },
    ]);
    expect(updateData.totalAmount).toBe(String(expectedTotal));

    // Verify items were processed with correct subtotals
    expect(repoReplaceItems).toHaveBeenCalledTimes(1);
    const [, , processedItems] = repoReplaceItems.mock.calls[0];
    expect(processedItems[0].subtotal).toBe(String(expectedItem0));
    expect(processedItems[1].subtotal).toBe(String(expectedItem1));
  });

  it("falls back to listPrice when unitPrice is not provided", async () => {
    const repoCreate = vi.mocked(repo.createQuotation);
    const repoReplaceItems = vi.mocked(repo.replaceQuotationItems);

    repoCreate.mockResolvedValue({ id: 11, quotationNo: "QT-20260604-011" });

    const ctx = makeCtx();
    await createQuotation(ctx, {
      customerName: "Beta Corp",
      items: [
        { productModel: "AP-305C", quantity: 3, listPrice: "2000", discountRate: 15 },
      ],
    });

    const [, , processedItems] = repoReplaceItems.mock.calls[0];
    // unitPrice should fall back to parseFloat(listPrice)
    expect(processedItems[0].unitPrice).toBe("2000");
    expect(processedItems[0].subtotal).toBe(String(calculateSubtotal(2000, 3, 15)));
  });

  it("uses fallbackDiscountRate when item discountRate is missing", async () => {
    const repoCreate = vi.mocked(repo.createQuotation);
    const repoReplaceItems = vi.mocked(repo.replaceQuotationItems);

    repoCreate.mockResolvedValue({ id: 12, quotationNo: "QT-20260604-012" });

    const ctx = makeCtx();
    await createQuotation(ctx, {
      customerName: "Gamma Corp",
      discountRate: 25,
      items: [
        { productModel: "SW-4150", quantity: 4, unitPrice: 800 },
      ],
    });

    const [, , processedItems] = repoReplaceItems.mock.calls[0];
    expect(processedItems[0].discountRate).toBe("25");
    expect(processedItems[0].subtotal).toBe(String(calculateSubtotal(800, 4, 25)));
  });
});

// ─── updateStatus ───

describe("updateStatus", () => {
  it("allows valid status transition (draft -> submitted)", async () => {
    const repoGet = vi.mocked(repo.getQuotationById);
    const repoUpdate = vi.mocked(repo.updateQuotationStatus);

    repoGet.mockResolvedValue(makeQuotation({ status: "draft", createdBy: 1 }));

    const ctx = makeCtx();
    const result = await updateStatus(ctx, { id: 1, status: "submitted" });

    expect(result).toEqual({ success: true });
    expect(repoUpdate).toHaveBeenCalledWith(1, "submitted");
  });

  it("rejects invalid status transition (draft -> completed)", async () => {
    const repoGet = vi.mocked(repo.getQuotationById);
    repoGet.mockResolvedValue(makeQuotation({ status: "draft", createdBy: 1 }));

    const ctx = makeCtx();
    await expect(
      updateStatus(ctx, { id: 1, status: "completed" }),
    ).rejects.toThrow(/Invalid status transition from "draft" to "completed"/);
  });

  it("rejects transition from terminal state (completed -> draft)", async () => {
    const repoGet = vi.mocked(repo.getQuotationById);
    repoGet.mockResolvedValue(makeQuotation({ status: "completed", createdBy: 1 }));

    const ctx = makeCtx();
    await expect(
      updateStatus(ctx, { id: 1, status: "draft" }),
    ).rejects.toThrow(/Invalid status transition from "completed" to "draft"/);
  });

  it("rejects transition from terminal state (cancelled -> submitted)", async () => {
    const repoGet = vi.mocked(repo.getQuotationById);
    repoGet.mockResolvedValue(makeQuotation({ status: "cancelled", createdBy: 1 }));

    const ctx = makeCtx();
    await expect(
      updateStatus(ctx, { id: 1, status: "submitted" }),
    ).rejects.toThrow(/Invalid status transition from "cancelled" to "submitted"/);
  });

  it("throws NOT_FOUND when quotation does not exist", async () => {
    const repoGet = vi.mocked(repo.getQuotationById);
    repoGet.mockResolvedValue(null);

    const ctx = makeCtx();
    await expect(
      updateStatus(ctx, { id: 999, status: "submitted" }),
    ).rejects.toThrow("Quotation not found");
  });

  it("throws FORBIDDEN when non-owner tries to update status", async () => {
    const repoGet = vi.mocked(repo.getQuotationById);
    repoGet.mockResolvedValue(makeQuotation({ status: "draft", createdBy: 999 }));

    const ctx = makeCtx({ id: 1, role: "user", isSuperAdmin: false });
    await expect(
      updateStatus(ctx, { id: 1, status: "submitted" }),
    ).rejects.toThrow("Not authorized");
  });

  it("allows admin to update status on any quotation", async () => {
    const repoGet = vi.mocked(repo.getQuotationById);
    const repoUpdate = vi.mocked(repo.updateQuotationStatus);

    repoGet.mockResolvedValue(makeQuotation({ status: "draft", createdBy: 999 }));

    const ctx = makeCtx({ id: 1, role: "admin", isSuperAdmin: false });
    const result = await updateStatus(ctx, { id: 1, status: "submitted" });

    expect(result).toEqual({ success: true });
    expect(repoUpdate).toHaveBeenCalledWith(1, "submitted");
  });

  // Verify all valid transitions from each state
  describe.each(
    Object.entries(QUOTATION_STATUS_TRANSITIONS).flatMap(([from, toStates]) =>
      toStates.map((to) => ({ from, to })),
    ),
  )("transition $from -> $to", ({ from, to }) => {
    it("is allowed", async () => {
      const repoGet = vi.mocked(repo.getQuotationById);
      const repoUpdate = vi.mocked(repo.updateQuotationStatus);
      repoGet.mockResolvedValue(makeQuotation({ status: from, createdBy: 1 }));

      const ctx = makeCtx();
      const result = await updateStatus(ctx, { id: 1, status: to as never });

      expect(result).toEqual({ success: true });
      expect(repoUpdate).toHaveBeenCalledWith(1, to);
    });
  });
});

// ─── deleteQuotation ───

describe("deleteQuotation", () => {
  it("allows owner to delete", async () => {
    const repoGet = vi.mocked(repo.getQuotationById);
    const repoDelete = vi.mocked(repo.deleteQuotation);

    repoGet.mockResolvedValue(makeQuotation({ createdBy: 1 }));

    const ctx = makeCtx({ id: 1 });
    await deleteQuotation(ctx, 1);

    expect(repoDelete).toHaveBeenCalledWith(1);
  });

  it("throws FORBIDDEN when non-owner tries to delete", async () => {
    const repoGet = vi.mocked(repo.getQuotationById);
    repoGet.mockResolvedValue(makeQuotation({ createdBy: 999 }));

    const ctx = makeCtx({ id: 1, role: "user", isSuperAdmin: false });
    await expect(deleteQuotation(ctx, 1)).rejects.toThrow("Not authorized");
  });

  it("allows superAdmin to delete any quotation", async () => {
    const repoGet = vi.mocked(repo.getQuotationById);
    const repoDelete = vi.mocked(repo.deleteQuotation);

    repoGet.mockResolvedValue(makeQuotation({ createdBy: 999 }));

    const ctx = makeCtx({ id: 1, role: "user", isSuperAdmin: true });
    await deleteQuotation(ctx, 1);

    expect(repoDelete).toHaveBeenCalledWith(1);
  });

  it("throws NOT_FOUND when quotation does not exist", async () => {
    const repoGet = vi.mocked(repo.getQuotationById);
    repoGet.mockResolvedValue(null);

    const ctx = makeCtx();
    await expect(deleteQuotation(ctx, 999)).rejects.toThrow("Quotation not found");
  });
});

// ─── batchUpdateStatus ───

describe("batchUpdateStatus", () => {
  it("filters by permission: non-admin can only update own quotations", async () => {
    const repoGetByIds = vi.mocked(repo.getQuotationsByIds);
    const repoBatchUpdate = vi.mocked(repo.batchUpdateQuotationStatus);

    repoGetByIds.mockResolvedValue([
      { id: 1, createdBy: 1, status: "draft" },
      { id: 2, createdBy: 999, status: "draft" },
      { id: 3, createdBy: 1, status: "draft" },
    ]);

    const ctx = makeCtx({ id: 1, role: "user" });
    const result = await batchUpdateStatus(ctx, { ids: [1, 2, 3], status: "submitted" });

    // Only IDs 1 and 3 (owned by user 1) should be updated
    expect(repoBatchUpdate).toHaveBeenCalledWith([1, 3], "submitted");
    expect(result).toEqual({ success: true, updated: 2 });
  });

  it("admin can update all quotations regardless of owner", async () => {
    const repoGetByIds = vi.mocked(repo.getQuotationsByIds);
    const repoBatchUpdate = vi.mocked(repo.batchUpdateQuotationStatus);

    repoGetByIds.mockResolvedValue([
      { id: 1, createdBy: 1, status: "draft" },
      { id: 2, createdBy: 999, status: "draft" },
    ]);

    const ctx = makeCtx({ id: 1, role: "admin" });
    const result = await batchUpdateStatus(ctx, { ids: [1, 2], status: "submitted" });

    expect(repoBatchUpdate).toHaveBeenCalledWith([1, 2], "submitted");
    expect(result).toEqual({ success: true, updated: 2 });
  });

  it("filters out invalid status transitions", async () => {
    const repoGetByIds = vi.mocked(repo.getQuotationsByIds);
    const repoBatchUpdate = vi.mocked(repo.batchUpdateQuotationStatus);

    repoGetByIds.mockResolvedValue([
      { id: 1, createdBy: 1, status: "draft" },
      { id: 2, createdBy: 1, status: "completed" },
    ]);

    const ctx = makeCtx({ id: 1 });
    const result = await batchUpdateStatus(ctx, { ids: [1, 2], status: "submitted" });

    // Only ID 1 (draft -> submitted is valid); ID 2 (completed -> submitted is not)
    expect(repoBatchUpdate).toHaveBeenCalledWith([1], "submitted");
    expect(result).toEqual({ success: true, updated: 1 });
  });

  it("returns success with 0 updated when no IDs are valid", async () => {
    const repoGetByIds = vi.mocked(repo.getQuotationsByIds);
    const repoBatchUpdate = vi.mocked(repo.batchUpdateQuotationStatus);

    repoGetByIds.mockResolvedValue([
      { id: 1, createdBy: 999, status: "draft" },
    ]);

    const ctx = makeCtx({ id: 1, role: "user" });
    const result = await batchUpdateStatus(ctx, { ids: [1], status: "submitted" });

    expect(repoBatchUpdate).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, updated: 0 });
  });
});

// ─── getQuotationDetail ───

describe("getQuotationDetail", () => {
  it("throws NOT_FOUND when quotation does not exist", async () => {
    const repoGet = vi.mocked(repo.getQuotationById);
    repoGet.mockResolvedValue(null);

    const ctx = makeCtx();
    await expect(getQuotationDetail(ctx, 999)).rejects.toThrow("Quotation not found");
  });

  it("throws FORBIDDEN when non-owner reads another user's quotation", async () => {
    const repoGet = vi.mocked(repo.getQuotationById);
    repoGet.mockResolvedValue(makeQuotation({ createdBy: 999 }));

    const ctx = makeCtx({ id: 1, role: "user", isSuperAdmin: false });
    await expect(getQuotationDetail(ctx, 1)).rejects.toThrow("Not authorized");
  });

  it("returns quotation for owner", async () => {
    const repoGet = vi.mocked(repo.getQuotationById);
    const q = makeQuotation({ createdBy: 1 });
    repoGet.mockResolvedValue(q);

    const ctx = makeCtx({ id: 1 });
    const result = await getQuotationDetail(ctx, 1);

    expect(result).toEqual(q);
  });

  it("allows sales_manager to read any quotation", async () => {
    const repoGet = vi.mocked(repo.getQuotationById);
    const q = makeQuotation({ createdBy: 999 });
    repoGet.mockResolvedValue(q);

    const ctx = makeCtx({ id: 1, role: "sales_manager" });
    const result = await getQuotationDetail(ctx, 1);

    expect(result).toEqual(q);
  });
});

// ─── listQuotations ───

describe("listQuotations", () => {
  it("passes createdBy filter for non-admin users", async () => {
    const repoList = vi.mocked(repo.getQuotations);
    repoList.mockResolvedValue({ items: [], total: 0 });

    const ctx = makeCtx({ id: 5, role: "user" });
    await listQuotations(ctx, { page: 1, pageSize: 20 });

    expect(repoList).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: 5 }),
    );
  });

  it("does not pass createdBy filter for admin users", async () => {
    const repoList = vi.mocked(repo.getQuotations);
    repoList.mockResolvedValue({ items: [], total: 0 });

    const ctx = makeCtx({ id: 1, role: "admin" });
    await listQuotations(ctx, { page: 1, pageSize: 20 });

    expect(repoList).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: undefined }),
    );
  });
});

// ─── getAnalytics ───

describe("getAnalytics", () => {
  it("does not pass userId filter for admin", async () => {
    const analyticsGet = vi.mocked(analytics.getQuotationAnalytics);
    analyticsGet.mockResolvedValue({
      summary: { totalQuotations: 0, completedRevenue: 0, avgAmount: 0, conversionRate: 0 },
      byIndustry: [],
      byCustomer: [],
      bySalesRep: [],
      byTime: [],
      byStatus: [],
      topProducts: [],
    });

    const ctx = makeCtx({ id: 1, role: "admin" });
    await getAnalytics(ctx, {});

    expect(analyticsGet).toHaveBeenCalledWith(
      expect.objectContaining({ userId: undefined }),
    );
  });

  it("passes userId filter for non-admin", async () => {
    const analyticsGet = vi.mocked(analytics.getQuotationAnalytics);
    analyticsGet.mockResolvedValue({
      summary: { totalQuotations: 0, completedRevenue: 0, avgAmount: 0, conversionRate: 0 },
      byIndustry: [],
      byCustomer: [],
      bySalesRep: [],
      byTime: [],
      byStatus: [],
      topProducts: [],
    });

    const ctx = makeCtx({ id: 7, role: "user" });
    await getAnalytics(ctx, {});

    expect(analyticsGet).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 7 }),
    );
  });
});

// ─── getDashboard ───

describe("getDashboard", () => {
  it("fetches stats and recent quotations for the current user", async () => {
    const mockStats = { totalQuotations: 5, completedRevenue: 10000, statusCounts: {} };
    const mockRecent = [{ id: 1, quotationNo: "QT-001" }];
    const statsGet = vi.mocked(analytics.getMyDashboardStats);
    const recentGet = vi.mocked(analytics.getMyRecentQuotations);

    statsGet.mockResolvedValue(mockStats as never);
    recentGet.mockResolvedValue(mockRecent as never);

    const ctx = makeCtx({ id: 3 });
    const result = await getDashboard(ctx, { startDate: "2026-01-01", endDate: "2026-06-04" });

    expect(statsGet).toHaveBeenCalledWith(3, new Date("2026-01-01"), new Date("2026-06-04"));
    expect(recentGet).toHaveBeenCalledWith(3, 6);
    expect(result).toEqual({ stats: mockStats, recent: mockRecent });
  });
});
