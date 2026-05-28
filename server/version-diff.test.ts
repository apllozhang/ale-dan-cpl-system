import { describe, it, expect } from "vitest";

describe("Quotation version diff", () => {
  function computeDiff(oldItems: any[], newItems: any[]) {
    const oldItemMap = new Map(oldItems.map((it: any) => [it.productModel, it]));
    const added: string[] = [];
    const removed: string[] = [];
    const modified: string[] = [];

    for (const ni of newItems) {
      const oi = oldItemMap.get(ni.productModel);
      if (!oi) {
        added.push(ni.productModel);
      } else {
        if (Number(oi.quantity) !== ni.quantity || Number(oi.discountRate ?? 0) !== Number(ni.discountRate ?? 0)) {
          modified.push(ni.productModel);
        }
      }
    }
    const newItemSet = new Set(newItems.map((it: any) => it.productModel));
    for (const oi of oldItems) {
      if (!newItemSet.has(oi.productModel)) removed.push(oi.productModel);
    }

    return { added, removed, modified };
  }

  it("detects new items", () => {
    const old = [{ productModel: "A", quantity: 1, discountRate: "100" }];
    const now = [
      { productModel: "A", quantity: 1, discountRate: "100" },
      { productModel: "B", quantity: 2, discountRate: "50" },
    ];
    const diff = computeDiff(old, now);
    expect(diff.added).toEqual(["B"]);
    expect(diff.removed).toEqual([]);
    expect(diff.modified).toEqual([]);
  });

  it("detects removed items", () => {
    const old = [
      { productModel: "A", quantity: 1, discountRate: "100" },
      { productModel: "B", quantity: 2, discountRate: "50" },
    ];
    const now = [{ productModel: "A", quantity: 1, discountRate: "100" }];
    const diff = computeDiff(old, now);
    expect(diff.removed).toEqual(["B"]);
    expect(diff.added).toEqual([]);
  });

  it("detects quantity changes", () => {
    const old = [{ productModel: "A", quantity: 1, discountRate: "100" }];
    const now = [{ productModel: "A", quantity: 5, discountRate: "100" }];
    const diff = computeDiff(old, now);
    expect(diff.modified).toEqual(["A"]);
  });

  it("detects discountRate changes with type mismatch (0.00 vs 0)", () => {
    const old = [{ productModel: "A", quantity: 1, discountRate: "0.00" }];
    const now = [{ productModel: "A", quantity: 1, discountRate: 0 }];
    const diff = computeDiff(old, now);
    expect(diff.modified).toEqual([]);
  });

  it("detects discountRate changes with string vs number", () => {
    const old = [{ productModel: "A", quantity: 1, discountRate: "50" }];
    const now = [{ productModel: "A", quantity: 1, discountRate: 75 }];
    const diff = computeDiff(old, now);
    expect(diff.modified).toEqual(["A"]);
  });

  it("no changes when items are identical", () => {
    const items = [{ productModel: "A", quantity: 3, discountRate: "80" }];
    const diff = computeDiff(items, items);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.modified).toEqual([]);
  });

  it("handles undefined discountRate as 0", () => {
    const old = [{ productModel: "A", quantity: 1 }];
    const now = [{ productModel: "A", quantity: 1, discountRate: "0" }];
    const diff = computeDiff(old, now);
    expect(diff.modified).toEqual([]);
  });

  it("detects multiple mixed changes", () => {
    const old = [
      { productModel: "A", quantity: 1, discountRate: "100" },
      { productModel: "B", quantity: 2, discountRate: "50" },
      { productModel: "C", quantity: 3, discountRate: "80" },
    ];
    const now = [
      { productModel: "A", quantity: 5, discountRate: "100" },
      { productModel: "B", quantity: 2, discountRate: "50" },
      { productModel: "D", quantity: 1, discountRate: "100" },
    ];
    const diff = computeDiff(old, now);
    expect(diff.added).toEqual(["D"]);
    expect(diff.removed).toEqual(["C"]);
    expect(diff.modified).toEqual(["A"]);
  });
});
