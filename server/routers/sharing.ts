import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { randomBytes } from "crypto";
import { PERMISSIONS, hasPermission } from "@shared/const";

export const sharingRouter = router({
  share: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const q = await db.getQuotationById(input.id);
      if (!q) throw new TRPCError({ code: "NOT_FOUND" });
      if (q.createdBy !== ctx.user!.id && !hasPermission(ctx.user!, PERMISSIONS.EDIT_ALL_QUOTATIONS)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (q.shareToken) return { shareToken: q.shareToken };
      const token = randomBytes(16).toString("hex");
      await db.updateQuotation(input.id, { shareToken: token } as any, undefined);
      return { shareToken: token };
    }),
  getByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      return db.getQuotationByShareToken(input.token);
    }),
});
