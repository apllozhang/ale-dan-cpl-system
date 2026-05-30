import { router, publicProcedure, superAdminProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import * as XLSX from "xlsx";
import { logActivity } from "./helpers";

// Import lock to prevent concurrent imports
let importInProgress = false;

// Column name mapping for various sheet formats
const COLUMN_MAP: Record<string, string> = {
  "产品组件": "productGroup",
  "OmniVista 2500 Partner Support Software": "productGroup",
  "税务小类": "taxCategory",
  "线缆": "taxCategory",
  "类别": "taxCategory",
  "产品型号": "productModel",
  "型号": "productModel",
  "产品说明": "productDesc",
  "描述": "productDesc",
  "销售类别": "salesCategory",
  "服务类别": "serviceCategory",
  "产品状态": "productStatus",
  "服务状态": "productStatus",
  "状态": "productStatus",
  "媒体价": "listPrice",
  "价格说明": "priceNote",
  "新品": "isNew",
  "备注": "remark",
  "注释": "remark",
  "子类别": "serviceCategory",
  // English column names
  "Section": "productGroup",
  "Model No": "productModel",
  "Model Description": "productDesc",
  "Sales Category": "salesCategory",
  "Service Category": "serviceCategory",
  "Availability": "productStatus",
  "List Price": "listPrice",
  "Price Description": "priceNote",
  "NEW": "isNew",
  "Comment": "remark",
};

function parseExcelBuffer(buffer: Buffer, selectedSheets?: string[]) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetsToSkip = ["Summary", "LBS场景化报价模型"];
  const products: any[] = [];
  const sheetMeta: { sheetName: string; displayOrder: number; productCount: number }[] = [];

  // Parse Summary sheet
  let summaryContent = "";
  if (workbook.SheetNames.includes("Summary")) {
    const ws = workbook.Sheets["Summary"];
    const data = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });
    const lines: string[] = [];
    for (const row of data) {
      if (Array.isArray(row)) {
        const text = row.filter((c: any) => c !== null && c !== undefined && c !== "").join(" ").trim();
        if (text) lines.push(text);
      }
    }
    summaryContent = lines.join("\n");
  }

  // Parse product sheets
  let order = 0;
  for (const sheetName of workbook.SheetNames) {
    if (sheetsToSkip.includes(sheetName)) continue;
    if (selectedSheets && !selectedSheets.includes(sheetName)) continue;
    const trimmedName = sheetName.trim();
    const ws = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });

    let count = 0;
    for (const row of rows) {
      const mapped: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        const mappedKey = COLUMN_MAP[key.trim()];
        if (mappedKey) {
          mapped[mappedKey] = value != null ? String(value).trim() : "";
        }
      }
      // Skip empty rows
      if (!mapped.productModel && !mapped.productDesc && !mapped.productGroup) continue;

      products.push({
        sheetName: trimmedName,
        productGroup: mapped.productGroup || "",
        taxCategory: mapped.taxCategory || "",
        productModel: mapped.productModel || "",
        productDesc: mapped.productDesc || "",
        salesCategory: mapped.salesCategory || "",
        serviceCategory: mapped.serviceCategory || "",
        productStatus: mapped.productStatus || "",
        listPrice: mapped.listPrice || "",
        priceNote: mapped.priceNote || "",
        isNew: mapped.isNew || "",
        remark: mapped.remark || "",
      });
      count++;
    }

    sheetMeta.push({ sheetName: trimmedName, displayOrder: order++, productCount: count });
  }

  return { products, sheetMeta, summaryContent };
}

