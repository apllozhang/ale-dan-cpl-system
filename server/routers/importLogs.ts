import { router, publicProcedure, superAdminProcedure } from "../_core/trpc";
import { z } from "zod";
import type { ImportLog } from "../../drizzle/schema";
import * as db from "../db";
import { TRPCError } from "@trpc/server";

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
      try {
        return await db.getImportLogs(input);
      } catch (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch import logs', cause: error });
      }
    }),
  clear: superAdminProcedure.mutation(async () => {
    try {
      await db.clearImportLogs();
      return { success: true };
    } catch (error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to clear import logs', cause: error });
    }
  }),
  deleteLog: superAdminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      try {
        const log = await db.getImportLogById(input.id);
        if (!log) throw new TRPCError({ code: 'NOT_FOUND', message: 'Resource not found' });
        if ((log as ImportLog).isActive) throw new TRPCError({ code: 'BAD_REQUEST', message: '当前正在使用的导入不能删除，请先切换到其他导入' });
        await db.deleteImportLog(input.id);
        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete import log', cause: error });
      }
    }),
  switchActive: superAdminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      try {
        const log = await db.getImportLogById(input.id);
        if (!log) throw new TRPCError({ code: 'NOT_FOUND', message: 'Resource not found' });
        await db.deactivateAllImports();
        await db.activateImport(input.id);
        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to switch active import', cause: error });
      }
    }),
  checkDuplicate: publicProcedure
    .input(z.object({ fileName: z.string() }))
    .query(async ({ input }) => {
      try {
        return await db.getImportLogsByFileName(input.fileName);
      } catch (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to check duplicate import', cause: error });
      }
    }),
  export: superAdminProcedure.query(async () => {
    try {
      const { items } = await db.getImportLogs({ page: 1, pageSize: 10000 });
      const header = "ID,文件名,用户,组织,用户组,模式,Sheet数,产品数,时间";
      const rows = items.map((l: ImportLog) =>
        `${l.id},${csvEscape(l.fileName)},${csvEscape(l.username)},${csvEscape(l.orgName ?? '')},${csvEscape(l.groupName ?? '')},${csvEscape(l.mode === 'overwrite' ? '完全覆盖' : '合并')},${l.sheetsCount},${l.productsCount},${csvEscape(new Date(l.createdAt).toLocaleString('zh-CN'))}`
      );
      return header + "\n" + rows.join("\n");
    } catch (error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to export import logs', cause: error });
    }
  }),
});
