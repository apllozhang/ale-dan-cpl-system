import { router, protectedProcedure } from "../../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as service from "./quotation.service";

export const quotationsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        status: z.string().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
        sortBy: z.string().optional(),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
      }),
    )
    .query(async ({ input, ctx }) => {
      try {
        return await service.listQuotations(ctx, input);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list quotations",
          cause: error,
        });
      }
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      try {
        return await service.getQuotationDetail(ctx, input.id);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get quotation",
          cause: error,
        });
      }
    }),

  create: protectedProcedure
    .input(
      z.object({
        customerName: z.string().min(1).max(256),
        customerContact: z.string().max(128).optional(),
        customerPhone: z.string().max(64).optional(),
        customerEmail: z.string().max(320).optional(),
        industry: z.string().max(128).optional(),
        projectName: z.string().max(256).optional(),
        discountRate: z.number().optional(),
        notes: z.string().max(5000).optional(),
        validUntil: z.string().optional(),
        items: z.array(
          z.object({
            productId: z.number().optional(),
            productModel: z.string(),
            productDesc: z.string().optional(),
            listPrice: z.string().optional(),
            quantity: z.number().min(1).default(1),
            unitPrice: z.number().optional(),
            discountRate: z.number().optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await service.createQuotation(ctx, input);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create quotation",
          cause: error,
        });
      }
    }),

  update: protectedProcedure
    .input(
      z.object({
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
        items: z
          .array(
            z.object({
              productId: z.number().optional(),
              productModel: z.string(),
              productDesc: z.string().optional(),
              listPrice: z.string().optional(),
              quantity: z.number().min(1).default(1),
              unitPrice: z.number().optional(),
              discountRate: z.number().optional(),
            }),
          )
          .optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await service.updateQuotation(ctx, input);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update quotation",
          cause: error,
        });
      }
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum([
          "draft",
          "submitted",
          "approved",
          "sent",
          "completed",
          "cancelled",
        ]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await service.updateStatus(ctx, input);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update quotation status",
          cause: error,
        });
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      try {
        return await service.deleteQuotation(ctx, input.id);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete quotation",
          cause: error,
        });
      }
    }),

  batchUpdateStatus: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.number()).min(1),
        status: z.enum([
          "draft",
          "submitted",
          "approved",
          "sent",
          "completed",
          "cancelled",
        ]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await service.batchUpdateStatus(ctx, input);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to batch update quotation statuses",
          cause: error,
        });
      }
    }),

  batchDelete: protectedProcedure
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ input, ctx }) => {
      try {
        return await service.batchDelete(ctx, input);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to batch delete quotations",
          cause: error,
        });
      }
    }),

  analytics: protectedProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      try {
        return await service.getAnalytics(ctx, input);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get quotation analytics",
          cause: error,
        });
      }
    }),

  myDashboard: protectedProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      try {
        return await service.getDashboard(ctx, input);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get dashboard data",
          cause: error,
        });
      }
    }),
});
