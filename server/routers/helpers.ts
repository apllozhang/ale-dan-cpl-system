import * as db from "../db";

// Re-export from shared for backward compatibility
export { calculateSubtotal } from "@shared/quotationMath";

interface AuthedContext {
  user: NonNullable<import("../_core/context").TrpcContext["user"]>;
  req: import("../_core/context").TrpcContext["req"];
}

export function logActivity(ctx: AuthedContext, params: {
  action: string;
  resourceType?: string | null;
  resourceId?: number | null;
  detail?: Record<string, unknown>;
}) {
  return db.createActivityLog({
    userId: ctx.user.id,
    username: ctx.user.username || ctx.user.name || "",
    action: params.action,
    resourceType: params.resourceType ?? null,
    resourceId: params.resourceId ?? null,
    detail: params.detail ? JSON.stringify(params.detail) : null,
    ipAddress: ctx.req.ip || ctx.req.headers["x-forwarded-for"] as string || null,
  }).catch((err) => console.error("[ActivityLog] Failed:", err));
}

/** Check if user has manager/admin privileges */
export function isManagerOrAdmin(user: { role: string; isSuperAdmin: boolean }): boolean {
  return ["admin", "sales_manager"].includes(user.role) || user.isSuperAdmin;
}

/** Escape a value for CSV export */
export function csvEscape(val: string | null | undefined): string {
  if (!val) return '';
  const str = String(val);
  if (/^[=+\-@]/.test(str)) return "'" + str;
  return '"' + str.replace(/"/g, '""') + '"';
}
