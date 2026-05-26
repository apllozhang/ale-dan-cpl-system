import * as XLSX from "xlsx";
import { toast } from "sonner";

export async function exportQuotationToExcel(quotation: any, items: any[]) {
  const wb = XLSX.utils.book_new();

  const rows: any[][] = [];

  // Title
  rows.push(["DAN 报价单"]);
  rows.push([]);
  rows.push(["报价编号", quotation.quotationNo || "", "", "客户名称", quotation.customerName || ""]);
  rows.push(["项目名称", quotation.projectName || "", "", "联系人", quotation.customerContact || ""]);
  rows.push(["电话", quotation.customerPhone || "", "", "邮箱", quotation.customerEmail || ""]);
  rows.push(["创建日期", quotation.createdAt ? new Date(quotation.createdAt).toLocaleDateString("zh-CN") : "", "", "有效期", quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString("zh-CN") : ""]);
  rows.push([]);

  // Items header: 序号 | 产品型号 | 产品说明 | 单价 | 数量 | 折扣率(%) | 小计(¥) | 媒体价(¥)
  rows.push(["序号", "产品型号", "产品说明", "单价(¥)", "数量", "折扣率(%)", "小计(¥)", "媒体价(¥)"]);

  // Items
  let total = 0;
  items.forEach((item, idx) => {
    const listPrice = parseFloat(item.listPrice) || 0;
    const discount = Number(item.discountRate) || 0;
    const unitPrice = listPrice * (1 - discount / 100);
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
      `¥${subtotal.toFixed(2)}`,
      listPrice ? `¥${listPrice.toFixed(2)}` : "",
    ]);
  });

  // Total row
  rows.push([]);
  rows.push(["", "", "", "", "", "", `合计：¥${total.toFixed(2)}`]);

  if (quotation.notes) {
    rows.push([]);
    rows.push(["备注", quotation.notes]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  ws["!cols"] = [
    { wch: 8 },   // 序号
    { wch: 25 },  // 产品型号
    { wch: 40 },  // 产品说明
    { wch: 14 },  // 单价(¥)
    { wch: 8 },   // 数量
    { wch: 10 },  // 折扣率
    { wch: 14 },  // 小计(¥)
    { wch: 14 },  // 媒体价(¥)
  ];

  // Merge title cell
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];

  XLSX.utils.book_append_sheet(wb, ws, "报价单");

  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `报价单_${quotation.quotationNo || "new"}_${dateStr}.xlsx`;

  // Try to use File System Access API if available (Chrome, Edge)
  if ("showSaveFilePicker" in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: "Excel Files",
            accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
          },
        ],
      });

      const writable = await handle.createWritable();
      const blob = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      await writable.write(blob);
      await writable.close();

      toast.success("报价单已保存");
      return;
    } catch (err: any) {
      // User cancelled or error occurred, fall back to direct download
      if (err.name !== "AbortError") {
        console.error("File save error:", err);
      }
    }
  }

  // Fallback: Direct download (for browsers that don't support File System Access API)
  XLSX.writeFile(wb, fileName);
  toast.success("报价单已下载");
}
