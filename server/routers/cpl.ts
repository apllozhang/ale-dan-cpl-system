import { router, protectedProcedure, superAdminProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { Organization, UserGroup, InsertCplProduct, InsertCplSheet } from "../../drizzle/schema";
import * as db from "../db";
import { acquireLock, releaseLock } from "../db/locks";
import { logActivity } from "./helpers";
import crypto from "crypto";

import { parseExcelBuffer } from "../lib/excel";
export { parseExcelBuffer };

// Import lock name and TTL (10 minutes)
const IMPORT_LOCK_NAME = "cpl_import";
const IMPORT_LOCK_TTL_MS = 10 * 60 * 1000;

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
  // DEPRECATED: Use importAsync for new imports. This synchronous version is kept for backward compatibility.
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
          const { id: _id, ...rest } = s as InsertCplSheet & { id?: number };
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

  // Async import — creates a job for background processing
  // Requires ENABLE_ASYNC_IMPORT=true to be active; disabled by default for safety
  importAsync: superAdminProcedure
    .input(z.object({
      uploadId: z.string().min(1).max(64),
      fileName: z.string(),
      selectedSheets: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Guard: async import must be explicitly enabled
      if (process.env.ENABLE_ASYNC_IMPORT !== "true") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Async import is not enabled. Set ENABLE_ASYNC_IMPORT=true to activate.",
        });
      }

      try {
        // Verify upload exists and belongs to this user
        const upload = await db.getTempUploadForUser(input.uploadId, ctx.user!.id);
        if (!upload) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Upload not found, expired, or already consumed",
          });
        }

        // Create import job
        const jobId = crypto.randomUUID();
        await db.createImportJob({
          id: jobId,
          type: "cpl",
          fileName: input.fileName,
          uploadId: input.uploadId,
          createdBy: ctx.user!.id,
          selectedSheets: input.selectedSheets,
        });

        return { success: true, jobId };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create import job",
          cause: error,
        });
      }
    }),
});
