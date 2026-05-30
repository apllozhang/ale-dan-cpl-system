import { router, permissionProcedure, superAdminProcedure } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { PERMISSIONS } from "@shared/const";

function csvEscape(val: string | null | undefined): string {
  if (!val) return '';
  const str = String(val);
  if (/^[=+\-@]/.test(str)) return "'" + str;
  return '"' + str.replace(/"/g, '""') + '"';
}

export const activityLogsRouter = router({
  list: permissionProcedure(PERMISSIONS.VIEW_ACTIVITY_LOGS)
    .input(z.object({
      search: z.string().optional(),
      action: z.string().optional(),
      resourceType: z.string().optional(),
      userId: z.number().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ input }) => {
      return db.getActivityLogs(input);
    }),
  stats: permissionProcedure(PERMISSIONS.VIEW_ACTIVITY_LOGS)
    .query(async () => {
      return db.getActivityStats();
    }),
  export: permissionProcedure(PERMISSIONS.VIEW_ACTIVITY_LOGS)
    .input(z.object({
      search: z.string().optional(),
      action: z.string().optional(),
      resourceType: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const { items } = await db.getActivityLogs({ ...input, page: 1, pageSize: 10000 });
      const header = "ID,时间,用户,操作,资源类型,资源ID,详情,IP";
      const rows = items.map((l: any) =>
        `${l.id},${csvEscape(new Date(l.createdAt).toLocaleString("zh-CN"))},${csvEscape(l.username)},${csvEscape(l.action)},${csvEscape(l.resourceType)},${l.resourceId || ''},${csvEscape((l.detail || "").slice(0, 200))},${csvEscape(l.ipAddress)}`
      );
      return header + "\n" + rows.join("\n");
    }),
  clear: superAdminProcedure.mutation(async () => {
    await db.clearActivityLogs();
    return { success: true };
  }),
});
