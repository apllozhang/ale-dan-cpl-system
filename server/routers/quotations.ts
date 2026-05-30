import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { logActivity } from "./helpers";
import { QUOTATION_STATUS_TRANSITIONS, QUOTATION_STATUS_LABELS } from "@shared/const";

export const quotationsRouter = router({
  list: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      status: z.string().optional(),
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(100).default(20),
      sortBy: z.string().optional(),
      sortOrder: z.enum(["asc", "desc"]).default("desc"),
    }))
    .query(async ({ input, ctx }) => {
      return db.getQuotations({
        ...input,
        createdBy: ctx.user.role === "admin" ? undefined : ctx.user.id,
      });
    }),
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getQuotationById(input.id);
    }),
  create: protectedProcedure
    .input(z.object({
      customerName: z.string().min(1).max(256),
      customerContact: z.string().max(128).optional(),
      customerPhone: z.string().max(64).optional(),
      customerEmail: z.string().max(320).optional(),
      industry: z.string().max(128).optional(),
      projectName: z.string().max(256).optional(),
      discountRate: z.number().optional(),
      notes: z.string().max(5000).optional(),
      validUntil: z.string().optional(),
      items: z.array(z.object({
        productId: z.number().optional(),
        productModel: z.string(),
        productDesc: z.string().optional(),
        listPrice: z.string().optional(),
        quantity: z.number().min(1).default(1),
        unitPrice: z.number().optional(),
        discountRate: z.number().optional(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const { items, validUntil, ...quotationData } = input;
      const quotation = {
        ...quotationData,
        quotationNo: "",
        status: "draft" as const,
        totalAmount: "0",
        discountRate: String(input.discountRate ?? 0),
        validUntil: validUntil ? new Date(validUntil) : undefined,
        createdBy: ctx.user.id,
      };
      const createdQuotation = await db.createQuotation(quotation, []);
      const processedItems = items.map(item => {
        const unitPrice = item.unitPrice ?? parseFloat(item.listPrice || "0");
        const discount = item.discountRate ?? input.discountRate ?? 0;
        const subtotal = unitPrice * item.quantity * (discount / 100);
        return {
          quotationId: createdQuotation.id,
          productId: item.productId ?? null,
          productModel: item.productModel,
          productDesc: item.productDesc ?? null,
          listPrice: item.listPrice ?? null,
          quantity: item.quantity,
          unitPrice: String(unitPrice),
          discountRate: String(discount),
          subtotal: String(subtotal),
        };
      });
      const totalAmount = processedItems.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);
      const result = await db.updateQuotation(createdQuotation.id, {
        totalAmount: String(totalAmount),
      }, processedItems);
      await logActivity(ctx, { action: "create_quotation", resourceType: "quotation", resourceId: createdQuotation.id, detail: { customerName: input.customerName, itemCount: items.length } });
      return result;
    }),
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      customerName: z.string().min(1).max(256).optional(),
      customerContact: z.string().max(128).optional(),
      customerPhone: z.string().max(64).optional(),
      customerEmail: z.string().max(320).optional(),
      industry: z.string().max(128).optional(),
      projectName: z.string().max(256).optional(),
      discountRate: z.number().optional(),
      notes: z.string().max(5000).optional(),
      validUntil: z.string().optional(),
      items: z.array(z.object({
        productId: z.number().optional(),
        productModel: z.string(),
        productDesc: z.string().optional(),
        listPrice: z.string().optional(),
        quantity: z.number().min(1).default(1),
        unitPrice: z.number().optional(),
        discountRate: z.number().optional(),
      })).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, items, validUntil, ...quotationData } = input;
      // Ownership check: only owner or admin/sales_manager can update
      const quotation = await db.getQuotationById(id);
      if (!quotation) throw new TRPCError({ code: "NOT_FOUND", message: "报价单不存在" });
      const isAdmin = ["admin", "sales_manager"].includes(ctx.user.role) || ctx.user.isSuperAdmin;
      if (!isAdmin && quotation.createdBy !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "无权编辑此报价单" });
      }
      let processedItems = undefined;
      let totalAmount = undefined;
      if (items) {
        processedItems = items.map(item => {
          const unitPrice = item.unitPrice ?? parseFloat(item.listPrice || "0");
          const discount = item.discountRate ?? input.discountRate ?? 0;
          const subtotal = unitPrice * item.quantity * (discount / 100);
          return {
            quotationId: id,
            productId: item.productId ?? null,
            productModel: item.productModel,
            productDesc: item.productDesc ?? null,
            listPrice: item.listPrice ?? null,
            quantity: item.quantity,
            unitPrice: String(unitPrice),
            discountRate: String(discount),
            subtotal: String(subtotal),
          };
        });
        totalAmount = String(processedItems.reduce((sum, item) => sum + parseFloat(item.subtotal), 0));
      }
      const result = await db.updateQuotation(id, {
        ...quotationData,
        totalAmount,
        discountRate: input.discountRate !== undefined ? String(input.discountRate) : undefined,
        validUntil: validUntil ? new Date(validUntil) : undefined,
      }, processedItems, ctx.user.id);
      await logActivity(ctx, { action: "update_quotation", resourceType: "quotation", resourceId: id, detail: { quotationNo: quotation.quotationNo } });
      return result;
    }),
  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["draft", "submitted", "approved", "sent", "completed", "cancelled"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const quotation = await db.getQuotationById(input.id);
      if (!quotation) throw new TRPCError({ code: "NOT_FOUND", message: "报价单不存在" });
      const isAdmin = ["admin", "sales_manager"].includes(ctx.user.role) || ctx.user.isSuperAdmin;
      if (!isAdmin && quotation.createdBy !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "无权修改此报价单状态" });
      }
      const currentStatus = quotation.status;
      const allowed = QUOTATION_STATUS_TRANSITIONS[currentStatus] || [];
      if (!allowed.includes(input.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `不能从"${QUOTATION_STATUS_LABELS[currentStatus] || currentStatus}"变为"${QUOTATION_STATUS_LABELS[input.status] || input.status}"` });
      }
      await db.updateQuotationStatus(input.id, input.status);
      await logActivity(ctx, { action: "update_status", resourceType: "quotation", resourceId: input.id, detail: { quotationNo: quotation.quotationNo, oldStatus: currentStatus, newStatus: input.status } });
      return { success: true };
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const quotation = await db.getQuotationById(input.id);
      if (!quotation) throw new TRPCError({ code: "NOT_FOUND", message: "报价单不存在" });
      const isAdmin = ["admin", "sales_manager"].includes(ctx.user.role) || ctx.user.isSuperAdmin;
      if (!isAdmin && quotation.createdBy !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "无权删除此报价单" });
      }
      await logActivity(ctx, { action: "delete_quotation", resourceType: "quotation", resourceId: input.id, detail: { quotationNo: quotation.quotationNo, customerName: quotation.customerName } });
      return db.deleteQuotation(input.id);
    }),

  batchUpdateStatus: protectedProcedure
    .input(z.object({
      ids: z.array(z.number()).min(1),
      status: z.enum(["draft", "submitted", "approved", "sent", "completed", "cancelled"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const isAdmin = ["admin", "sales_manager"].includes(ctx.user.role) || ctx.user.isSuperAdmin;
      const validIds: number[] = [];
      for (const id of input.ids) {
        const q = await db.getQuotationById(id);
        if (!q) continue;
        if (!isAdmin && q.createdBy !== ctx.user.id) continue;
        const allowed = QUOTATION_STATUS_TRANSITIONS[q.status] || [];
        if (!allowed.includes(input.status)) continue;
        validIds.push(id);
      }
      if (validIds.length > 0) {
        await db.batchUpdateQuotationStatus(validIds, input.status);
        await logActivity(ctx, { action: "update_status", resourceType: "quotation", detail: { status: input.status, count: validIds.length } });
      }
      return { success: true, updated: validIds.length };
    }),

  batchDelete: protectedProcedure
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ input, ctx }) => {
      const isAdmin = ["admin", "sales_manager"].includes(ctx.user.role) || ctx.user.isSuperAdmin;
      const validIds: number[] = [];
      for (const id of input.ids) {
        const q = await db.getQuotationById(id);
        if (q && (isAdmin || q.createdBy === ctx.user.id)) {
          validIds.push(id);
        }
      }
      if (validIds.length > 0) {
        await db.batchDeleteQuotations(validIds);
        await logActivity(ctx, { action: "delete_quotation", resourceType: "quotation", detail: { count: validIds.length } });
      }
      return { success: true, deleted: validIds.length };
    }),

  analytics: protectedProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const isAdmin = ['admin', 'sales_manager'].includes(ctx.user.role) || ctx.user.isSuperAdmin;
      return db.getQuotationAnalytics({
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        userId: isAdmin ? undefined : ctx.user.id,
      });
    }),

  myDashboard: protectedProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const [stats, recent] = await Promise.all([
        db.getMyDashboardStats(
          ctx.user.id,
          input.startDate ? new Date(input.startDate) : undefined,
          input.endDate ? new Date(input.endDate) : undefined,
        ),
        db.getMyRecentQuotations(ctx.user.id, 6),
      ]);
      return { stats, recent };
    }),
});
