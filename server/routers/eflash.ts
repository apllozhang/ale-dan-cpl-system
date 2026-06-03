import { router, protectedProcedure, permissionProcedure } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db/eflash";
import { PERMISSIONS } from "@shared/const";
import { logActivity } from "./helpers";
import XLSX from "xlsx";
import path from "path";
import fs from "fs/promises";
import { TRPCError } from "@trpc/server";
import { parseExcelDateToDate } from "../lib/excel-date-parser";

const EFLASH_MANAGE = PERMISSIONS.EFLASH_MANAGE;

const uploadDir = path.resolve(process.cwd(), "uploads/eflash");

export const eflashRouter = router({
  list: protectedProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(100).default(20),
      type: z.enum(["phase_in", "phase_out", "service", "pricing", "program"]).optional(),
      division: z.enum(["communications", "network", "general"]).optional(),
      scope: z.enum(["global", "china"]).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      search: z.string().optional(),
      tagIds: z.array(z.number()).optional(),
    }))
    .query(async ({ input }) => {
      try {
        return await db.listEFlashRecords(input);
      } catch (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to list eFlash records", cause: error });
      }
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      try {
        const record = await db.getEFlashRecordById(input.id);
        if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Record not found" });
        return record;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get eFlash record", cause: error });
      }
    }),

  listTags: protectedProcedure
    .input(z.object({
      category: z.enum(["region", "product"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      try {
        return await db.listEFlashTags(input?.category);
      } catch (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to list eFlash tags", cause: error });
      }
    }),

  getStats: protectedProcedure
    .query(async () => {
      try {
        return await db.getEFlashStats();
      } catch (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get eFlash stats", cause: error });
      }
    }),

  create: permissionProcedure(EFLASH_MANAGE)
    .input(z.object({
      eflashId: z.string().min(1).max(20),
      type: z.enum(["phase_in", "phase_out", "service", "pricing", "program"]),
      division: z.enum(["communications", "network", "general"]),
      scope: z.enum(["global", "china"]),
      subjectEn: z.string().optional(),
      subjectCn: z.string().optional(),
      globalDate: z.string().optional(),
      chinaDate: z.string().optional(),
      effectiveDate: z.string().optional(),
      authorEn: z.string().max(200).optional(),
      authorCn: z.string().max(200).optional(),
      comments: z.string().optional(),
      tagIds: z.array(z.number()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const { tagIds, ...data } = input;
        const id = await db.createEFlashRecord(
          {
            ...data,
            globalDate: data.globalDate ? new Date(data.globalDate) : null,
            chinaDate: data.chinaDate ? new Date(data.chinaDate) : null,
            effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : null,
            createdBy: ctx.user.id,
          },
          tagIds
        );
        await logActivity(ctx, {
          action: "create_eflash",
          resourceType: "eflash",
          resourceId: id,
        });
        return { id };
      } catch (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create eFlash record", cause: error });
      }
    }),

  update: permissionProcedure(EFLASH_MANAGE)
    .input(z.object({
      id: z.number(),
      eflashId: z.string().min(1).max(20).optional(),
      type: z.enum(["phase_in", "phase_out", "service", "pricing", "program"]).optional(),
      division: z.enum(["communications", "network", "general"]).optional(),
      scope: z.enum(["global", "china"]).optional(),
      subjectEn: z.string().optional(),
      subjectCn: z.string().optional(),
      globalDate: z.string().optional(),
      chinaDate: z.string().optional(),
      effectiveDate: z.string().optional(),
      authorEn: z.string().max(200).optional(),
      authorCn: z.string().max(200).optional(),
      comments: z.string().optional(),
      tagIds: z.array(z.number()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const { id, tagIds, ...data } = input;
        const updateData: Record<string, unknown> = { ...data };
        if (data.globalDate !== undefined) updateData.globalDate = data.globalDate ? new Date(data.globalDate) : null;
        if (data.chinaDate !== undefined) updateData.chinaDate = data.chinaDate ? new Date(data.chinaDate) : null;
        if (data.effectiveDate !== undefined) updateData.effectiveDate = data.effectiveDate ? new Date(data.effectiveDate) : null;

        await db.updateEFlashRecord(id, updateData, tagIds);
        await logActivity(ctx, {
          action: "update_eflash",
          resourceType: "eflash",
          resourceId: id,
        });
        return { id };
      } catch (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update eFlash record", cause: error });
      }
    }),

  delete: permissionProcedure(EFLASH_MANAGE)
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      try {
        await db.deleteEFlashRecord(input.id);
        await logActivity(ctx, {
          action: "delete_eflash",
          resourceType: "eflash",
          resourceId: input.id,
        });
        return { success: true };
      } catch (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to delete eFlash record", cause: error });
      }
    }),

  importExcel: permissionProcedure(EFLASH_MANAGE)
    .input(z.object({
      fileBase64: z.string().max(50_000_000),
      sheetNames: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const buffer = Buffer.from(input.fileBase64, "base64");
        const workbook = XLSX.read(buffer, { type: "buffer" });

        const allRows: Array<{
          eflashId: string;
          type: string;
          division: string;
          scope: string;
          subjectEn?: string;
          subjectCn?: string;
          globalDate?: Date | null;
          chinaDate?: Date | null;
          effectiveDate?: Date | null;
          authorEn?: string;
          authorCn?: string;
          comments?: string;
        }> = [];

        const parseDate = parseExcelDateToDate;

        const hasMergedSheet = !!workbook.Sheets["eFlash Records"];
        const targetSheets = hasMergedSheet
          ? ["eFlash Records"]
          : (input.sheetNames?.length ? input.sheetNames : ["China", "NET Global", "COMM Global"]);

        for (const sheetName of targetSheets) {
          const ws = workbook.Sheets[sheetName];
          if (!ws) continue;

          if (hasMergedSheet) {
            const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);
            for (const row of rows) {
              const eflashId = (row["eFlash ID"] || "").trim().replace(/\s+/g, "");
              if (!eflashId || !eflashId.startsWith("EF-")) continue;

              const typeRaw = (row.Type || "").trim();
              const divRaw = (row.Division || "").trim();
              const scopeRaw = (row.Scope || "").trim();

              const TYPE_MAP: Record<string, string> = {
                "phase-in": "phase_in", "phase_in": "phase_in",
                "phase-out": "phase_out", "phase_out": "phase_out",
                "service": "service", "pricing": "pricing", "program": "program",
              };
              const type = TYPE_MAP[typeRaw.toLowerCase()] || "service";

              allRows.push({
                eflashId,
                type,
                division: divRaw.toLowerCase() || "general",
                scope: scopeRaw.toLowerCase() || "global",
                subjectEn: (row["Subject (EN)"] || "").trim() || undefined,
                subjectCn: (row["Subject (CN)"] || "").trim() || undefined,
                globalDate: parseDate(row["Global Date"]),
                chinaDate: parseDate(row["China Date"]),
                effectiveDate: parseDate(row["Effective Date"]),
                authorEn: (row["Author (EN)"] || "").trim() || undefined,
                authorCn: (row["Author (CN)"] || "").trim() || undefined,
                comments: (row.Comments || "").trim() || undefined,
              });
            }
          } else {
            const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
            for (let i = 2; i < data.length; i++) {
              const row = data[i];
              if (!row || row.length < 2) continue;

              const eflashId = String(row[3] || "").trim();
              if (!eflashId || !eflashId.startsWith("EF-")) continue;

              const typeStr = String(row[1] || "").trim();
              const prefix = eflashId.match(/^EF-([A-Z])/)?.[1] || "";

              let division = "general";
              let scope = "global";
              if (prefix === "Z") {
                scope = "china";
                division = String(row[0] || "").toLowerCase().includes("network") ? "network" : "communications";
              } else if (prefix === "N") {
                division = "network";
                scope = "global";
              } else if (prefix === "C") {
                division = "communications";
                scope = "global";
              } else if (prefix === "S" || prefix === "P") {
                division = String(row[0] || "").toLowerCase().includes("network") ? "network" : "general";
                scope = "global";
              }

              allRows.push({
                eflashId,
                type: typeStr,
                division,
                scope,
                subjectEn: String(row[4] || "").trim() || undefined,
                subjectCn: String(row[5] || "").trim() || undefined,
                globalDate: parseDate(row[6]),
                chinaDate: parseDate(row[7]),
                effectiveDate: parseDate(row[8]),
                authorEn: String(row[9] || "").trim() || undefined,
                authorCn: String(row[10] || "").trim() || undefined,
                comments: String(row[11] || "").trim() || undefined,
              });
            }
          }
        }

        const result = await db.importEFlashFromRows(allRows, ctx.user.id);
        await logActivity(ctx, {
          action: "import_eflash",
          resourceType: "eflash",
          detail: { created: result.created, updated: result.updated, failed: result.failed },
        });
        return result;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to import eFlash data", cause: error });
      }
    }),

  uploadAttachment: permissionProcedure(EFLASH_MANAGE)
    .input(z.object({
      recordId: z.number(),
      fileName: z.string().max(500),
      fileBase64: z.string().max(50_000_000),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const record = await db.getEFlashRecordById(input.recordId);
        if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Record not found" });

        const recordDir = path.join(uploadDir, record.eflashId);
        await fs.mkdir(recordDir, { recursive: true });

        const filePath = path.join(recordDir, input.fileName);
        const buffer = Buffer.from(input.fileBase64, "base64");
        await fs.writeFile(filePath, buffer);

        const id = await db.createAttachment({
          recordId: input.recordId,
          fileName: input.fileName,
          filePath,
          fileSize: buffer.length,
          uploadedBy: ctx.user.id,
        });

        return { id };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to upload attachment", cause: error });
      }
    }),

  deleteAttachment: permissionProcedure(EFLASH_MANAGE)
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      try {
        await db.deleteAttachment(input.id);
        await logActivity(ctx, {
          action: "delete_eflash_attachment",
          resourceType: "eflash_attachment",
          resourceId: input.id,
        });
        return { success: true };
      } catch (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to delete attachment", cause: error });
      }
    }),
});
