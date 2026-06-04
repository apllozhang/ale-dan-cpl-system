import type { Quotation, QuotationItem } from "../../../drizzle/schema";

export type QuotationStatus = typeof import("../../../drizzle/schema").quotations.$inferSelect.status;

export type QuotationListItem = Pick<Quotation, "id" | "quotationNo" | "customerName" | "customerContact" | "customerPhone" | "customerEmail" | "industry" | "projectName" | "status" | "discountRate" | "totalAmount" | "notes" | "createdBy" | "validUntil" | "createdAt" | "updatedAt"> & {
  creatorName: string | null;
  creatorUsername: string | null;
};

export type QuotationDetail = QuotationListItem & {
  version: number;
  shareToken: string | null;
  items: QuotationItem[];
};

export type RecentQuotation = Pick<Quotation, "id" | "quotationNo" | "customerName" | "customerContact" | "projectName" | "status" | "totalAmount" | "createdAt" | "updatedAt">;

export interface AnalyticsSummary {
  totalQuotations: number;
  completedRevenue: number;
  avgAmount: number;
  conversionRate: number;
}

export interface IndustryRow {
  industry: string;
  count: number | string;
  totalAmount: number | string;
}

export interface CustomerRow {
  customerName: string;
  industry: string;
  count: number | string;
  totalAmount: number | string;
}

export interface SalesRepRow {
  repName: string;
  count: number | string;
  totalAmount: number | string;
  completedCount: number | string;
  submittedCount: number | string;
}

export interface TimeRow {
  month: string;
  count: number | string;
  totalAmount: number | string;
}

export interface StatusRow {
  status: string;
  count: number | string;
  totalAmount: number | string;
}

export interface TopProductRow {
  productModel: string;
  productDesc: string | null;
  quotationCount: number | string;
  totalQuantity: number | string;
  totalRevenue: number | string;
}

export interface QuotationAnalytics {
  summary: AnalyticsSummary;
  byIndustry: IndustryRow[];
  byCustomer: CustomerRow[];
  bySalesRep: SalesRepRow[];
  byTime: TimeRow[];
  byStatus: StatusRow[];
  topProducts: TopProductRow[];
}
