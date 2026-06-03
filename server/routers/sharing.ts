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
      try {
        const q = await db.getQuotationById(input.id);
        if (!q) throw new TRPCError({ code: "NOT_FOUND", message: "Quotation not found" });
        if (q.createdBy !== ctx.user!.id && !hasPermission(ctx.user!, PERMISSIONS.EDIT_ALL_QUOTATIONS)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
        }
        if (q.shareToken) return { shareToken: q.shareToken };
        const token = randomBytes(16).toString("hex");
        await db.updateQuotation(input.id, { shareToken: token }, undefined);
        return { shareToken: token };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to share quotation", cause: error });
      }
    }),
  getByToken: publicProcedure
    .meta({ rateLimit: { max: 20, windowMs: 60_000 } })
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      try {
        return await db.getQuotationByShareToken(input.token);
      } catch (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get shared quotation", cause: error });
      }
    }),
});
