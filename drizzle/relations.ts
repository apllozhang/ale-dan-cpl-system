import { relations } from "drizzle-orm/relations";
import { users, quotations, quotationItems, cplProducts } from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  quotations: many(quotations),
}));

export const quotationsRelations = relations(quotations, ({ one, many }) => ({
  creator: one(users, { fields: [quotations.createdBy], references: [users.id] }),
  items: many(quotationItems),
}));

export const quotationItemsRelations = relations(quotationItems, ({ one }) => ({
  quotation: one(quotations, { fields: [quotationItems.quotationId], references: [quotations.id] }),
  product: one(cplProducts, { fields: [quotationItems.productId], references: [cplProducts.id] }),
}));
