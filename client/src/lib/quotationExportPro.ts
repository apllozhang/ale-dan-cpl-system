import * as XLSX from "xlsx";
import { toast } from "sonner";

/**
 * Professional quotation export with ALE branding and proper formatting
 */
export async function exportQuotationToExcelPro(quotation: any, items: any[]) {
  const wb = XLSX.utils.book_new();

  // Create worksheet with proper initialization
  const ws: any = {};

  // Set column widths (in characters)
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

  // Set default row height
  const rows: any[] = [];
  const merges: any[] = [];

  let rowIndex = 0;

  // Row 1-2: Empty rows for logo space
  ws[`A${rowIndex + 1}`] = { t: "s", v: "" };
  ws[`A${rowIndex + 2}`] = { t: "s", v: "" };
  rowIndex += 2;

  // Row 3: Title - 报价单
  const titleCell = `A${rowIndex + 1}`;
  ws[titleCell] = { t: "s", v: "DAN 产品报价单" };
  merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: 7 } });
  
  // Format title cell
  ws[titleCell].s = {
    font: { name: "黑体", sz: 20, bold: true, color: { rgb: "FF1F1F1F" } },
    alignment: { horizontal: "left", vertical: "center", wrapText: true },
    fill: { fgColor: { rgb: "FFFFFFFF" } },
  };
  rows[rowIndex] = { hpx: 40 };
  rowIndex++;

  // Row 4: Empty
  rowIndex++;

  // Row 5: Customer Info Header
  const infoHeaderRow = rowIndex;
  ws[`A${rowIndex + 1}`] = { t: "s", v: "客户信息", s: { font: { name: "黑体", sz: 11, bold: true } } };
  rows[rowIndex] = { hpx: 22 };
  rowIndex++;

  // Row 6: Customer Details - Line 1
  const details1Row = rowIndex;
  ws[`A${rowIndex + 1}`] = { t: "s", v: "报价编号" };
  ws[`B${rowIndex + 1}`] = { t: "s", v: quotation.quotationNo || "" };
  ws[`D${rowIndex + 1}`] = { t: "s", v: "客户名称" };
  ws[`E${rowIndex + 1}`] = { t: "s", v: quotation.customerName || "" };
  rows[rowIndex] = { hpx: 22 };
  rowIndex++;

  // Row 7: Customer Details - Line 2
  ws[`A${rowIndex + 1}`] = { t: "s", v: "项目名称" };
  ws[`B${rowIndex + 1}`] = { t: "s", v: quotation.projectName || "" };
  ws[`D${rowIndex + 1}`] = { t: "s", v: "联系人" };
  ws[`E${rowIndex + 1}`] = { t: "s", v: quotation.customerContact || "" };
  rows[rowIndex] = { hpx: 22 };
  rowIndex++;

  // Row 8: Customer Details - Line 3
  ws[`A${rowIndex + 1}`] = { t: "s", v: "电话" };
  ws[`B${rowIndex + 1}`] = { t: "s", v: quotation.customerPhone || "" };
  ws[`D${rowIndex + 1}`] = { t: "s", v: "邮箱" };
  ws[`E${rowIndex + 1}`] = { t: "s", v: quotation.customerEmail || "" };
  rows[rowIndex] = { hpx: 22 };
  rowIndex++;

  // Row 9: Customer Details - Line 4
  ws[`A${rowIndex + 1}`] = { t: "s", v: "创建日期" };
  ws[`B${rowIndex + 1}`] = { t: "s", v: quotation.createdAt ? new Date(quotation.createdAt).toLocaleDateString("zh-CN") : "" };
  ws[`D${rowIndex + 1}`] = { t: "s", v: "有效期" };
  ws[`E${rowIndex + 1}`] = { t: "s", v: quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString("zh-CN") : "" };
  rows[rowIndex] = { hpx: 22 };
  rowIndex++;

  // Row 10: Empty
  rowIndex++;

  // Row 11: Product Details Header
  const headerRow = rowIndex;
  const headers = ["序号", "产品型号", "产品说明", "单价(¥)", "数量", "折扣率(%)", "小计(¥)", "媒体价(¥)"];
  headers.forEach((header, colIndex) => {
    const cellRef = XLSX.utils.encode_col(colIndex) + (rowIndex + 1);
    ws[cellRef] = { t: "s", v: header };
    ws[cellRef].s = {
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
  });  rows[headerRow] = { hpx: 40 };
  rowIndex++;

  // Rows 12+: Product items
  let total = 0;
  items.forEach((item, idx) => {
    const listPrice = parseFloat(item.listPrice) || 0;
    const discount = Number(item.discountRate) || 0;
    const unitPrice = listPrice * (1 - discount / 100);
    const qty = item.quantity || 1;
    const subtotal = unitPrice * qty;
    total += subtotal;

    const dataRow = rowIndex;
    const rowData = [
      idx + 1,
      item.productModel || "",
      item.productDesc || "",
      unitPrice.toFixed(2),
      qty,
      discount,
      subtotal.toFixed(2),
      listPrice ? listPrice.toFixed(2) : "",
    ];

    rowData.forEach((value, colIndex) => {
      const cellRef = XLSX.utils.encode_col(colIndex) + (rowIndex + 1);
      const isNumericCol = colIndex >= 3; // Columns D onwards are numeric

      ws[cellRef] = {
        t: isNumericCol ? "n" : "s",
        v: value,
      };

      // Apply cell styling
      ws[cellRef].s = {
        font: { name: colIndex >= 3 ? "Trebuchet MS" : "黑体", sz: 10 },
        alignment: {
          horizontal: isNumericCol ? "right" : "left",
          vertical: "center",
          wrapText: colIndex === 2, // Wrap text in product description
        },
        border: {
          top: { style: "thin", color: { rgb: "FFE0E0E0" } },
          bottom: { style: "thin", color: { rgb: "FFE0E0E0" } },
          left: { style: "thin", color: { rgb: "FFE0E0E0" } },
          right: { style: "thin", color: { rgb: "FFE0E0E0" } },
        },
        fill: idx % 2 === 0 ? { fgColor: { rgb: "FFFAFAFA" } } : { fgColor: { rgb: "FFFFFFFF" } },
      };
    });

    rows[rowIndex] = { hpx: 22 };
    rowIndex++;
  });

  // Empty row before total
  rowIndex++;

  // Total row
  ws[`A${rowIndex + 1}`] = { t: "s", v: "合计" };
  ws[`G${rowIndex + 1}`] = { t: "n", v: total.toFixed(2) };
  
  // Format total cells
  ["A", "G"].forEach((col) => {
    const cellRef = col + (rowIndex + 1);
    ws[cellRef].s = {
      font: { name: col === "G" ? "Trebuchet MS" : "黑体", sz: 11, bold: true, color: { rgb: "FF1F1F1F" } },
      alignment: { horizontal: col === "G" ? "right" : "left", vertical: "center" },
      fill: { fgColor: { rgb: "FFECFDF5" } },
      border: {
        top: { style: "medium", color: { rgb: "FF7C3AED" } },
        bottom: { style: "medium", color: { rgb: "FF7C3AED" } },
      },
      numFmt: col === "G" ? "¥#,##0.00" : undefined,
    };
  });

  rows[rowIndex] = { hpx: 28 };
  rowIndex++;

  // Empty row
  rowIndex++;

  // Notes section (if exists)
  if (quotation.notes) {
    ws[`A${rowIndex + 1}`] = { t: "s", v: "备注" };
    ws[`B${rowIndex + 1}`] = { t: "s", v: quotation.notes };
    merges.push({ s: { r: rowIndex, c: 1 }, e: { r: rowIndex, c: 7 } });
    ws[`B${rowIndex + 1}`].s = {
      font: { name: "黑体", sz: 10 },
      alignment: { horizontal: "left", vertical: "top", wrapText: true },
    };
    rows[rowIndex] = { hpx: 22 };
    rowIndex++;
  }

  // Apply rows and merges
  ws["!rows"] = rows;
  ws["!merges"] = merges;

  // Freeze panes (freeze header row)
  ws["!freeze"] = { xSplit: 0, ySplit: 11 }; // Freeze rows 1-11

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
