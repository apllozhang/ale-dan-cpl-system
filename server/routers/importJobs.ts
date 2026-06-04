import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db/importJobs";
import { TRPCError } from "@trpc/server";

export const importJobsRouter = router({
  /** Get a single import job by ID */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const job = await db.getImportJobById(input.id);
      if (!job) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Import job not found" });
      }
      return job;
    }),

  /** Cancel a pending/processing import job */
  cancel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const job = await db.getImportJobById(input.id);
      if (!job) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Import job not found" });
      }
      if (job.status !== "pending" && job.status !== "processing") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Job is not cancellable" });
      }
      await db.cancelImportJob(input.id);
      return { success: true };
    }),
});
