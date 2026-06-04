import { like } from "drizzle-orm";
import type { MySqlColumn } from "drizzle-orm/mysql-core";
import {
  cplProducts,
} from "../../drizzle/schema";
import { getDb } from "./index";

export async function getSearchSuggestions(field: string, query: string, limit: number = 10) {
  const db = await getDb();
  if (!db || !query) return [];
  const columnMap: Record<string, MySqlColumn | undefined> = {
    productModel: cplProducts.productModel,
    productDesc: cplProducts.productDesc,
    productGroup: cplProducts.productGroup,
  };
  const col = columnMap[field];
  if (!col) return [];
  const term = `%${query}%`;
  return db.selectDistinct({ value: col }).from(cplProducts)
    .where(like(col, term))
    .limit(limit);
}
