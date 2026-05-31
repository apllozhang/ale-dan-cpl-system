import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { saveBlobWithPicker } from "./saveFile";
import type { SpecQuotationInfo, MatchedSpecItem, UnmatchedSpecItem } from "@shared/types";

const COLOR_HEADER_BG: [number, number, number] = [75, 0, 130];
const COLOR_HEADER_FG: [number, number, number] = [255, 255, 255];
const COLOR_TITLE: [number, number, number] = [27, 0, 51];
const COLOR_TOTAL_BG: [number, number, number] = [232, 224, 240];
const COLOR_ROW_ALT: [number, number, number] = [245, 245, 245];
const COLOR_BORDER: [number, number, number] = [176, 176, 176];
const COLOR_LABEL_BG: [number, number, number] = [237, 237, 237];

export async function exportQuotationToPdf(quotation: SpecQuotationInfo, items: SpecQuotationInfo["items"]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Title
  doc.setFontSize(18);
  doc.setTextColor(...COLOR_TITLE);
  doc.text("ALE DAN 报价单", pageWidth / 2, 18, { align: "center" });

  // Subtitle
  doc.setFontSize(8);
  doc.setTextColor(136, 136, 136);
  doc.text("ALCATEL-LUCENT ENTERPRISE · DAN SOLUTION QUOTATION", pageWidth / 2, 24, { align: "center" });

  // Customer info table
  const infoRows = [
    ["报价编号", quotation.quotationNo || "", "客户名称", quotation.customerName || ""],
    ["项目名称", quotation.projectName || "", "联系电话", quotation.customerPhone || ""],
    ["报价日期", quotation.createdAt ? new Date(quotation.createdAt).toLocaleDateString("zh-CN") : "", "报价有效期", quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString("zh-CN") : ""],
  ];

  autoTable(doc, {
    startY: 28,
    body: infoRows.map(row => [
      { content: row[0], styles: { fillColor: COLOR_LABEL_BG, fontStyle: "bold" as const, halign: "center" as const, fontSize: 9 } },
      { content: row[1], styles: { halign: "center" as const, fontSize: 9 } },
      { content: row[2], styles: { fillColor: COLOR_LABEL_BG, fontStyle: "bold" as const, halign: "center" as const, fontSize: 9 } },
      { content: row[3], styles: { halign: "center" as const, fontSize: 9 } },
    ]),
    theme: "grid",
    styles: { cellPadding: 3, lineColor: COLOR_BORDER, lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 60 },
      2: { cellWidth: 25 },
      3: { cellWidth: 60 },
    },
    margin: { left: margin, right: margin },
  });

  // Main data table
  const headers = ["序号", "产品型号", "产品说明", "单价(¥)", "数量", "小计(¥)", "媒体价(¥)", "折扣率(%)"];

  let total = 0;
  const body = items.map((item, idx) => {
    const listPrice = parseFloat(item.listPrice ?? "0") || 0;
    const discount = Number(item.discountRate) || 0;
    const unitPrice = listPrice * (discount / 100);
    const qty = item.quantity || 1;
    const subtotal = unitPrice * qty;
    total += subtotal;

    return [
      String(idx + 1),
      item.productModel || "",
      item.productDesc || "",
      `¥${unitPrice.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`,
      String(qty),
      `¥${subtotal.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`,
      `¥${listPrice.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`,
      discount > 0 ? `${discount}%` : "-",
    ];
  });

  // Total row
  body.push([
    "", "合  计", "", "", "", `¥${total.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`, "", "",
  ]);

  const lastInfoY = (doc as any).lastAutoTable?.finalY || 45;

  autoTable(doc, {
    startY: lastInfoY + 4,
    head: [headers],
    body,
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 3,
      lineColor: COLOR_BORDER,
      lineWidth: 0.2,
      halign: "center",
      valign: "middle",
    },
    headStyles: {
      fillColor: COLOR_HEADER_BG,
      textColor: COLOR_HEADER_FG,
      fontStyle: "bold",
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: COLOR_ROW_ALT,
    },
    columnStyles: {
      0: { cellWidth: 12 },   // 序号
      1: { cellWidth: 50, halign: "left" },   // 产品型号
      2: { cellWidth: 70, halign: "left" },   // 产品说明
      3: { cellWidth: 25 },   // 单价
      4: { cellWidth: 14 },   // 数量
      5: { cellWidth: 25 },   // 小计
      6: { cellWidth: 25 },   // 媒体价
      7: { cellWidth: 20 },   // 折扣率
    },
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      // Style total row
      if (data.row.index === body.length - 1) {
        data.cell.styles.fillColor = COLOR_TOTAL_BG;
        data.cell.styles.fontStyle = "bold";
        if (data.column.index === 5) {
          data.cell.styles.textColor = COLOR_HEADER_BG;
        }
      }
    },
  });

  // Footer
  let footerY = (doc as any).lastAutoTable?.finalY + 6 || 100;

  // Notes
  if (quotation.notes) {
    doc.setFontSize(8);
    doc.setTextColor(102, 102, 102);
    doc.text(`备注：${quotation.notes}`, pageWidth / 2, footerY, { align: "center", maxWidth: pageWidth - margin * 2 });
    footerY += 8;
  }

  // Validity
  if (quotation.validUntil) {
    doc.setFontSize(7);
    doc.setTextColor(204, 102, 0);
    doc.text(`本报价单有效期至 ${quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString("zh-CN") : ""}`, pageWidth / 2, footerY, { align: "center" });
    footerY += 6;
  }

  // Disclaimer
  doc.setFontSize(7);
  doc.setTextColor(153, 153, 153);
  doc.text("本报价仅为参考价格，最终价格以双方签订合同为准。", pageWidth / 2, footerY, { align: "center" });
  footerY += 5;
  doc.text(`Generated by ALE DAN CPL System · ${new Date().toLocaleDateString("zh-CN")}`, pageWidth / 2, footerY, { align: "center" });
  footerY += 4;
  doc.text("Digital Age Networking · https://www.extremecloudiq.cn/", pageWidth / 2, footerY, { align: "center" });

  // Save
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `报价单_${quotation.quotationNo || "new"}_${dateStr}.pdf`;
  const blob = doc.output("blob");
  await saveBlobWithPicker(blob, fileName, "application/pdf");
}

