import { router, protectedProcedure, superAdminProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { Organization, UserGroup, InsertCplProduct, InsertCplSheet } from "../../drizzle/schema";
import * as db from "../db";
import { acquireLock, releaseLock } from "../db/locks";
import * as XLSX from "xlsx";
import { logActivity } from "./helpers";

// Import lock name and TTL (10 minutes)
const IMPORT_LOCK_NAME = "cpl_import";
const IMPORT_LOCK_TTL_MS = 10 * 60 * 1000;

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
  const products: InsertCplProduct[] = [];
  const sheetMeta: { sheetName: string; displayOrder: number; productCount: number }[] = [];

  // Parse Summary sheet
  let summaryContent = "";
  if (workbook.SheetNames.includes("Summary")) {
    const ws = workbook.Sheets["Summary"];
    const data: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const lines: string[] = [];
    for (const row of data) {
      if (Array.isArray(row)) {
        const text = row.filter((c) => c !== null && c !== undefined && c !== "").join(" ").trim();
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
    const rows: Record<string, string | number | boolean | null | undefined>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

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
      } as InsertCplProduct);
      count++;
    }

    sheetMeta.push({ sheetName: trimmedName, displayOrder: order++, productCount: count });
  }

  return { products, sheetMeta, summaryContent };
}

export const cplRouter = router({
  // Get all sheets
  sheets: protectedProcedure.query(async () => {
    try {
      return await db.getCplSheets({ pageSize: 9999 });
    } catch (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch CPL sheets", cause: error });
    }
  }),

  // Get products with filtering, pagination, sorting
  products: protectedProcedure
    .input(z.object({
      sheetName: z.string().optional(),
      sheetNames: z.array(z.string()).optional(),
      search: z.string().optional(),
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(200).default(50),
      sortBy: z.string().optional(),
      sortOrder: z.enum(["asc", "desc"]).default("asc"),
      filters: z.record(z.string(), z.string()).optional(),
      statusFilter: z.string().optional(),
      newOnly: z.boolean().optional(),
      priceMin: z.number().optional(),
      priceMax: z.number().optional(),
    }))
    .query(async ({ input }) => {
      try {
        return await db.getCplProducts(input);
      } catch (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch CPL products", cause: error });
      }
    }),

  // Get products by IDs (for quotation pre-fill)
  productsByIds: protectedProcedure
    .input(z.object({
      ids: z.array(z.number()).min(1).max(200),
    }))
    .query(async ({ input }) => {
      try {
        return await db.getCplProductsByIds(input.ids);
      } catch (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch CPL products by IDs", cause: error });
      }
    }),

  // Export all filtered products (no pagination limit)
  exportProducts: protectedProcedure
    .input(z.object({
      sheetName: z.string().optional(),
      sheetNames: z.array(z.string()).optional(),
      search: z.string().optional(),
      sortBy: z.string().optional(),
      sortOrder: z.enum(["asc", "desc"]).default("asc"),
      filters: z.record(z.string(), z.string()).optional(),
      statusFilter: z.string().optional(),
      newOnly: z.boolean().optional(),
      priceMin: z.number().optional(),
      priceMax: z.number().optional(),
    }))
    .query(async ({ input }) => {
      try {
        return await db.getCplProducts({ ...input, page: 1, pageSize: 10000 });
      } catch (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to export CPL products", cause: error });
      }
    }),

  // Get latest summary
  summary: protectedProcedure.query(async () => {
    try {
      return await db.getLatestSummary();
    } catch (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch CPL summary", cause: error });
    }
  }),

  // Get active import log info
  activeImport: protectedProcedure.query(async () => {
    try {
      return await db.getActiveImportLog();
    } catch (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch active import log", cause: error });
    }
  }),

  // Check if existing data exists
  hasData: protectedProcedure.query(async () => {
    try {
      const count = await db.countCplProducts();
      return { hasData: count > 0, count };
    } catch (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to check CPL data existence", cause: error });
    }
  }),

  stats: protectedProcedure.query(async () => {
    try {
      return await db.getCplStats();
    } catch (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch CPL stats", cause: error });
    }
  }),

  // Import Excel file — always overwrite (old data preserved for switching)
  import: superAdminProcedure
    .input(z.object({
      fileBase64: z.string().max(50_000_000).optional(),
      filePath: z.string().optional(),
      fileName: z.string(),
      selectedSheets: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const lockOwner = `user:${ctx.user.id}:${Date.now()}`;
      const lockAcquired = await acquireLock(IMPORT_LOCK_NAME, lockOwner, IMPORT_LOCK_TTL_MS);
      if (!lockAcquired) {
        throw new TRPCError({ code: "CONFLICT", message: "Another import is in progress, please wait" });
      }
      try {
        let buffer: Buffer;

        // Support both base64 and file path
        if (input.filePath) {
          // Read from file path (uploaded via /api/upload)
          const fs = await import("fs/promises");
          try {
            buffer = await fs.readFile(input.filePath);
            // Clean up temp file after reading
            await fs.unlink(input.filePath).catch(() => {});
          } catch (error) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Failed to read uploaded file", cause: error });
          }
        } else if (input.fileBase64) {
          // Legacy base64 support
          try {
            buffer = Buffer.from(input.fileBase64, "base64");
          } catch (error) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid file data: failed to decode base64", cause: error });
          }
        } else {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Either fileBase64 or filePath is required" });
        }

        let parseResult: ReturnType<typeof parseExcelBuffer>;
        try {
          parseResult = parseExcelBuffer(buffer, input.selectedSheets);
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Failed to parse Excel file", cause: error });
        }
        const { products, sheetMeta, summaryContent } = parseResult;

        if (products.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No valid products found in the imported file" });
        }

        // Fetch org/group names for logging
        let orgName = "";
        let groupName = "";
        try {
          if (ctx.user!.organizationId) {
            const orgs: Organization[] = await db.getAllOrganizations();
            orgName = orgs.find((o) => o.id === ctx.user!.organizationId)?.name || "";
          }
          if (ctx.user!.groupId) {
            const groups: UserGroup[] = await db.getAllUserGroups();
            groupName = groups.find((g) => g.id === ctx.user!.groupId)?.name || "";
          }
        } catch (error) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch organization info for import", cause: error });
        }

        const cleanedSheets: Omit<InsertCplSheet, "id">[] = sheetMeta.map((s) => {
          const { id, ...rest } = s as InsertCplSheet & { id?: number };
          return rest;
        });

        try {
          await db.importCplOverwrite({
            fileName: input.fileName,
            userId: ctx.user!.id,
            username: ctx.user!.username || "unknown",
            orgName: orgName || null,
            groupName: groupName || null,
            sheetNames: sheetMeta.map((s) => s.sheetName),
            sheetsCount: sheetMeta.length,
            productsCount: products.length,
            products: products as InsertCplProduct[],
            sheets: cleanedSheets as Omit<InsertCplSheet, "id">[],
            summary: summaryContent ? { content: summaryContent, version: input.fileName } : undefined,
          });
        } catch (error) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to import CPL data into database", cause: error });
        }

        // Audit log
        try {
          await logActivity(ctx, {
            action: "import_data", resourceType: "import",
            detail: { fileName: input.fileName, mode: "overwrite", productsCount: products.length },
          });
        } catch (error) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to log import activity", cause: error });
        }

        return {
          success: true,
          sheetsImported: sheetMeta.length,
          productsImported: products.length,
          hasSummary: !!summaryContent,
        };
      } finally {
        await releaseLock(IMPORT_LOCK_NAME, lockOwner);
      }
    }),
});
