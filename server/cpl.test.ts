import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

// Mock bcryptjs first
vi.mock("bcryptjs", () => ({
  hash: vi.fn().mockResolvedValue("$2a$10$hashedpassword"),
  compare: vi.fn(async (password: string, hash: string) => {
    return password === "Ale@tss" && hash === "$2a$10$hashedpassword";
  }),
}));

// Mock db module
vi.mock("./db", () => ({
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
  getUserByUsername: vi.fn((username: string) => {
    if (username === "aletss") {
      return Promise.resolve({
        id: 1,
        username: "aletss",
        name: "ALE TSS",
        passwordHash: "$2a$10$hashedpassword",
        role: "user",
      });
    }
    return Promise.resolve(null);
  }),
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
  createQuotation: vi.fn().mockResolvedValue({ id: 1 }),
  getQuotations: vi.fn().mockResolvedValue([]),
  getQuotationById: vi.fn().mockResolvedValue(null),
  updateQuotation: vi.fn().mockResolvedValue(undefined),
  updateQuotationStatus: vi.fn().mockResolvedValue(undefined),
  deleteQuotation: vi.fn().mockResolvedValue(undefined),
  searchQuotations: vi.fn().mockResolvedValue([]),
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
});

describe("cpl.summary", () => {
  it("returns latest summary", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const summary = await caller.cpl.summary();
    expect(summary).toBeDefined();
    expect(summary.version).toBe("DataCPL-(Q2May2026CN).xlsx");
  });
});
