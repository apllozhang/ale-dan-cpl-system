import { eq } from "drizzle-orm";
import { quotations, quotationVersions } from "../../../drizzle/schema";
import { requireDb } from "../../db/index";

interface ItemForDiff {
  productModel: string;
  quantity: number | string;
  discountRate?: number | string | null;
}

export interface ItemDiffResult {
  added: string[];
  removed: string[];
  modified: string[];
}

export function computeItemDiff(oldItems: ItemForDiff[], newItems: ItemForDiff[]): ItemDiffResult {
  const oldItemMap = new Map(oldItems.map((it) => [it.productModel, it]));
  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];

  for (const ni of newItems) {
    const oi = oldItemMap.get(ni.productModel);
    if (!oi) {
      added.push(ni.productModel);
    } else {
      if (
        Number(oi.quantity) !== Number(ni.quantity) ||
        Number(oi.discountRate ?? 0) !== Number(ni.discountRate ?? 0)
      ) {
        modified.push(ni.productModel);
      }
    }
  }

  const newItemSet = new Set(newItems.map((it) => it.productModel));
  for (const oi of oldItems) {
    if (!newItemSet.has(oi.productModel)) removed.push(oi.productModel);
  }

  return { added, removed, modified };
}

export function buildChangeSummary(
  oldData: { customerName: string | null; projectName: string | null; status: string },
  newData: { customerName?: string | null; projectName?: string | null; status?: string },
  itemDiff: ItemDiffResult,
): string {
  const changes: string[] = [];
  const { added, removed, modified } = itemDiff;

  if (added.length > 0)
    changes.push(
      `+${added.length}项: ${added.slice(0, 3).join(", ")}${added.length > 3 ? "..." : ""}`,
    );
  if (removed.length > 0)
    changes.push(
      `-${removed.length}项: ${removed.slice(0, 3).join(", ")}${removed.length > 3 ? "..." : ""}`,
    );
  if (modified.length > 0)
    changes.push(
      `改${modified.length}项: ${modified.slice(0, 3).join(", ")}${modified.length > 3 ? "..." : ""}`,
    );
  if (newData.customerName && newData.customerName !== oldData.customerName)
    changes.push("客户名称变更");
  if (newData.projectName && newData.projectName !== oldData.projectName)
    changes.push("项目名称变更");
  if (newData.status && newData.status !== oldData.status) changes.push(`状态→${newData.status}`);

  return changes.length > 0 ? changes.join("; ") : "信息更新";
}

export async function createVersionSnapshot(
  quotationId: number,
  oldQuotation: { version: number; totalAmount: string | null },
  snapshotData: {
    items: Array<Record<string, unknown>>;
    totalAmount: string | null;
    changeSummary: string;
    diff: ItemDiffResult;
  },
  userId: number,
): Promise<void> {
  const db = await requireDb();
  const newVersion = (oldQuotation.version ?? 1) + 1;
  const snapshot = JSON.stringify(snapshotData);

  await db.update(quotations).set({ version: newVersion }).where(eq(quotations.id, quotationId));
  await db.insert(quotationVersions).values({
    quotationId,
    version: newVersion,
    snapshot,
    createdBy: userId,
  });
}
