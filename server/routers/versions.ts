import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";

export const versionsRouter = router({
  list: protectedProcedure
    .input(z.object({ quotationId: z.number() }))
    .query(async ({ input }) => {
      const versions = await db.getQuotationVersions(input.quotationId);
      return versions.map((v: any) => {
        let parsed = null;
        try { parsed = JSON.parse(v.snapshot); } catch {}
        return {
          id: v.id,
          version: v.version,
          createdBy: v.createdBy,
          createdAt: v.createdAt,
          changeSummary: parsed?.changeSummary ?? null,
          diff: parsed?.diff ?? null,
          totalAmount: parsed?.totalAmount ?? null,
          itemCount: parsed?.items?.length ?? 0,
        };
      });
    }),
  diff: protectedProcedure
    .input(z.object({
      quotationId: z.number(),
      fromVersion: z.number(),
      toVersion: z.number(),
    }))
    .query(async ({ input }) => {
      const versions = await db.getQuotationVersions(input.quotationId);
      const fromV = versions.find((v: any) => v.version === input.fromVersion);
      const toV = versions.find((v: any) => v.version === input.toVersion);
      if (!fromV || !toV) return null;

      let fromData: any = null, toData: any = null;
      try { fromData = JSON.parse(fromV.snapshot); } catch {}
      try { toData = JSON.parse(toV.snapshot); } catch {}
      if (!fromData || !toData) return null;

      const fromItems = new Map<string, any>((fromData.items || []).map((it: any) => [it.productModel, it]));
      const toItems = new Map<string, any>((toData.items || []).map((it: any) => [it.productModel, it]));
      const allModels = Array.from(new Set<string>([...Array.from(fromItems.keys()), ...Array.from(toItems.keys())]));

      const result: any[] = [];
      for (const model of allModels) {
        const fi: any = fromItems.get(model);
        const ti: any = toItems.get(model);
        let change: "added" | "removed" | "modified" | "unchanged" = "unchanged";
        if (!fi) change = "added";
        else if (!ti) change = "removed";
        else if (fi.quantity !== ti.quantity || fi.discountRate !== ti.discountRate || fi.listPrice !== ti.listPrice) change = "modified";

        result.push({
          productModel: model,
          productDesc: ti?.productDesc || fi?.productDesc,
          change,
          before: fi ? { quantity: fi.quantity, listPrice: fi.listPrice, discountRate: fi.discountRate, subtotal: fi.subtotal } : null,
          after: ti ? { quantity: ti.quantity, listPrice: ti.listPrice, discountRate: ti.discountRate, subtotal: ti.subtotal } : null,
        });
      }

      const changeOrder: Record<string, number> = { added: 0, removed: 1, modified: 2, unchanged: 3 };
      return {
        fromVersion: input.fromVersion,
        toVersion: input.toVersion,
        fromTotal: fromData.totalAmount,
        toTotal: toData.totalAmount,
        fromSummary: fromData.changeSummary,
        toSummary: toData.changeSummary,
        items: result.sort((a, b) => changeOrder[a.change] - changeOrder[b.change]),
      };
    }),
});
