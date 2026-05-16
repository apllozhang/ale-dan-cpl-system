import * as XLSX from "xlsx";

export function exportQuotationToExcel(quotation: any, items: any[]) {
  const wb = XLSX.utils.book_new();

  const rows: any[][] = [];

  // Title
  rows.push(["ALE 报价单"]);
  rows.push([]);
  rows.push(["报价编号", quotation.quotationNo || "", "", "客户名称", quotation.customerName || ""]);
  rows.push(["项目名称", quotation.projectName || "", "", "联系人", quotation.customerContact || ""]);
  rows.push(["电话", quotation.customerPhone || "", "", "邮箱", quotation.customerEmail || ""]);
  rows.push(["创建日期", quotation.createdAt ? new Date(quotation.createdAt).toLocaleDateString("zh-CN") : "", "", "有效期", quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString("zh-CN") : ""]);
  rows.push([]);

  // Items header
  rows.push(["序号", "产品型号", "产品说明", "媒体价", "数量", "单价", "折扣率(%)", "小计"]);

  // Items
  let total = 0;
  items.forEach((item, idx) => {
    const subtotal = parseFloat(item.subtotal || "0");
    total += subtotal;
    rows.push([
      idx + 1,
      item.productModel || "",
      item.productDesc || "",
      item.listPrice || "",
      item.quantity || 0,
      item.unitPrice || "",
      item.discountRate || "0",
      subtotal.toFixed(2),
    ]);
  });

  // Total row
  rows.push([]);
  rows.push(["", "", "", "", "", "", "合计", total.toFixed(2)]);

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
    { wch: 12 },  // 媒体价
    { wch: 8 },   // 数量
    { wch: 12 },  // 单价
    { wch: 10 },  // 折扣率
    { wch: 14 },  // 小计
  ];

  // Merge title cell
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];

  XLSX.utils.book_append_sheet(wb, ws, "报价单");

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `报价单_${quotation.quotationNo || "new"}_${dateStr}.xlsx`);
}
