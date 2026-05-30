import { router, protectedProcedure, permissionProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { PERMISSIONS, hasPermission } from "@shared/const";

export const templatesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.getQuotationTemplates(ctx.user!.id);
  }),
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getQuotationTemplateById(input.id);
    }),
  create: permissionProcedure(PERMISSIONS.CREATE_QUOTATION)
    .input(z.object({
      name: z.string().min(1).max(256),
      description: z.string().optional(),
      isPublic: z.boolean().default(false),
      discountRate: z.number().optional(),
      notes: z.string().optional(),
      validDays: z.number().optional(),
      items: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      return db.createQuotationTemplate({
        ...input,
        createdBy: ctx.user!.id,
      } as any);
    }),
  update: permissionProcedure(PERMISSIONS.CREATE_QUOTATION)
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(256).optional(),
      description: z.string().optional(),
      isPublic: z.boolean().optional(),
      discountRate: z.number().optional(),
      notes: z.string().optional(),
      validDays: z.number().optional(),
      items: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const template = await db.getQuotationTemplateById(id);
      if (!template) throw new TRPCError({ code: "NOT_FOUND" });
      if (template.createdBy !== ctx.user!.id && !hasPermission(ctx.user!, PERMISSIONS.MANAGE_USERS)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "只能编辑自己的模板" });
      }
      await db.updateQuotationTemplate(id, data as any);
      return { success: true };
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const template = await db.getQuotationTemplateById(input.id);
      if (!template) throw new TRPCError({ code: "NOT_FOUND" });
      if (template.createdBy !== ctx.user!.id && !hasPermission(ctx.user!, PERMISSIONS.MANAGE_USERS)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "只能删除自己的模板" });
      }
      await db.deleteQuotationTemplate(input.id);
      return { success: true };
    }),
});
