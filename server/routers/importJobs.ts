import { router, protectedProcedure, superAdminProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import crypto from "crypto";

export const importJobsRouter = router({
  /**
   * Create a new import job
   * Accepts uploadId + fileName + selectedSheets, returns jobId immediately
   */
  create: superAdminProcedure
    .input(z.object({
      uploadId: z.string().min(1).max(64),
      fileName: z.string().min(1).max(256),
      selectedSheets: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
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

  /**
   * Get import job by ID (for polling status)
   */
  getById: superAdminProcedure
    .input(z.object({ id: z.string().min(1).max(64) }))
    .query(async ({ input }) => {
      try {
        const job = await db.getImportJobById(input.id);
        if (!job) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Import job not found",
          });
        }
        return job;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch import job",
          cause: error,
        });
      }
    }),

  /**
   * List import jobs for the current user
   */
  list: superAdminProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ input, ctx }) => {
      try {
        return await db.getImportJobsByUser(ctx.user!.id, input);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch import jobs",
          cause: error,
        });
      }
    }),

  /**
   * List all import jobs (admin view)
   */
  listAll: superAdminProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ input }) => {
      try {
        return await db.getImportJobs(input);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch import jobs",
          cause: error,
        });
      }
    }),

  /**
   * Cancel a pending import job
   */
  cancel: superAdminProcedure
    .input(z.object({ id: z.string().min(1).max(64) }))
    .mutation(async ({ input, ctx }) => {
      try {
        const cancelled = await db.cancelImportJob(input.id, ctx.user!.id);
        if (!cancelled) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Job not found, not owned by you, or not in pending status",
          });
        }
        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to cancel import job",
          cause: error,
        });
      }
    }),

  /**
   * Get import job statistics
   */
  stats: superAdminProcedure.query(async () => {
    try {
      return await db.getImportJobStats();
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch import job stats",
        cause: error,
      });
    }
  }),
});