export const cplRouter = router({
  // Get all sheets
  sheets: publicProcedure.query(async () => {
    return db.getCplSheets();
  }),

  // Get products with filtering, pagination, sorting
  products: publicProcedure
    .input(z.object({
      sheetName: z.string().optional(),
      sheetNames: z.array(z.string()).optional(),
      search: z.string().optional(),
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(200).default(50),
      sortBy: z.string().optional(),
      sortOrder: z.enum(["asc", "desc"]).default("asc"),
      filters: z.record(z.string(), z.string()).optional(),
    }))
    .query(async ({ input }) => {
      return db.getCplProducts(input);
    }),

  // Get latest summary
  summary: publicProcedure.query(async () => {
    return db.getLatestSummary();
  }),

  // Check if existing data exists
  hasData: publicProcedure.query(async () => {
    const count = await db.countCplProducts();
    return { hasData: count > 0, count };
  }),

  stats: publicProcedure.query(async () => {
    return db.getCplStats();
  }),

  // Import Excel file
  import: superAdminProcedure
    .input(z.object({
      fileBase64: z.string().max(50_000_000),
      fileName: z.string(),
      mode: z.enum(["merge", "overwrite"]).default("overwrite"),
      selectedSheets: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const buffer = Buffer.from(input.fileBase64, "base64");
      const { products, sheetMeta, summaryContent } = parseExcelBuffer(buffer, input.selectedSheets);

      // Fetch org/group names for logging
      let orgName = "";
      let groupName = "";
      if (ctx.user!.organizationId) {
        const orgs = await db.getAllOrganizations();
        orgName = orgs.find((o: any) => o.id === ctx.user!.organizationId)?.name || "";
      }
      if (ctx.user!.groupId) {
        const groups = await db.getAllUserGroups();
        groupName = groups.find((g: any) => g.id === ctx.user!.groupId)?.name || "";
      }

      if (input.mode === "overwrite") {
        // Check import lock
        if (importInProgress) {
          throw new TRPCError({ code: "CONFLICT", message: "Another import is in progress, please wait" });
        }
        importInProgress = true;
        try {
          await db.importCplOverwrite({
            fileName: input.fileName,
            userId: ctx.user!.id,
            username: ctx.user!.username || "unknown",
            orgName: orgName || null,
            groupName: groupName || null,
            sheetNames: sheetMeta.map((s: any) => s.sheetName),
            sheetsCount: sheetMeta.length,
            productsCount: products.length,
            products: products as any,
            sheets: sheetMeta as any,
            summary: summaryContent ? { content: summaryContent, version: input.fileName } : undefined,
          });
        } finally {
          importInProgress = false;
        }
      } else {
        // Merge: check import lock
        if (importInProgress) {
          throw new TRPCError({ code: "CONFLICT", message: "Another import is in progress, please wait" });
        }
        importInProgress = true;
        try {
          // Merge: add to current active import
          const activeImportId = await db.getActiveImportLogId();

          (products as any[]).forEach((p: any) => { p.importLogId = activeImportId; });
          (sheetMeta as any[]).forEach((s: any) => { s.importLogId = activeImportId; });

          await db.insertSheets(sheetMeta as any);
          if (products.length > 0) {
            await db.bulkInsertProducts(products as any);
          }
          if (summaryContent) {
            await db.insertSummary({ content: summaryContent, version: input.fileName, importLogId: activeImportId } as any);
          }

          // Create a new import log entry
          const logId = await db.createImportLogAndGetId({
            fileName: input.fileName,
            userId: ctx.user!.id,
            username: ctx.user!.username || "unknown",
            orgName: orgName || null,
            groupName: groupName || null,
            mode: input.mode,
            sheetNames: sheetMeta.map((s: any) => s.sheetName),
            sheetsCount: sheetMeta.length,
            productsCount: products.length,
            isActive: false,
          } as any);
        } finally {
          importInProgress = false;
        }
      }

      // Audit log
      await logActivity(ctx, {
        action: "import_data", resourceType: "import",
        detail: { fileName: input.fileName, mode: input.mode, productsCount: products.length },
      });

      return {
        success: true,
        sheetsImported: sheetMeta.length,
        productsImported: products.length,
        hasSummary: !!summaryContent,
      };
    }),
});
