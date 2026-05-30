import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";

export const searchesRouter = router({
  list: protectedProcedure
    .input(z.object({ page: z.string() }))
    .query(async ({ input, ctx }) => {
      return db.getSavedSearches(ctx.user!.id, input.page);
    }),
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(128),
      page: z.string().min(1),
      conditions: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      return db.createSavedSearch({ ...input, userId: ctx.user!.id });
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteSavedSearch(input.id);
      return { success: true };
    }),
});
