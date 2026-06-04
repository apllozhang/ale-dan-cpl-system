import { TRPCError } from "@trpc/server";

interface UserLike {
  id: number;
  role: string;
  isSuperAdmin: boolean;
}

interface QuotationLike {
  id: number;
  createdBy: number;
  status: string;
}

export function isManagerOrAdmin(user: UserLike): boolean {
  return user.isSuperAdmin || user.role === "admin" || user.role === "sales_manager";
}

export function canReadQuotation(user: UserLike, quotation: QuotationLike): boolean {
  if (isManagerOrAdmin(user)) return true;
  return quotation.createdBy === user.id;
}

export function canEditQuotation(user: UserLike, quotation: QuotationLike): boolean {
  if (isManagerOrAdmin(user)) return true;
  return quotation.createdBy === user.id;
}

export function canDeleteQuotation(user: UserLike, quotation: QuotationLike): boolean {
  if (isManagerOrAdmin(user)) return true;
  return quotation.createdBy === user.id;
}

export function assertCanReadQuotation(user: UserLike, quotation: QuotationLike): void {
  if (!canReadQuotation(user, quotation)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
  }
}

export function assertCanEditQuotation(user: UserLike, quotation: QuotationLike): void {
  if (!canEditQuotation(user, quotation)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
  }
}

export function assertCanDeleteQuotation(user: UserLike, quotation: QuotationLike): void {
  if (!canDeleteQuotation(user, quotation)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
  }
}
