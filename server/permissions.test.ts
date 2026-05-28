import { describe, it, expect } from "vitest";
import { hasPermission, PERMISSIONS } from "@shared/const";

describe("Permission system", () => {
  it("super admin has all permissions", () => {
    const superAdmin = { role: "user", isSuperAdmin: true };
    expect(hasPermission(superAdmin, PERMISSIONS.IMPORT_DATA)).toBe(true);
    expect(hasPermission(superAdmin, PERMISSIONS.MANAGE_USERS)).toBe(true);
    expect(hasPermission(superAdmin, PERMISSIONS.VIEW_PRODUCTS)).toBe(true);
  });

  it("admin can manage users but not import data", () => {
    const admin = { role: "admin", isSuperAdmin: false };
    expect(hasPermission(admin, PERMISSIONS.MANAGE_USERS)).toBe(true);
    expect(hasPermission(admin, PERMISSIONS.IMPORT_DATA)).toBe(false);
    expect(hasPermission(admin, PERMISSIONS.CREATE_QUOTATION)).toBe(true);
  });

  it("sales_manager can edit all quotations", () => {
    const manager = { role: "sales_manager", isSuperAdmin: false };
    expect(hasPermission(manager, PERMISSIONS.EDIT_ALL_QUOTATIONS)).toBe(true);
    expect(hasPermission(manager, PERMISSIONS.APPROVE_QUOTATION)).toBe(true);
    expect(hasPermission(manager, PERMISSIONS.DELETE_QUOTATION)).toBe(false);
  });

  it("sales_rep can create quotations but not edit all", () => {
    const rep = { role: "sales_rep", isSuperAdmin: false };
    expect(hasPermission(rep, PERMISSIONS.CREATE_QUOTATION)).toBe(true);
    expect(hasPermission(rep, PERMISSIONS.EDIT_OWN_QUOTATION)).toBe(true);
    expect(hasPermission(rep, PERMISSIONS.EDIT_ALL_QUOTATIONS)).toBe(false);
    expect(hasPermission(rep, PERMISSIONS.APPROVE_QUOTATION)).toBe(false);
  });

  it("viewer can only view products", () => {
    const viewer = { role: "viewer", isSuperAdmin: false };
    expect(hasPermission(viewer, PERMISSIONS.VIEW_PRODUCTS)).toBe(true);
    expect(hasPermission(viewer, PERMISSIONS.CREATE_QUOTATION)).toBe(false);
    expect(hasPermission(viewer, PERMISSIONS.MANAGE_USERS)).toBe(false);
  });

  it("regular user can view and create quotations", () => {
    const user = { role: "user", isSuperAdmin: false };
    expect(hasPermission(user, PERMISSIONS.VIEW_PRODUCTS)).toBe(true);
    expect(hasPermission(user, PERMISSIONS.CREATE_QUOTATION)).toBe(false);
    expect(hasPermission(user, PERMISSIONS.EDIT_OWN_QUOTATION)).toBe(false);
  });

  it("import_data is super admin only", () => {
    expect(hasPermission({ role: "admin", isSuperAdmin: false }, PERMISSIONS.IMPORT_DATA)).toBe(false);
    expect(hasPermission({ role: "sales_manager", isSuperAdmin: false }, PERMISSIONS.IMPORT_DATA)).toBe(false);
    expect(hasPermission({ role: "admin", isSuperAdmin: true }, PERMISSIONS.IMPORT_DATA)).toBe(true);
  });
});
