import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

// Mock db module
vi.mock("./db", () => ({
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
  getCplSheets: vi.fn().mockResolvedValue([
    { id: 1, sheetName: "OmniSwitch 9900", displayOrder: 0, productCount: 57 },
    { id: 2, sheetName: "OmniSwitch 9500", displayOrder: 1, productCount: 18 },
  ]),
  getCplProducts: vi.fn().mockResolvedValue({
    items: [
      {
        id: 1,
        sheetName: "OmniSwitch 9900",
        productGroup: "OmniSwitch 9900 Chassis",
        taxCategory: "交换机主机箱",
        productModel: "OS9907-CHAS",
        productDesc: "OS9907机箱",
        salesCategory: "C",
        serviceCategory: "4",
        productStatus: "Standard",
        listPrice: "342833",
        priceNote: "",
        isNew: "",
        remark: "",
      },
    ],
    total: 1,
  }),
  getLatestSummary: vi.fn().mockResolvedValue({
    id: 1,
    content: "2026年5月CPL主要变化如下：\n新发布\n无",
    version: "DataCPL-(Q2May2026CN).xlsx",
    importedAt: new Date("2026-05-13"),
  }),
  clearAllProducts: vi.fn().mockResolvedValue(undefined),
  clearAndInsertSheets: vi.fn().mockResolvedValue(undefined),
  bulkInsertProducts: vi.fn().mockResolvedValue(undefined),
  insertSummary: vi.fn().mockResolvedValue(undefined),
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

function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "local-aletss",
      email: "aletss@ale.com",
      name: "ALE TSS",
      loginMethod: "local",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
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

describe("auth.login", () => {
  it("succeeds with correct credentials", async () => {
    const { ctx, setCookies } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.login({
      username: "aletss",
      password: "Ale@tss",
    });

    expect(result).toEqual({ success: true, name: "ALE TSS" });
    expect(setCookies).toHaveLength(1);
    expect(setCookies[0]?.name).toBe(COOKIE_NAME);
    expect(setCookies[0]?.value).toBeTruthy();
  });

  it("fails with wrong password", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({ username: "aletss", password: "wrong" })
    ).rejects.toThrow("用户名或密码错误");
  });

  it("fails with wrong username", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({ username: "admin", password: "Ale@tss" })
    ).rejects.toThrow("用户名或密码错误");
  });
});

describe("cpl.sheets", () => {
  it("returns all sheets", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const sheets = await caller.cpl.sheets();
    expect(sheets).toHaveLength(2);
    expect(sheets[0].sheetName).toBe("OmniSwitch 9900");
    expect(sheets[0].productCount).toBe(57);
  });
});

describe("cpl.products", () => {
  it("returns products with pagination info", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.cpl.products({
      sheetName: "OmniSwitch 9900",
      page: 1,
      pageSize: 50,
    });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.items[0].productModel).toBe("OS9907-CHAS");
  });

  it("accepts search parameter", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.cpl.products({
      search: "OS9907",
      page: 1,
      pageSize: 50,
    });

    expect(result).toBeDefined();
    expect(result.items).toBeDefined();
  });

  it("accepts filters parameter", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.cpl.products({
      page: 1,
      pageSize: 50,
      filters: { productGroup: "Chassis" },
    });

    expect(result).toBeDefined();
  });
});

describe("cpl.summary", () => {
  it("returns the latest summary", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const summary = await caller.cpl.summary();
    expect(summary).not.toBeNull();
    expect(summary!.content).toContain("2026年5月CPL主要变化");
    expect(summary!.version).toBe("DataCPL-(Q2May2026CN).xlsx");
  });
});

describe("cpl.import", () => {
  it("rejects unauthenticated users", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.cpl.import({
        fileBase64: "dGVzdA==",
        fileName: "test.xlsx",
      })
    ).rejects.toThrow();
  });
});
