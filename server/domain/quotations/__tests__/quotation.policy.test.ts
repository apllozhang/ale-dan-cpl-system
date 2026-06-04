import { describe, it, expect } from "vitest";
import { canReadQuotation, canEditQuotation, canDeleteQuotation, assertCanEditQuotation } from "../quotation.policy";
import { TRPCError } from "@trpc/server";

type User = { id: number; role: string; isSuperAdmin: boolean };
type Quotation = { id: number; createdBy: number; status: string };

function makeUser(overrides: Partial<User> = {}): User {
  return { id: 1, role: "user", isSuperAdmin: false, ...overrides };
}

function makeQuotation(overrides: Partial<Quotation> = {}): Quotation {
  return { id: 100, createdBy: 1, status: "draft", ...overrides };
}

describe("quotation.policy", () => {
  describe("canReadQuotation", () => {
    it("allows owner to read own quotation", () => {
      expect(canReadQuotation(makeUser({ id: 1 }), makeQuotation({ createdBy: 1 }))).toBe(true);
    });
    it("blocks non-owner from reading", () => {
      expect(canReadQuotation(makeUser({ id: 2 }), makeQuotation({ createdBy: 1 }))).toBe(false);
    });
    it("allows admin to read any quotation", () => {
      expect(canReadQuotation(makeUser({ role: "admin" }), makeQuotation({ createdBy: 999 }))).toBe(true);
    });
    it("allows sales_manager to read any quotation", () => {
      expect(canReadQuotation(makeUser({ role: "sales_manager" }), makeQuotation({ createdBy: 999 }))).toBe(true);
    });
    it("allows superAdmin to read any quotation", () => {
      expect(canReadQuotation(makeUser({ isSuperAdmin: true }), makeQuotation({ createdBy: 999 }))).toBe(true);
    });
  });

  describe("canEditQuotation", () => {
    it("allows owner to edit own quotation", () => {
      expect(canEditQuotation(makeUser({ id: 1 }), makeQuotation({ createdBy: 1 }))).toBe(true);
    });
    it("blocks non-owner from editing", () => {
      expect(canEditQuotation(makeUser({ id: 2 }), makeQuotation({ createdBy: 1 }))).toBe(false);
    });
    it("allows admin to edit any quotation", () => {
      expect(canEditQuotation(makeUser({ role: "admin" }), makeQuotation({ createdBy: 999 }))).toBe(true);
    });
  });

  describe("canDeleteQuotation", () => {
    it("allows owner to delete own quotation", () => {
      expect(canDeleteQuotation(makeUser({ id: 1 }), makeQuotation({ createdBy: 1 }))).toBe(true);
    });
    it("blocks non-owner from deleting", () => {
      expect(canDeleteQuotation(makeUser({ id: 2 }), makeQuotation({ createdBy: 1 }))).toBe(false);
    });
    it("allows admin to delete any quotation", () => {
      expect(canDeleteQuotation(makeUser({ role: "admin" }), makeQuotation({ createdBy: 999 }))).toBe(true);
    });
  });

  describe("assertCanEditQuotation", () => {
    it("throws FORBIDDEN for non-owner", () => {
      expect(() => assertCanEditQuotation(makeUser({ id: 2 }), makeQuotation({ createdBy: 1 }))).toThrow(TRPCError);
    });
    it("does not throw for owner", () => {
      expect(() => assertCanEditQuotation(makeUser({ id: 1 }), makeQuotation({ createdBy: 1 }))).not.toThrow();
    });
  });
});
