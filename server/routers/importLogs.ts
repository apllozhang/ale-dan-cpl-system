import { router, superAdminProcedure } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";

function csvEscape(val: string | null | undefined): string {
  if (!val) return '';
  const str = String(val);
  if (/^[=+\-@]/.test(str)) return "'" + str;
  return '"' + str.replace(/"/g, '""') + '"';
}

export const importLogsRouter = router({
  list: superAdminProcedure
    .input(z.object({
      search: z.string().optional(),
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ input }) => {
      return db.getImportLogs(input);
    }),
  clear: superAdminProcedure.mutation(async () => {
    await db.clearImportLogs();
    return { success: true };
  }),
  deleteLog: superAdminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const log = await db.getImportLogById(input.id);
      if (!log) throw new Error("导入记录不存在");
      if ((log as any).isActive) throw new Error("当前正在使用的导入不能删除，请先切换到其他导入");
      await db.deleteImportLog(input.id);
      return { success: true };
    }),
  switchActive: superAdminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const log = await db.getImportLogById(input.id);
      if (!log) throw new Error("导入记录不存在");
      await db.deactivateAllImports();
      // Activate the target import
      await db.activateImport(input.id);
      return { success: true };
    }),
  export: superAdminProcedure.query(async () => {
    const { items } = await db.getImportLogs({ page: 1, pageSize: 10000 });
    // Format as CSV
    const header = "ID,文件名,用户,组织,用户组,模式,Sheet数,产品数,时间";
    const rows = items.map((l: any) =>
      `${l.id},${csvEscape(l.fileName)},${csvEscape(l.username)},${csvEscape(l.orgName)},${csvEscape(l.groupName)},${csvEscape(l.mode === 'overwrite' ? '完全覆盖' : '合并')},${l.sheetsCount},${l.productsCount},${csvEscape(new Date(l.createdAt).toLocaleString('zh-CN'))}`
    );
    return header + "\n" + rows.join("\n");
  }),
});
