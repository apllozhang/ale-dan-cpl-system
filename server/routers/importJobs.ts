import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db/importJobs";
import { TRPCError } from "@trpc/server";

export const importJobsRouter = router({
  /** Get a single import job by ID — only owner or admin can view */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const job = await db.getImportJobById(input.id);
      if (!job) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Import job not found" });
      }
      // Only owner, admin, or superAdmin can view
      if (job.createdBy !== ctx.user.id && ctx.user.role !== "admin" && !ctx.user.isSuperAdmin) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to view this job" });
      }
      return job;
    }),

  /** Cancel a pending/processing import job — only owner or admin can cancel */
  cancel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const job = await db.getImportJobById(input.id);
      if (!job) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Import job not found" });
      }
      // Ownership check: only creator, admin, or superAdmin can cancel
      if (job.createdBy !== ctx.user.id && ctx.user.role !== "admin" && !ctx.user.isSuperAdmin) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to cancel this job" });
      }
      if (job.status !== "pending" && job.status !== "processing") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Job is not cancellable" });
      }
      await db.cancelImportJob(input.id);
      return { success: true };
    }),
});
