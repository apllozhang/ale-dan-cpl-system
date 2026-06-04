import { TRPCError } from "@trpc/server";
import { logActivity } from "../../routers/helpers";
import { QUOTATION_STATUS_TRANSITIONS } from "@shared/const";
import { calculateSubtotal, calculateTotalAmount } from "@shared/quotationMath";
import * as repo from "./quotation.repo";
import * as analytics from "./quotation.analytics";
import {
  assertCanReadQuotation,
  assertCanEditQuotation,
  assertCanDeleteQuotation,
  isManagerOrAdmin,
} from "./quotation.policy";
import {
  computeItemDiff,
  buildChangeSummary,
  createVersionSnapshot,
} from "./quotation.versioning";
import { requireDb } from "../../db/index";
import type { QuotationStatus, QuotationDetail } from "./quotation.types";

// ──────────────────────── Types ────────────────────────

interface ServiceContext {
  user: {
    id: number;
    role: string;
    isSuperAdmin: boolean;
    name?: string | null;
    username?: string | null;
  };
  req: { ip?: string; headers: Record<string, string | string[] | undefined> };
}

interface ItemInput {
  productId?: number;
  productModel: string;
  productDesc?: string;
  listPrice?: string;
  quantity: number;
  unitPrice?: number;
  discountRate?: number;
}

interface ProcessedItem {
  quotationId: number;
  productId: number | null;
  productModel: string;
  productDesc: string | null;
  listPrice: string | null;
  quantity: number;
  unitPrice: string;
  discountRate: string;
  subtotal: string;
}

// ──────────────────────── Helpers ────────────────────────

function processItems(
  items: ItemInput[],
  quotationId: number,
  fallbackDiscountRate: number,
): ProcessedItem[] {
  return items.map((item) => {
    const unitPrice = item.unitPrice ?? parseFloat(item.listPrice || "0");
    const discount = item.discountRate ?? fallbackDiscountRate;
    const subtotal = calculateSubtotal(unitPrice, item.quantity, discount);
    return {
      quotationId,
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
}

// ──────────────────────── Service Methods ────────────────────────

export async function listQuotations(
  ctx: ServiceContext,
  input: {
    search?: string;
    status?: string;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  },
) {
  const isAdmin = isManagerOrAdmin(ctx.user);
  return repo.getQuotations({
    ...input,
    status: input.status as QuotationStatus | "all" | undefined,
    createdBy: isAdmin ? undefined : ctx.user.id,
  });
}

export async function getQuotationDetail(
  ctx: ServiceContext,
  id: number,
): Promise<QuotationDetail> {
  const quotation = await repo.getQuotationById(id);
  if (!quotation)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Quotation not found",
    });
  assertCanReadQuotation(ctx.user, quotation);
  return quotation;
}

export async function createQuotation(
  ctx: ServiceContext,
  input: {
    customerName: string;
    customerContact?: string;
    customerPhone?: string;
    customerEmail?: string;
    industry?: string;
    projectName?: string;
    discountRate?: number;
    notes?: string;
    validUntil?: string;
    items: ItemInput[];
  },
) {
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
  const createdQuotation = await repo.createQuotation(quotation, []);

  const processedItems = processItems(
    items,
    createdQuotation.id,
    input.discountRate ?? 0,
  );
  const totalAmount = calculateTotalAmount(processedItems);

  const db = await requireDb();
  await db.transaction(async (tx) => {
    await repo.updateQuotationFields(tx, createdQuotation.id, {
      totalAmount: String(totalAmount),
    });
    await repo.replaceQuotationItems(tx, createdQuotation.id, processedItems);
  });

  await logActivity(ctx as Parameters<typeof logActivity>[0], {
    action: "create_quotation",
    resourceType: "quotation",
    resourceId: createdQuotation.id,
    detail: { customerName: input.customerName, itemCount: items.length },
  });
  return createdQuotation;
}

export async function updateQuotation(
  ctx: ServiceContext,
  input: {
    id: number;
    customerName?: string;
    customerContact?: string;
    customerPhone?: string;
    customerEmail?: string;
    industry?: string;
    projectName?: string;
    discountRate?: number;
    notes?: string;
    validUntil?: string;
    items?: ItemInput[];
  },
) {
  const { id, items, validUntil, ...quotationData } = input;

  // Fetch + authorize
  const quotation = await repo.getQuotationById(id);
  if (!quotation)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Quotation not found",
    });
  assertCanEditQuotation(ctx.user, quotation);

  // Process items if provided
  let processedItems: ProcessedItem[] | undefined;
  let totalAmount: string | undefined;
  if (items) {
    processedItems = processItems(
      items,
      id,
      input.discountRate ?? 0,
    );
    totalAmount = String(calculateTotalAmount(processedItems));
  }

  // Execute update in transaction
  const db = await requireDb();
  await db.transaction(async (tx) => {
    await repo.updateQuotationFields(tx, id, {
      ...quotationData,
      totalAmount,
      discountRate:
        input.discountRate !== undefined
          ? String(input.discountRate)
          : undefined,
      validUntil: validUntil ? new Date(validUntil) : undefined,
    });
    if (processedItems) {
      await repo.replaceQuotationItems(tx, id, processedItems);
    }
  });

  // Create version snapshot (uses its own db connection)
  const oldItems = quotation.items.map((it) => ({
    productModel: it.productModel,
    quantity: it.quantity,
    discountRate: it.discountRate,
  }));
  const newItemsForDiff = (items ?? quotation.items).map((it) => ({
    productModel: it.productModel,
    quantity: it.quantity,
    discountRate: it.discountRate,
  }));
  const itemDiff = computeItemDiff(oldItems, newItemsForDiff);
  const changeSummary = buildChangeSummary(
    {
      customerName: quotation.customerName,
      projectName: quotation.projectName,
      status: quotation.status,
    },
    quotationData,
    itemDiff,
  );
  const snapshotItems = processedItems
    ? processedItems.map((it) => ({
        productModel: it.productModel,
        productDesc: it.productDesc,
        listPrice: it.listPrice,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discountRate: it.discountRate,
        subtotal: it.subtotal,
      }))
    : quotation.items.map((it) => ({
        productModel: it.productModel,
        productDesc: it.productDesc,
        listPrice: it.listPrice,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discountRate: it.discountRate,
        subtotal: it.subtotal,
      }));
  await createVersionSnapshot(
    id,
    { version: quotation.version ?? 1, totalAmount: quotation.totalAmount },
    {
      items: snapshotItems,
      totalAmount: totalAmount ?? quotation.totalAmount,
      changeSummary,
      diff: itemDiff,
    },
    ctx.user.id,
  );

  await logActivity(ctx as Parameters<typeof logActivity>[0], {
    action: "update_quotation",
    resourceType: "quotation",
    resourceId: id,
    detail: { quotationNo: quotation.quotationNo },
  });
}

