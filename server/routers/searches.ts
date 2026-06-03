import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "../db";

export const searchesRouter = router({
  list: protectedProcedure
    .input(z.object({ page: z.string() }))
    .query(async ({ input, ctx }) => {
      try {
        return await db.getSavedSearches(ctx.user!.id, input.page);
      } catch (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to list saved searches", cause: error });
      }
    }),
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(128),
      page: z.string().min(1),
      conditions: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.createSavedSearch({ ...input, userId: ctx.user!.id });
      } catch (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create saved search", cause: error });
      }
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      try {
        await db.deleteSavedSearch(input.id);
        return { success: true };
      } catch (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to delete saved search", cause: error });
      }
    }),
});
