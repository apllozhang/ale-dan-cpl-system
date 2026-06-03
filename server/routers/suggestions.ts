import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "../db";

export const suggestionsRouter = router({
  get: publicProcedure
    .meta({ rateLimit: { max: 30, windowMs: 60_000 } })
    .input(z.object({
      field: z.string(),
      query: z.string(),
      limit: z.number().min(1).max(20).default(10),
    }))
    .query(async ({ input }) => {
      try {
        return await db.getSearchSuggestions(input.field, input.query, input.limit);
      } catch (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get suggestions", cause: error });
      }
    }),
});
