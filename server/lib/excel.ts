// server/lib/excel.ts
/**
 * Excel parsing utilities for CPL import.
 * Extracted from server/routers/cpl.ts to eliminate worker → router dependency.
 */

import * as XLSX from "xlsx";
import type { InsertCplProduct } from "../../drizzle/schema";

// Column name mapping for various sheet formats
export const COLUMN_MAP: Record<string, string> = {
  "产品组件": "productGroup",
  "OmniVista 2500 Partner Support Software": "productGroup",
  "税务小类": "taxCategory",
  "线缆": "taxCategory",
  "类别": "taxCategory",
  "产品型号": "productModel",
  "型号": "productModel",
  "产品说明": "productDesc",
  "描述": "productDesc",
  "销售类别": "salesCategory",
  "服务类别": "serviceCategory",
  "产品状态": "productStatus",
  "服务状态": "productStatus",
  "状态": "productStatus",
  "媒体价": "listPrice",
  "价格说明": "priceNote",
  "新品": "isNew",
  "备注": "remark",
  "注释": "remark",
  "子类别": "serviceCategory",
  // English column names
  "Section": "productGroup",
  "Model No": "productModel",
  "Model Description": "productDesc",
  "Sales Category": "salesCategory",
  "Service Category": "serviceCategory",
  "Availability": "productStatus",
  "List Price": "listPrice",
  "Price Description": "priceNote",
  "NEW": "isNew",
  "Comment": "remark",
};

export function parseExcelBuffer(buffer: Buffer, selectedSheets?: string[]): {
  products: InsertCplProduct[];
  sheetMeta: { sheetName: string; displayOrder: number; productCount: number }[];
  summaryContent: string;
} {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetsToSkip = ["Summary", "LBS场景化报价模型"];
  const products: InsertCplProduct[] = [];
  const sheetMeta: { sheetName: string; displayOrder: number; productCount: number }[] = [];

  // Parse Summary sheet
  let summaryContent = "";
  if (workbook.SheetNames.includes("Summary")) {
    const ws = workbook.Sheets["Summary"];
    const data: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const lines: string[] = [];
    for (const row of data) {
      if (Array.isArray(row)) {
        const text = row.filter((c) => c !== null && c !== undefined && c !== "").join(" ").trim();
        if (text) lines.push(text);
      }
    }
    summaryContent = lines.join("\n");
  }

  // Parse product sheets
  let order = 0;
  for (const sheetName of workbook.SheetNames) {
    if (sheetsToSkip.includes(sheetName)) continue;
    if (selectedSheets && !selectedSheets.includes(sheetName)) continue;
    const trimmedName = sheetName.trim();
    const ws = workbook.Sheets[sheetName];
    const rows: Record<string, string | number | boolean | null | undefined>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

    let count = 0;
    for (const row of rows) {
      const mapped: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        const mappedKey = COLUMN_MAP[key.trim()];
        if (mappedKey) {
          mapped[mappedKey] = value != null ? String(value).trim() : "";
        }
      }
      // Skip empty rows
      if (!mapped.productModel && !mapped.productDesc && !mapped.productGroup) continue;

      products.push({
        sheetName: trimmedName,
        productGroup: mapped.productGroup || "",
        taxCategory: mapped.taxCategory || "",
        productModel: mapped.productModel || "",
        productDesc: mapped.productDesc || "",
        salesCategory: mapped.salesCategory || "",
        serviceCategory: mapped.serviceCategory || "",
        productStatus: mapped.productStatus || "",
        listPrice: mapped.listPrice || "",
        priceNote: mapped.priceNote || "",
        isNew: mapped.isNew || "",
        remark: mapped.remark || "",
      } as InsertCplProduct);
      count++;
    }

    sheetMeta.push({ sheetName: trimmedName, displayOrder: order++, productCount: count });
  }

  return { products, sheetMeta, summaryContent };
}
