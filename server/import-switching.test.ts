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
  getImportLogs: vi.fn(),
  getImportLogById: vi.fn(),
  deleteImportLog: vi.fn(),
  clearImportLogs: vi.fn(),
  deactivateAllImports: vi.fn(),
  setCplImportActive: vi.fn(),
  getActiveImportLogId: vi.fn(),
  importCplOverwrite: vi.fn(),
  insertSheets: vi.fn(),
  bulkInsertProducts: vi.fn(),
  insertSummary: vi.fn(),
  createImportLogAndGetId: vi.fn(),
  createActivityLog: vi.fn().mockResolvedValue(undefined),
  getAllOrganizations: vi.fn().mockResolvedValue([]),
  getAllUserGroups: vi.fn().mockResolvedValue([]),
  // Needed by other routers that may be imported
  getUserByOpenId: vi.fn(),
  getUserByUsername: vi.fn(),
  getCplSheets: vi.fn(),
  getCplProducts: vi.fn(),
  getLatestSummary: vi.fn(),
  clearAllProducts: vi.fn(),
  clearAndInsertSheets: vi.fn(),
  upsertUser: vi.fn(),
}));

// Import db after mocking
import * as db from "./db";

type CookieCall = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

function createSuperAdminContext(): { ctx: TrpcContext; setCookies: CookieCall[] } {
  const setCookies: CookieCall[] = [];
  const ctx: TrpcContext = {
    user: {
      id: 1,
      username: "superadmin",
      name: "Super Admin",
      role: "admin",
      isSuperAdmin: true,
      openId: "test-open-id",
      organizationId: null,
      groupId: null,
      passwordHash: null,
      createdAt: new Date(),
    } as any,
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

function createNonSuperAdminContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: {
      id: 2,
      username: "normaluser",
      name: "Normal User",
      role: "user",
      isSuperAdmin: false,
      openId: "test-open-id-2",
      organizationId: null,
      groupId: null,
      passwordHash: null,
      createdAt: new Date(),
    } as any,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
  return { ctx };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ==================== importLogs.switchActive ====================

describe("importLogs.switchActive", () => {
  it("calls deactivateAllImports and setCplImportActive with the given ID", async () => {
    const { ctx } = createSuperAdminContext();
    const caller = appRouter.createCaller(ctx);

    const mockLog = { id: 5, fileName: "test.xlsx", isActive: false };
    vi.mocked(db.getImportLogById).mockResolvedValue(mockLog as any);
    vi.mocked(db.deactivateAllImports).mockResolvedValue(undefined as any);
    vi.mocked(db.setCplImportActive).mockResolvedValue(undefined as any);

    const result = await caller.importLogs.switchActive({ id: 5 });

    expect(result).toEqual({ success: true });
    expect(db.getImportLogById).toHaveBeenCalledWith(5);
    expect(db.deactivateAllImports).toHaveBeenCalledOnce();
    expect(db.setCplImportActive).toHaveBeenCalledWith(5);
  });

  it("throws error when import log does not exist", async () => {
    const { ctx } = createSuperAdminContext();
    const caller = appRouter.createCaller(ctx);

    vi.mocked(db.getImportLogById).mockResolvedValue(null);

    await expect(caller.importLogs.switchActive({ id: 999 })).rejects.toThrow("导入记录不存在");
    expect(db.deactivateAllImports).not.toHaveBeenCalled();
    expect(db.setCplImportActive).not.toHaveBeenCalled();
  });

  it("throws FORBIDDEN for non-superAdmin user", async () => {
    const { ctx } = createNonSuperAdminContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.importLogs.switchActive({ id: 1 })).rejects.toThrow("需要超级管理员权限");
  });
});

// ==================== importLogs.deleteLog ====================

describe("importLogs.deleteLog", () => {
  it("deletes an inactive import log successfully", async () => {
    const { ctx } = createSuperAdminContext();
    const caller = appRouter.createCaller(ctx);

    const mockLog = { id: 3, fileName: "old.xlsx", isActive: false };
    vi.mocked(db.getImportLogById).mockResolvedValue(mockLog as any);
    vi.mocked(db.deleteImportLog).mockResolvedValue(undefined as any);

    const result = await caller.importLogs.deleteLog({ id: 3 });

    expect(result).toEqual({ success: true });
    expect(db.getImportLogById).toHaveBeenCalledWith(3);
    expect(db.deleteImportLog).toHaveBeenCalledWith(3);
  });

  it("throws error when trying to delete an active import", async () => {
    const { ctx } = createSuperAdminContext();
    const caller = appRouter.createCaller(ctx);

    const mockLog = { id: 1, fileName: "active.xlsx", isActive: true };
    vi.mocked(db.getImportLogById).mockResolvedValue(mockLog as any);

    await expect(caller.importLogs.deleteLog({ id: 1 })).rejects.toThrow(
      "当前正在使用的导入不能删除，请先切换到其他导入"
    );
    expect(db.deleteImportLog).not.toHaveBeenCalled();
  });

  it("throws error when import log does not exist", async () => {
    const { ctx } = createSuperAdminContext();
    const caller = appRouter.createCaller(ctx);

    vi.mocked(db.getImportLogById).mockResolvedValue(null);

    await expect(caller.importLogs.deleteLog({ id: 999 })).rejects.toThrow("导入记录不存在");
    expect(db.deleteImportLog).not.toHaveBeenCalled();
  });

  it("throws FORBIDDEN for non-superAdmin user", async () => {
    const { ctx } = createNonSuperAdminContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.importLogs.deleteLog({ id: 1 })).rejects.toThrow("需要超级管理员权限");
  });
});

