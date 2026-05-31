/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

// Spec matching result types

export interface MatchedSpecItem {
  productModel: string;
  productDesc: string | null;
  quantity: number;
  listPrice: string | null;
  specs: Record<string, string>;
}

export interface UnmatchedSpecItem {
  productModel: string;
  productDesc: string | null;
  quantity: number;
  listPrice: string | null;
}

export interface SpecSetCoverage {
  setId: number;
  setName: string;
  fileName: string | null;
  coverageRate: number;
  matchedCount: number;
  totalItems: number;
}

export interface SpecMatchResult {
  matched: MatchedSpecItem[];
  unmatched: UnmatchedSpecItem[];
  quotation: SpecQuotationInfo | null;
}

export interface SpecQuotationInfo {
  id: number;
  quotationNo: string | null;
  customerName: string | null;
  customerContact: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  industry: string | null;
  projectName: string | null;
  status: string;
  discountRate: string | null;
  totalAmount: string | null;
  notes: string | null;
  createdBy: number | null;
  validUntil: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  creatorName: string | null;
  creatorUsername: string | null;
  version: number | null;
  shareToken: string | null;
  items: SpecQuotationItem[];
}

export interface SpecQuotationItem {
  id: number;
  quotationId: number;
  productId: number | null;
  productModel: string;
  productDesc: string | null;
  listPrice: string | null;
  quantity: number;
  unitPrice: string | null;
  discountRate: string | null;
  subtotal: string | null;
  createdAt: Date;
  updatedAt: Date;
}
