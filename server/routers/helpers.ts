import * as db from "../db";

export function logActivity(ctx: any, params: {
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