export async function updateStatus(
  ctx: ServiceContext,
  input: { id: number; status: QuotationStatus },
) {
  const quotation = await repo.getQuotationById(input.id);
  if (!quotation)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Quotation not found",
    });
  assertCanEditQuotation(ctx.user, quotation);

  const currentStatus = quotation.status as QuotationStatus;
  const allowed = QUOTATION_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(input.status)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Invalid status transition from "${currentStatus}" to "${input.status}"`,
    });
  }

  await repo.updateQuotationStatus(input.id, input.status);
  await logActivity(ctx as Parameters<typeof logActivity>[0], {
    action: "update_status",
    resourceType: "quotation",
    resourceId: input.id,
    detail: {
      quotationNo: quotation.quotationNo,
      oldStatus: currentStatus,
      newStatus: input.status,
    },
  });
  return { success: true };
}

export async function deleteQuotation(ctx: ServiceContext, id: number) {
  const quotation = await repo.getQuotationById(id);
  if (!quotation)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Quotation not found",
    });
  assertCanDeleteQuotation(ctx.user, quotation);

  await logActivity(ctx as Parameters<typeof logActivity>[0], {
    action: "delete_quotation",
    resourceType: "quotation",
    resourceId: id,
    detail: {
      quotationNo: quotation.quotationNo,
      customerName: quotation.customerName,
    },
  });
  await repo.deleteQuotation(id);
}

export async function batchUpdateStatus(
  ctx: ServiceContext,
  input: { ids: number[]; status: QuotationStatus },
) {
  const isAdmin = isManagerOrAdmin(ctx.user);
  const quotations = await repo.getQuotationsByIds(input.ids);
  const validIds = quotations
    .filter(
      (q) =>
        (isAdmin || q.createdBy === ctx.user.id) &&
        (QUOTATION_STATUS_TRANSITIONS[q.status as QuotationStatus] || []).includes(input.status),
    )
    .map((q) => q.id);
  if (validIds.length > 0) {
    await repo.batchUpdateQuotationStatus(validIds, input.status);
    await logActivity(ctx as Parameters<typeof logActivity>[0], {
      action: "update_status",
      resourceType: "quotation",
      detail: { status: input.status, count: validIds.length },
    });
  }
  return { success: true, updated: validIds.length };
}

export async function batchDelete(
  ctx: ServiceContext,
  input: { ids: number[] },
) {
  const isAdmin = isManagerOrAdmin(ctx.user);
  const quotations = await repo.getQuotationsByIds(input.ids);
  const validIds = quotations
    .filter((q) => isAdmin || q.createdBy === ctx.user.id)
    .map((q) => q.id);
  if (validIds.length > 0) {
    await repo.batchDeleteQuotations(validIds);
    await logActivity(ctx as Parameters<typeof logActivity>[0], {
      action: "delete_quotation",
      resourceType: "quotation",
      detail: { count: validIds.length },
    });
  }
  return { success: true, deleted: validIds.length };
}

export async function getAnalytics(
  ctx: ServiceContext,
  input: { startDate?: string; endDate?: string },
) {
  const isAdmin = isManagerOrAdmin(ctx.user);
  return analytics.getQuotationAnalytics({
    startDate: input.startDate ? new Date(input.startDate) : undefined,
    endDate: input.endDate ? new Date(input.endDate) : undefined,
    userId: isAdmin ? undefined : ctx.user.id,
  });
}

export async function getDashboard(
  ctx: ServiceContext,
  input: { startDate?: string; endDate?: string },
) {
  const [stats, recent] = await Promise.all([
    analytics.getMyDashboardStats(
      ctx.user.id,
      input.startDate ? new Date(input.startDate) : undefined,
      input.endDate ? new Date(input.endDate) : undefined,
    ),
    analytics.getMyRecentQuotations(ctx.user.id, 6),
  ]);
  return { stats, recent };
}
