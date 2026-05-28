import * as XLSX from "xlsx";
import { toast } from "sonner";

/**
 * Professional quotation export with ALE branding and proper formatting
 */
export async function exportQuotationToExcelPro(quotation: any, items: any[]) {
  const wb = XLSX.utils.book_new();

  // Build data array for AOA (Array of Arrays)
  const rows: any[][] = [];

  // Row 1-2: Empty rows for logo space
  rows.push([]);
  rows.push([]);

  // Row 3: Title - 报价单
  rows.push(["DAN 产品报价单"]);

  // Row 4: Empty
  rows.push([]);

  // Row 5: Customer Info Header
  rows.push(["客户信息"]);

  // Row 6: Customer Details - Line 1
  rows.push([
    "报价编号",
    quotation.quotationNo || "",
    "",
    "客户名称",
    quotation.customerName || "",
  ]);

  // Row 7: Customer Details - Line 2
  rows.push([
    "项目名称",
    quotation.projectName || "",
    "",
    "联系人",
    quotation.customerContact || "",
  ]);

  // Row 8: Customer Details - Line 3
  rows.push([
    "电话",
    quotation.customerPhone || "",
    "",
    "邮箱",
    quotation.customerEmail || "",
  ]);

  // Row 9: Customer Details - Line 4
  rows.push([
    "创建日期",
    quotation.createdAt ? new Date(quotation.createdAt).toLocaleDateString("zh-CN") : "",
    "",
    "有效期",
    quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString("zh-CN") : "",
  ]);

  // Row 10: Empty
  rows.push([]);

  // Row 11: Product Details Header
  rows.push([
    "序号",
    "产品型号",
    "产品说明",
    "单价(¥)",
    "数量",
    "折扣率(%)",
    "小计(¥)",
    "媒体价(¥)",
  ]);

  // Rows 12+: Product items
  let total = 0;
  items.forEach((item, idx) => {
    const listPrice = parseFloat(item.listPrice) || 0;
    const discount = Number(item.discountRate) || 0;
    const unitPrice = listPrice * (discount / 100);
    const qty = item.quantity || 1;
    const subtotal = unitPrice * qty;
    total += subtotal;

    rows.push([
      idx + 1,
      item.productModel || "",
      item.productDesc || "",
      unitPrice.toFixed(2),
      qty,
      discount,
      subtotal.toFixed(2),
      listPrice ? listPrice.toFixed(2) : "",
    ]);
  });

  // Empty row before total
  rows.push([]);

  // Total row
  rows.push([
    "合计",
    "",
    "",
    "",
    "",
    "",
    total.toFixed(2),
    "",
  ]);

  // Empty row
  rows.push([]);

  // Notes section (if exists)
  if (quotation.notes) {
    rows.push(["备注", quotation.notes]);
  }

  // Create worksheet from AOA (this ensures !ref is set correctly)
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  ws["!cols"] = [
    { wch: 3 },    // A - 序号
    { wch: 20 },   // B - 产品型号
    { wch: 45 },   // C - 产品说明
    { wch: 15 },   // D - 单价(¥)
    { wch: 8 },    // E - 数量
    { wch: 12 },   // F - 折扣率(%)
    { wch: 15 },   // G - 小计(¥)
    { wch: 15 },   // H - 媒体价(¥)
  ];

  // Apply formatting to specific cells
  // Title row (row 3)
  const titleCell = ws["A3"];
  if (titleCell) {
    titleCell.s = {
      font: { name: "黑体", sz: 20, bold: true, color: { rgb: "FF1F1F1F" } },
      alignment: { horizontal: "left", vertical: "center", wrapText: true },
    };
  }

  // Customer Info Header (row 5)
  const infoHeaderCell = ws["A5"];
  if (infoHeaderCell) {
    infoHeaderCell.s = {
      font: { name: "黑体", sz: 11, bold: true },
      alignment: { horizontal: "left", vertical: "center" },
    };
  }

  // Product header row (row 11)
  const headerRowStart = 11;
  for (let col = 0; col < 8; col++) {
    const cellRef = XLSX.utils.encode_col(col) + headerRowStart;
    const cell = ws[cellRef];
    if (cell) {
      cell.s = {
        font: { name: "黑体", sz: 11, bold: true, color: { rgb: "FFFFFFFF" } },
        alignment: { horizontal: "center", vertical: "center" },
        fill: { fgColor: { rgb: "FF7C3AED" } }, // Purple background
        border: {
          top: { style: "thin", color: { rgb: "FF7C3AED" } },
          bottom: { style: "thin", color: { rgb: "FF7C3AED" } },
          left: { style: "thin", color: { rgb: "FF7C3AED" } },
          right: { style: "thin", color: { rgb: "FF7C3AED" } },
        },
      };
    }
  }

  // Product data rows (rows 12 to 12+items.length-1)
  const dataRowStart = 12;
  items.forEach((item, idx) => {
    const rowNum = dataRowStart + idx;
    for (let col = 0; col < 8; col++) {
      const cellRef = XLSX.utils.encode_col(col) + rowNum;
      const cell = ws[cellRef];
      if (cell) {
        const isNumericCol = col >= 3;
        cell.s = {
          font: { name: col >= 3 ? "Trebuchet MS" : "黑体", sz: 10 },
          alignment: {
            horizontal: isNumericCol ? "right" : "left",
            vertical: "center",
            wrapText: col === 2,
          },
          border: {
            top: { style: "thin", color: { rgb: "FFE0E0E0" } },
            bottom: { style: "thin", color: { rgb: "FFE0E0E0" } },
            left: { style: "thin", color: { rgb: "FFE0E0E0" } },
            right: { style: "thin", color: { rgb: "FFE0E0E0" } },
          },
          fill: idx % 2 === 0 ? { fgColor: { rgb: "FFFAFAFA" } } : { fgColor: { rgb: "FFFFFFFF" } },
        };
      }
    }
  });

  // Total row formatting
  const totalRowNum = dataRowStart + items.length + 1;
  const totalCell = ws[`A${totalRowNum}`];
  const totalValueCell = ws[`G${totalRowNum}`];
  if (totalCell) {
    totalCell.s = {
      font: { name: "黑体", sz: 11, bold: true, color: { rgb: "FF1F1F1F" } },
      alignment: { horizontal: "left", vertical: "center" },
      fill: { fgColor: { rgb: "FFECFDF5" } },
      border: {
        top: { style: "medium", color: { rgb: "FF7C3AED" } },
        bottom: { style: "medium", color: { rgb: "FF7C3AED" } },
      },
    };
  }
  if (totalValueCell) {
    totalValueCell.s = {
      font: { name: "Trebuchet MS", sz: 11, bold: true, color: { rgb: "FF1F1F1F" } },
      alignment: { horizontal: "right", vertical: "center" },
      fill: { fgColor: { rgb: "FFECFDF5" } },
      border: {
        top: { style: "medium", color: { rgb: "FF7C3AED" } },
        bottom: { style: "medium", color: { rgb: "FF7C3AED" } },
      },
      numFmt: "¥#,##0.00",
    };
  }

  // Freeze panes
  ws["!freeze"] = { xSplit: 0, ySplit: 11 };

  XLSX.utils.book_append_sheet(wb, ws, "报价单");

  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `DAN_报价单_${quotation.quotationNo || "new"}_${dateStr}.xlsx`;

  try {
    // Try to use File System Access API for file save dialog
    if ("showSaveFilePicker" in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: "Excel Files", accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] } }],
        });
        const writable = await handle.createWritable();
        const blob = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        await writable.write(new Blob([blob], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
        await writable.close();
        toast.success("报价单已导出");
      } catch (err: any) {
        // User cancelled or error occurred, fallback to direct download
        if (err.name !== "AbortError") {
          XLSX.writeFile(wb, fileName);
          toast.success("报价单已导出");
        }
      }
    } else {
      // Fallback for browsers that don't support File System Access API
      XLSX.writeFile(wb, fileName);
      toast.success("报价单已导出");
    }
  } catch (err) {
    console.error("Export error:", err);
    toast.error("导出失败，请重试");
  }
}
