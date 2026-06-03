import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "../db";

export const customersRouter = router({
  list: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ input }) => {
      try {
        return await db.getCustomerList(input);
      } catch (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to list customers", cause: error });
      }
    }),
});
