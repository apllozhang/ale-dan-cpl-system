import { describe, it, expect } from "vitest";
import { computeItemDiff, buildChangeSummary } from "../quotation.versioning";

describe("quotation.versioning", () => {
  describe("computeItemDiff", () => {
    it("detects added items", () => {
      const oldItems = [{ productModel: "A", quantity: 1, discountRate: 0 }];
      const newItems = [
        { productModel: "A", quantity: 1, discountRate: 0 },
        { productModel: "B", quantity: 2, discountRate: 10 },
      ];
      const diff = computeItemDiff(oldItems, newItems);
      expect(diff.added).toEqual(["B"]);
      expect(diff.removed).toEqual([]);
      expect(diff.modified).toEqual([]);
    });

    it("detects removed items", () => {
      const oldItems = [
        { productModel: "A", quantity: 1, discountRate: 0 },
        { productModel: "B", quantity: 2, discountRate: 10 },
      ];
      const newItems = [{ productModel: "A", quantity: 1, discountRate: 0 }];
      const diff = computeItemDiff(oldItems, newItems);
      expect(diff.added).toEqual([]);
      expect(diff.removed).toEqual(["B"]);
      expect(diff.modified).toEqual([]);
    });

    it("detects modified items (quantity change)", () => {
      const oldItems = [{ productModel: "A", quantity: 1, discountRate: 0 }];
      const newItems = [{ productModel: "A", quantity: 5, discountRate: 0 }];
      const diff = computeItemDiff(oldItems, newItems);
      expect(diff.modified).toEqual(["A"]);
    });

    it("detects modified items (discount change)", () => {
      const oldItems = [{ productModel: "A", quantity: 1, discountRate: 0 }];
      const newItems = [{ productModel: "A", quantity: 1, discountRate: 20 }];
      const diff = computeItemDiff(oldItems, newItems);
      expect(diff.modified).toEqual(["A"]);
    });

    it("handles empty arrays", () => {
      const diff = computeItemDiff([], []);
      expect(diff).toEqual({ added: [], removed: [], modified: [] });
    });

    it("handles string quantities", () => {
      const oldItems = [{ productModel: "A", quantity: "1", discountRate: "0" }];
      const newItems = [{ productModel: "A", quantity: "5", discountRate: "0" }];
      const diff = computeItemDiff(oldItems, newItems);
      expect(diff.modified).toEqual(["A"]);
    });
  });

  describe("buildChangeSummary", () => {
    it("generates summary for item changes", () => {
      const oldData = { customerName: "Old", projectName: "Old Project", status: "draft" };
      const newData = { customerName: "Old", projectName: "Old Project", status: "draft" };
      const itemDiff = { added: ["B"], removed: ["C"], modified: ["A"] };
      const summary = buildChangeSummary(oldData, newData, itemDiff);
      expect(summary).toContain("+1项: B");
      expect(summary).toContain("-1项: C");
      expect(summary).toContain("改1项: A");
    });

    it("generates summary for field changes", () => {
      const oldData = { customerName: "Old", projectName: "Old Project", status: "draft" };
      const newData = { customerName: "New", projectName: "Old Project", status: "draft" };
      const itemDiff = { added: [], removed: [], modified: [] };
      const summary = buildChangeSummary(oldData, newData, itemDiff);
      expect(summary).toContain("客户名称变更");
    });

    it("generates summary for status change", () => {
      const oldData = { customerName: "A", projectName: "B", status: "draft" };
      const newData = { customerName: "A", projectName: "B", status: "submitted" };
      const itemDiff = { added: [], removed: [], modified: [] };
      const summary = buildChangeSummary(oldData, newData, itemDiff);
      expect(summary).toContain("状态→submitted");
    });

    it("returns '信息更新' when no changes", () => {
      const oldData = { customerName: "A", projectName: "B", status: "draft" };
      const newData = { customerName: "A", projectName: "B", status: "draft" };
      const itemDiff = { added: [], removed: [], modified: [] };
      const summary = buildChangeSummary(oldData, newData, itemDiff);
      expect(summary).toBe("信息更新");
    });

    it("truncates long lists with ...", () => {
      const added = ["A", "B", "C", "D", "E"];
      const itemDiff = { added, removed: [], modified: [] };
      const summary = buildChangeSummary(
        { customerName: "X", projectName: "Y", status: "draft" },
        { customerName: "X", projectName: "Y", status: "draft" },
        itemDiff,
      );
      expect(summary).toContain("A, B, C...");
    });
  });
});
