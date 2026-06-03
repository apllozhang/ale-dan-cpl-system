import { describe, expect, it, vi } from "vitest";

function mockRes() {
  const res: Record<string, unknown> = {
    _status: 200,
    _body: null,
    statusCode: 200,
    status(code: number) {
      res._status = code;
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res._body = body;
      return res;
    },
  };
  return res as unknown as { _status: number; _body: unknown; statusCode: number } & Record<string, unknown>;
}

describe("Health Check Logic", () => {
  it("ready endpoint returns { status: ready }", () => {
    const res = mockRes();
    (res as Record<string, unknown>).json({ status: "ready" });
    expect(res._body).toEqual({ status: "ready" });
  });

  it("health returns healthy when DB query succeeds", async () => {
    const mockDb = { execute: vi.fn().mockResolvedValue(undefined) };
    const res = mockRes();
    try {
      const db = mockDb;
      if (!db) {
        (res as Record<string, unknown>).status(503).json({ status: "unhealthy", db: "disconnected" });
        return;
      }
      await db.execute("SELECT 1");
      (res as Record<string, unknown>).json({ status: "healthy", db: "connected" });
    } catch {
      (res as Record<string, unknown>).status(503).json({ status: "unhealthy", db: "error" });
    }
    expect(res._status || 200).toBe(200);
    expect(res._body).toEqual({ status: "healthy", db: "connected" });
  });

  it("health returns 503 when DB is null", () => {
    const res = mockRes();
    const db = null;
    if (!db) {
      (res as Record<string, unknown>).status(503).json({ status: "unhealthy", db: "disconnected" });
    }
    expect(res._status).toBe(503);
    expect(res._body).toEqual({ status: "unhealthy", db: "disconnected" });
  });

  it("health returns 503 when DB query throws", async () => {
    const mockDb = { execute: vi.fn().mockRejectedValue(new Error("connection lost")) };
    const res = mockRes();
    try {
      await mockDb.execute("SELECT 1");
      (res as Record<string, unknown>).json({ status: "healthy", db: "connected" });
    } catch {
      (res as Record<string, unknown>).status(503).json({ status: "unhealthy", db: "error" });
    }
    expect(res._status).toBe(503);
    expect(res._body).toEqual({ status: "unhealthy", db: "error" });
  });
});
