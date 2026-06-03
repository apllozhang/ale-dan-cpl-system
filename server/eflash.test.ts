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

// Mock eFlash db module — factory must be self-contained (hoisted before top-level variables)
vi.mock("./db/eflash", () => ({
  listEFlashRecords: vi.fn().mockResolvedValue({
    items: [
      {
        id: 1,
        eflashId: "EF-2026-001",
        type: "phase_in",
        division: "communications",
        scope: "global",
        subjectEn: "Test",
        subjectCn: "测试",
        globalDate: new Date("2026-01-15"),
        chinaDate: null,
        effectiveDate: new Date("2026-02-01"),
        authorEn: "Author",
        authorCn: null,
        comments: null,
        createdBy: 1,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      },
    ],
    total: 1,
  }),
  getEFlashRecordById: vi.fn().mockResolvedValue(null),
  listEFlashTags: vi.fn().mockResolvedValue([
    { id: 1, name: "China", category: "region" },
  ]),
  getEFlashStats: vi.fn().mockResolvedValue({
    total: 10,
    byType: { phase_in: 5, phase_out: 3, service: 2 },
    pendingCount: 1,
  }),
  createEFlashRecord: vi.fn().mockResolvedValue(1),
  updateEFlashRecord: vi.fn().mockResolvedValue(undefined),
  deleteEFlashRecord: vi.fn().mockResolvedValue(undefined),
  importEFlashFromRows: vi.fn().mockResolvedValue({
    created: 5,
    updated: 0,
    failed: 0,
  }),
}));

// Mock db module (for logActivity -> createActivityLog)
vi.mock("./db", () => ({
  createActivityLog: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(null),
  getUserByUsername: vi.fn().mockResolvedValue(null),
  upsertUser: vi.fn().mockResolvedValue(undefined),
}));

function createAuthedContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: {
      id: 1,
      username: "aletss",
      name: "ALE TSS",
      role: "admin",
      isSuperAdmin: false,
    } as TrpcContext["user"],
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
    requestId: "test-request-id",
  };
  return { ctx };
}

describe("eflash.list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns records with expected fields", async () => {
    const { ctx } = createAuthedContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.eflash.list({});

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.items[0].eflashId).toBe("EF-2026-001");
    expect(result.items[0].type).toBe("phase_in");
    expect(result.items[0].division).toBe("communications");
    expect(result.items[0].scope).toBe("global");
    expect(result.items[0].subjectEn).toBe("Test");
    expect(result.items[0].subjectCn).toBe("测试");
  });
});

describe("eflash.getById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws NOT_FOUND for non-existent ID", async () => {
    const { ctx } = createAuthedContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.eflash.getById({ id: 999 })).rejects.toThrow(
      "Record not found"
    );
  });
});

describe("eflash.listTags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns tags", async () => {
    const { ctx } = createAuthedContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.eflash.listTags({});

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("China");
    expect(result[0].category).toBe("region");
  });
});

describe("eflash.getStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns stats with expected shape", async () => {
    const { ctx } = createAuthedContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.eflash.getStats();

    expect(result.total).toBe(10);
    expect(result.byType).toEqual({
      phase_in: 5,
      phase_out: 3,
      service: 2,
    });
    expect(result.pendingCount).toBe(1);
  });
});

describe("eflash.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("succeeds with valid input", async () => {
    const { ctx } = createAuthedContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.eflash.create({
      eflashId: "EF-2026-001",
      type: "phase_in",
      division: "communications",
      scope: "global",
      subjectEn: "Test",
      subjectCn: "测试",
      effectiveDate: "2026-02-01",
    });

    expect(result).toEqual({ id: 1 });
  });
});