export async function exportSpecTableToPdf(params: {
  quotation: SpecQuotationInfo;
  matched: MatchedSpecItem[];
  unmatched: UnmatchedSpecItem[];
  specKeys: string[];
}) {
  const { quotation, matched, unmatched, specKeys } = params;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Title
  doc.setFontSize(16);
  doc.setTextColor(...COLOR_TITLE);
  doc.text("项目产品技术参数表", pageWidth / 2, 18, { align: "center" });

  // Info
  const infoRows = [
    ["客户名称", quotation.customerName || "", "项目名称", quotation.projectName || ""],
    ["报价编号", quotation.quotationNo || "", "报价日期", quotation.createdAt ? new Date(quotation.createdAt).toLocaleDateString("zh-CN") : ""],
  ];

  autoTable(doc, {
    startY: 22,
    body: infoRows.map(row => [
      { content: row[0], styles: { fillColor: COLOR_LABEL_BG, fontStyle: "bold" as const, halign: "center" as const, fontSize: 9 } },
      { content: row[1], styles: { halign: "center" as const, fontSize: 9 } },
      { content: row[2], styles: { fillColor: COLOR_LABEL_BG, fontStyle: "bold" as const, halign: "center" as const, fontSize: 9 } },
      { content: row[3], styles: { halign: "center" as const, fontSize: 9 } },
    ]),
    theme: "grid",
    styles: { cellPadding: 2, lineColor: COLOR_BORDER, lineWidth: 0.2 },
    columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 60 }, 2: { cellWidth: 25 }, 3: { cellWidth: 60 } },
    margin: { left: margin, right: margin },
  });

  // Spec table
  const headers = ["#", "产品型号", "产品说明", "数量", ...specKeys];
  const body = matched.map((item, idx) => [
    String(idx + 1),
    item.productModel,
    item.productDesc || "",
    String(item.quantity),
    ...specKeys.map(k => item.specs?.[k] || "—"),
  ]);

  const lastY = (doc as any).lastAutoTable?.finalY || 35;

  autoTable(doc, {
    startY: lastY + 4,
    head: [headers],
    body,
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: COLOR_BORDER,
      lineWidth: 0.2,
      valign: "middle",
    },
    headStyles: {
      fillColor: COLOR_HEADER_BG,
      textColor: COLOR_HEADER_FG,
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: COLOR_ROW_ALT },
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 30 },
      2: { cellWidth: 40 },
      3: { cellWidth: 12, halign: "center" },
      ...Object.fromEntries(specKeys.map((_, i) => [i + 4, { cellWidth: 25 }])),
    },
  });

  // Unmatched section
  if (unmatched.length > 0) {
    let unmatchedY = (doc as any).lastAutoTable?.finalY + 6 || 100;
    doc.setFontSize(9);
    doc.setTextColor(204, 0, 0);
    doc.text(`未匹配产品（${unmatched.length} 项，无对应参数数据）`, margin, unmatchedY);
    unmatchedY += 3;

    const unmatchedHeaders = ["#", "产品型号", "产品说明", "数量"];
    const unmatchedBody = unmatched.map((item, idx) => [
      String(matched.length + idx + 1),
      item.productModel,
      item.productDesc || "",
      String(item.quantity),
    ]);

    autoTable(doc, {
      startY: unmatchedY,
      head: [unmatchedHeaders],
      body: unmatchedBody,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2, lineColor: COLOR_BORDER, lineWidth: 0.2, textColor: [102, 102, 102] },
      headStyles: { fillColor: [200, 200, 200], textColor: [51, 51, 51], fontStyle: "bold", fontSize: 8 },
      margin: { left: margin, right: margin },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 40 },
        2: { cellWidth: 60 },
        3: { cellWidth: 12, halign: "center" },
      },
    });
  }

  // Save
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `技术参数表_${quotation.customerName || "unknown"}_${dateStr}.pdf`;
  const blob = doc.output("blob");
  await saveBlobWithPicker(blob, fileName, "application/pdf");
}
