/** Round to 2 decimal places */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Discount subtotal: unitPrice * quantity * (discountRate / 100) */
export function calculateSubtotal(unitPrice: number, quantity: number, discountRate: number): number {
  return roundMoney(unitPrice * quantity * (discountRate / 100));
}

/** Sum total amount from items with mixed numeric/string subtotals */
export function calculateTotalAmount(items: Array<{ subtotal: number | string }>): number {
  return roundMoney(
    items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0)
  );
}