// ==================== importLogs.list ====================

describe("importLogs.list", () => {
  it("returns paginated import logs", async () => {
    const { ctx } = createSuperAdminContext();
    const caller = appRouter.createCaller(ctx);

    const mockItems = [
      { id: 2, fileName: "latest.xlsx", username: "admin", mode: "overwrite", isActive: true, sheetsCount: 3, productsCount: 100, createdAt: new Date() },
      { id: 1, fileName: "old.xlsx", username: "admin", mode: "merge", isActive: false, sheetsCount: 2, productsCount: 50, createdAt: new Date() },
    ];
    vi.mocked(db.getImportLogs).mockResolvedValue({ items: mockItems, total: 2 } as any);

    const result = await caller.importLogs.list({ page: 1, pageSize: 20 });

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(db.getImportLogs).toHaveBeenCalledWith({ page: 1, pageSize: 20, search: undefined });
  });

  it("passes search parameter to db", async () => {
    const { ctx } = createSuperAdminContext();
    const caller = appRouter.createCaller(ctx);

    vi.mocked(db.getImportLogs).mockResolvedValue({ items: [], total: 0 } as any);

    await caller.importLogs.list({ page: 1, pageSize: 20, search: "test" });

    expect(db.getImportLogs).toHaveBeenCalledWith({ page: 1, pageSize: 20, search: "test" });
  });

  it("returns empty list when no logs exist", async () => {
    const { ctx } = createSuperAdminContext();
    const caller = appRouter.createCaller(ctx);

    vi.mocked(db.getImportLogs).mockResolvedValue({ items: [], total: 0 } as any);

    const result = await caller.importLogs.list({ page: 1, pageSize: 20 });

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("throws FORBIDDEN for non-superAdmin user", async () => {
    const { ctx } = createNonSuperAdminContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.importLogs.list({ page: 1, pageSize: 20 })).rejects.toThrow("需要超级管理员权限");
  });
});

// ==================== cpl.import overwrite mode ====================

describe("cpl.import overwrite mode", () => {
  it("calls importCplOverwrite with correct params", async () => {
    const { ctx } = createSuperAdminContext();
    const caller = appRouter.createCaller(ctx);

    vi.mocked(db.importCplOverwrite).mockResolvedValue({ importLogId: 1 } as any);
    vi.mocked(db.createActivityLog).mockResolvedValue(undefined as any);

    // Create a minimal valid xlsx buffer as base64
    // We need to mock XLSX parsing — since parseExcelBuffer is internal,
    // we create a valid xlsx file in-memory
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const wsData = [
      ["产品型号", "产品说明", "媒体价"],
      ["OS9907-CHAS", "OS9907机箱", "342833"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "OmniSwitch 9900");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const fileBase64 = buffer.toString("base64");

    const result = await caller.cpl.import({
      fileBase64,
      fileName: "test.xlsx",
      mode: "overwrite",
    });

    expect(result.success).toBe(true);
    expect(result.sheetsImported).toBe(1);
    expect(result.productsImported).toBe(1);
    expect(db.importCplOverwrite).toHaveBeenCalledOnce();

    const callArg = vi.mocked(db.importCplOverwrite).mock.calls[0][0];
    expect(callArg.fileName).toBe("test.xlsx");
    expect(callArg.userId).toBe(1);
    expect(callArg.username).toBe("superadmin");
    expect(callArg.productsCount).toBe(1);
    expect(callArg.sheetsCount).toBe(1);
    expect(callArg.sheetNames).toEqual(["OmniSwitch 9900"]);
  });

  it("throws FORBIDDEN for non-superAdmin user", async () => {
    const { ctx } = createNonSuperAdminContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.cpl.import({ fileBase64: "dGVzdA==", fileName: "test.xlsx", mode: "overwrite" })
    ).rejects.toThrow("需要超级管理员权限");
  });
});

// ==================== cpl.import merge mode ====================

describe("cpl.import merge mode", () => {
  it("inserts products with the active importLogId", async () => {
    const { ctx } = createSuperAdminContext();
    const caller = appRouter.createCaller(ctx);

    const activeImportId = 7;
    vi.mocked(db.getActiveImportLogId).mockResolvedValue(activeImportId);
    vi.mocked(db.insertSheets).mockResolvedValue(undefined as any);
    vi.mocked(db.bulkInsertProducts).mockResolvedValue(undefined as any);
    vi.mocked(db.createImportLogAndGetId).mockResolvedValue(8 as any);
    vi.mocked(db.createActivityLog).mockResolvedValue(undefined as any);

    // Create a valid xlsx with a product
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const wsData = [
      ["产品型号", "产品说明", "媒体价"],
      ["OS9910-CHAS", "OS9910机箱", "500000"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "OmniSwitch 9900");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const fileBase64 = buffer.toString("base64");

    const result = await caller.cpl.import({
      fileBase64,
      fileName: "merge-test.xlsx",
      mode: "merge",
    });

    expect(result.success).toBe(true);
    expect(result.productsImported).toBe(1);

    // Verify products were tagged with the active importLogId
    expect(db.bulkInsertProducts).toHaveBeenCalledOnce();
    const productsArg = vi.mocked(db.bulkInsertProducts).mock.calls[0][0] as any[];
    expect(productsArg[0].importLogId).toBe(activeImportId);
    expect(productsArg[0].productModel).toBe("OS9910-CHAS");

    // Verify sheets were tagged with the active importLogId
    expect(db.insertSheets).toHaveBeenCalledOnce();
    const sheetsArg = vi.mocked(db.insertSheets).mock.calls[0][0] as any[];
    expect(sheetsArg[0].importLogId).toBe(activeImportId);

    // Verify a new import log was created with isActive: false
    expect(db.createImportLogAndGetId).toHaveBeenCalledOnce();
    const logArg = vi.mocked(db.createImportLogAndGetId).mock.calls[0][0] as any;
    expect(logArg.fileName).toBe("merge-test.xlsx");
    expect(logArg.mode).toBe("merge");
    expect(logArg.isActive).toBe(false);
  });

  it("does not call bulkInsertProducts when no products parsed", async () => {
    const { ctx } = createSuperAdminContext();
    const caller = appRouter.createCaller(ctx);

    vi.mocked(db.getActiveImportLogId).mockResolvedValue(1);
    vi.mocked(db.insertSheets).mockResolvedValue(undefined as any);
    vi.mocked(db.createImportLogAndGetId).mockResolvedValue(2 as any);
    vi.mocked(db.createActivityLog).mockResolvedValue(undefined as any);

    // Create an xlsx with only headers (no product rows)
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const wsData = [["产品型号", "产品说明"]];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "EmptySheet");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const fileBase64 = buffer.toString("base64");

    const result = await caller.cpl.import({
      fileBase64,
      fileName: "empty.xlsx",
      mode: "merge",
    });

    expect(result.success).toBe(true);
    expect(result.productsImported).toBe(0);
    expect(db.bulkInsertProducts).not.toHaveBeenCalled();
  });
});
