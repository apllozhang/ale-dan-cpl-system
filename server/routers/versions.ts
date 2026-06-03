import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import type { QuotationVersion } from "../../drizzle/schema";
import * as db from "../db";

interface SnapshotData {
  changeSummary?: string | null;
  diff?: Record<string, unknown> | null;
  totalAmount?: string | null;
  items?: SnapshotItem[];
}

interface SnapshotItem {
  productModel: string;
  productDesc?: string;
  quantity?: number;
  listPrice?: string;
  discountRate?: string;
  subtotal?: string;
  [key: string]: unknown;
}

interface DiffResult {
  productModel: string;
  productDesc?: string;
  change: "added" | "removed" | "modified" | "unchanged";
  before: { quantity?: number; listPrice?: string; discountRate?: string; subtotal?: string } | null;
  after: { quantity?: number; listPrice?: string; discountRate?: string; subtotal?: string } | null;
}

export const versionsRouter = router({
  list: protectedProcedure
    .input(z.object({ quotationId: z.number() }))
    .query(async ({ input }) => {
      const versions: QuotationVersion[] = await db.getQuotationVersions(input.quotationId);
      return versions.map((v) => {
        let parsed: SnapshotData | null = null;
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
      const versions: QuotationVersion[] = await db.getQuotationVersions(input.quotationId);
      const fromV = versions.find((v) => v.version === input.fromVersion);
      const toV = versions.find((v) => v.version === input.toVersion);
      if (!fromV || !toV) return null;

      let fromData: SnapshotData | null = null, toData: SnapshotData | null = null;
      try { fromData = JSON.parse(fromV.snapshot); } catch {}
      try { toData = JSON.parse(toV.snapshot); } catch {}
      if (!fromData || !toData) return null;

      const fromItems = new Map<string, SnapshotItem>((fromData.items || []).map((it) => [it.productModel, it]));
      const toItems = new Map<string, SnapshotItem>((toData.items || []).map((it) => [it.productModel, it]));
      const allModels = Array.from(new Set<string>([...Array.from(fromItems.keys()), ...Array.from(toItems.keys())]));

      const result: DiffResult[] = [];
      for (const model of allModels) {
        const fi: SnapshotItem | undefined = fromItems.get(model);
        const ti: SnapshotItem | undefined = toItems.get(model);
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
