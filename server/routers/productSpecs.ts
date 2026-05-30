import { router, protectedProcedure, permissionProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import * as XLSX from "xlsx";
import { PERMISSIONS } from "@shared/const";
import { logActivity } from "./helpers";

export const productSpecsRouter = router({
  listSets: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ input }) => {
      return db.getProductSpecSets(input);
    }),

  getSetById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getProductSpecSetById(input.id);
    }),

  specSummary: protectedProcedure
    .query(async () => {
      return db.getLatestSpecSummary();
    }),

  importSet: permissionProcedure(PERMISSIONS.MANAGE_SPECS)
    .input(z.object({
      fileBase64: z.string().max(50_000_000),
      fileName: z.string(),
      name: z.string().min(1).max(256),
      description: z.string().optional(),
      selectedSheets: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const buffer = Buffer.from(input.fileBase64, "base64");
      const workbook = XLSX.read(buffer, { type: "buffer" });

      const descAliases = ["简要参数", "产品说明", "产品描述", "Product Description", "Description", "说明", "描述"];
      const modelAliases = ["型号", "Model", "产品型号", "Product Model"];

      // Extract "说明" sheet text content as summary (参照 CPL summary)
      let summaryContent: string | null = null;
      const summarySheet = workbook.SheetNames.find(n => n.trim() === "说明");
      if (summarySheet && workbook.Sheets[summarySheet]) {
        const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[summarySheet], { blankrows: false });
        summaryContent = csv.trim() || null;
      }

      // Process each sheet that has valid spec data
      const importedSets: { setId: number; name: string; modelCount: number }[] = [];

      for (const sheetName of workbook.SheetNames) {
        if (input.selectedSheets && !input.selectedSheets.includes(sheetName)) continue;
        const sheet = workbook.Sheets[sheetName];
        const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        if (rows.length === 0) continue;

        const headers = Object.keys(rows[0]);
        // Auto-detect model column: require "型号" alias — skip sheets without it
        const modelCol = headers.find(h => modelAliases.some(a => h.trim().toLowerCase() === a.toLowerCase()));
        if (!modelCol) continue;

        // Auto-detect description column
        const descCol = headers.find(h => descAliases.some(a => h.trim().toLowerCase() === a.toLowerCase()));
        // Remaining columns become spec params
        const skipCols = new Set([modelCol, ...(descCol ? [descCol] : [])]);
        const specKeys = headers.filter(h => !skipCols.has(h) && h.trim() !== "");

        const specEntries = rows
          .filter(row => (row[modelCol] || "").toString().trim() !== "")
          .map(row => ({
            setId: 0 as number,
            productModel: (row[modelCol] || "").toString().trim(),
            productDesc: descCol ? ((row[descCol] || "").toString().trim() || null) : null,
            specs: Object.fromEntries(
              specKeys.filter(k => (row[k] || "").toString().trim() !== "").map(k => [k.trim(), String(row[k] || "").trim()])
            ),
          }))
          .filter(entry => Object.keys(entry.specs).length > 0 || entry.productDesc);

        if (specEntries.length === 0) continue;

        // Use sheet name when importing multiple sheets, else use provided name
        const validSheetCount = workbook.SheetNames.filter(sn => {
          const s = workbook.Sheets[sn];
          const r: Record<string, string>[] = XLSX.utils.sheet_to_json(s, { defval: "" });
          if (r.length === 0) return false;
          const h = Object.keys(r[0]);
          const mc = h.find(hh => modelAliases.some(a => hh.trim().toLowerCase() === a.toLowerCase())) || h[0];
          return mc && r.some(rr => (rr[mc] || "").toString().trim() !== "");
        }).length;
        const setName = validSheetCount > 1 ? sheetName : input.name;

        const setId = await db.createProductSpecSet({
          name: setName,
          fileName: input.fileName,
          description: input.description || null,
          summaryContent: importedSets.length === 0 ? summaryContent : null,
          modelCount: specEntries.length,
          createdBy: ctx.user.id,
        });

        await db.bulkInsertProductSpecs(specEntries.map(e => ({ ...e, setId })));
        importedSets.push({ setId, name: setName, modelCount: specEntries.length });
      }

      if (importedSets.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No valid spec entries found in any sheet" });
      }

      const totalModels = importedSets.reduce((s, x) => s + x.modelCount, 0);
      await logActivity(ctx, {
        action: "import_specs", resourceType: "product_specs",
        detail: { name: input.name, fileName: input.fileName, sets: importedSets.length, count: totalModels },
      });

      return { setId: importedSets[0].setId, modelCount: totalModels, sets: importedSets, totalModels };
    }),

  deleteSet: permissionProcedure(PERMISSIONS.MANAGE_SPECS)
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await db.deleteProductSpecSet(input.id);
      await logActivity(ctx, { action: "delete_specs", resourceType: "product_specs", resourceId: input.id });
      return { success: true };
    }),

  updateEntry: protectedProcedure
    .input(z.object({
      id: z.number(),
      specs: z.record(z.string(), z.string()),
      productDesc: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await db.updateProductSpecEntry(input.id, { specs: input.specs, productDesc: input.productDesc });
      return { success: true };
    }),

  addEntry: protectedProcedure
    .input(z.object({
      setId: z.number(),
      productModel: z.string().min(1),
      productDesc: z.string().optional(),
      specs: z.record(z.string(), z.string()),
    }))
    .mutation(async ({ input }) => {
      const id = await db.addProductSpecEntry({
        setId: input.setId,
        productModel: input.productModel,
        productDesc: input.productDesc || null,
        specs: input.specs,
      });
      return { id };
    }),

  deleteEntry: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteProductSpecEntry(input.id);
      return { success: true };
    }),

  matchQuotation: protectedProcedure
    .input(z.object({
      quotationId: z.number(),
      setId: z.number(),
    }))
    .query(async ({ input }) => {
      return db.matchQuotationWithSpecs(input.quotationId, input.setId);
    }),
});
