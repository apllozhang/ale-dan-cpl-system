import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";

export const suggestionsRouter = router({
  get: publicProcedure
    .input(z.object({
      field: z.string(),
      query: z.string(),
      limit: z.number().min(1).max(20).default(10),
    }))
    .query(async ({ input }) => {
      return db.getSearchSuggestions(input.field, input.query, input.limit);
    }),
});
