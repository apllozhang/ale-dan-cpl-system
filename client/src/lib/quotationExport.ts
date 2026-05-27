import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { toast } from "sonner";

const FONT_CN = "黑体";
const FONT_EN = "Trebuchet MS";
const SIZE_BASE = 10;
const SIZE_TITLE = 18;
const SIZE_SUBTITLE = 9;
const SIZE_HEADER = 10;
const SIZE_DATA = 9.5;
const SIZE_TOTAL = 11;
const SIZE_NOTE = 9;
const SIZE_FOOTER = 8;

const COLOR_HEADER_BG = "4B0082";
const COLOR_HEADER_FG = "FFFFFF";
const COLOR_ROW_ALT = "F5F5F5";
const COLOR_BORDER = "B0B0B0";
const COLOR_LABEL_BG = "EDEDED";
const COLOR_TITLE = "1B0033";
const COLOR_TOTAL_BG = "E8E0F0";

interface CellStyle {
  font?: any;
  fill?: any;
  alignment?: any;
  border?: any;
  numFmt?: string;
}

function makeBorder(style: "thin" | "medium" = "thin", color = COLOR_BORDER) {
  return { style, color: { argb: color } };
}

function applyStyle(cell: ExcelJS.Cell, s: CellStyle) {
  if (s.font) cell.font = s.font;
  if (s.fill) cell.fill = s.fill;
  if (s.alignment) cell.alignment = s.alignment;
  if (s.border) cell.border = s.border;
  if (s.numFmt) cell.numFmt = s.numFmt;
}

export async function exportQuotationToExcel(quotation: any, items: any[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ALE DAN CPL System";
  wb.created = new Date();

  const ws = wb.addWorksheet("报价单", {
    properties: { defaultRowHeight: 22 },
    views: [{ state: "frozen", ySplit: 9, xSplit: 0 }],
  });

  // Column definitions: 单价在数量左侧；媒体价/折扣率隔一列便于手工删除
  ws.columns = [
    { key: "idx", width: 6 },
    { key: "model", width: 30 },
    { key: "desc", width: 45 },
    { key: "unitPrice", width: 14 },
    { key: "qty", width: 8 },
    { key: "subtotal", width: 14 },
    { key: "sep", width: 2 },
    { key: "listPrice", width: 14 },
    { key: "disc", width: 10 },
  ];

  // === Row 1-2: Title + Logo ===
  const titleRow = ws.getRow(1);
  titleRow.height = 40;
  ws.mergeCells("A1:I1");
  const titleCell = ws.getCell("A1");
  titleCell.value = "ALE DAN 报价单";
  titleCell.font = { name: FONT_CN, size: SIZE_TITLE, bold: true, color: { argb: COLOR_TITLE } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };

  // Sub-title row
  const subRow = ws.getRow(2);
  subRow.height = 22;
  ws.mergeCells("A2:I2");
  const subCell = ws.getCell("A2");
  subCell.value = "ALCATEL-LUCENT ENTERPRISE · DAN SOLUTION QUOTATION";
  subCell.font = { name: FONT_EN, size: SIZE_SUBTITLE, color: { argb: "888888" } };
  subCell.alignment = { horizontal: "center", vertical: "middle" };

  // Row 3: spacer
  ws.getRow(3).height = 8;

  // === Row 4-6: Customer Info ===
  const infoData = [
    ["报价编号", quotation.quotationNo || "", "客户名称", quotation.customerName || ""],
    ["项目名称", quotation.projectName || "", "联系电话", quotation.customerPhone || ""],
    ["报价日期", quotation.createdAt ? new Date(quotation.createdAt).toLocaleDateString("zh-CN") : "", "报价有效期", quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString("zh-CN") : ""],
  ];

  const labelStyle: CellStyle = {
    font: { name: FONT_CN, size: SIZE_BASE, bold: true, color: { argb: "333333" } },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_LABEL_BG } },
    alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    border: { top: makeBorder(), bottom: makeBorder(), left: makeBorder(), right: makeBorder() },
  };
  const valueStyle: CellStyle = {
    font: { name: FONT_EN, size: SIZE_BASE },
    alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    border: { top: makeBorder(), bottom: makeBorder(), left: makeBorder(), right: makeBorder() },
  };

  infoData.forEach((row, i) => {
    const r = ws.getRow(4 + i);
    r.height = 22;

    // Col A: label, Col B: value, Col C: spacer, Col D: label, Col E: value
    // Layout: A(label) B(value) C(empty) E(label) F(value), merge B-D, F-H
    const labelCell1 = r.getCell(1);
    labelCell1.value = row[0];
    applyStyle(labelCell1, labelStyle);

    ws.mergeCells(4 + i, 2, 4 + i, 4);
    const valueCell1 = r.getCell(2);
    valueCell1.value = row[1];
    applyStyle(valueCell1, valueStyle);
    // Apply border to merged cells
    for (let c = 3; c <= 4; c++) applyStyle(r.getCell(c), { border: valueStyle.border });

    const labelCell2 = r.getCell(5);
    labelCell2.value = row[2];
    applyStyle(labelCell2, labelStyle);

    ws.mergeCells(4 + i, 6, 4 + i, 9);
    const valueCell2 = r.getCell(6);
    valueCell2.value = row[3];
    applyStyle(valueCell2, valueStyle);
    for (let c = 7; c <= 9; c++) applyStyle(r.getCell(c), { border: valueStyle.border });
  });

  // Row 8: spacer
  ws.getRow(8).height = 6;

  // === Row 9: Table Header ===
  const headerRow = ws.getRow(9);
  headerRow.height = 28;
  const headers = ["序号", "产品型号", "产品说明", "单价(¥)", "数量", "小计(¥)", "", "媒体价(¥)", "折扣率(%)"];
  const headerStyle: CellStyle = {
    font: { name: FONT_CN, size: 10, bold: true, color: { argb: COLOR_HEADER_FG } },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_HEADER_BG } },
    alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    border: {
      top: makeBorder("medium", COLOR_HEADER_BG),
      bottom: makeBorder("medium", COLOR_HEADER_BG),
      left: makeBorder("thin", "6B1078"),
      right: makeBorder("thin", "6B1078"),
    },
  };
  const sepHeaderStyle: CellStyle = {
    border: {
      top: makeBorder("medium", COLOR_HEADER_BG),
      bottom: makeBorder("medium", COLOR_HEADER_BG),
    },
  };

  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    applyStyle(cell, i === 6 ? sepHeaderStyle : headerStyle);
  });

  // === Row 10+: Data Rows ===
  let total = 0;
  const dataStartRow = 10;

  items.forEach((item, idx) => {
    const listPrice = parseFloat(item.listPrice) || 0;
    const discount = Number(item.discountRate) || 0;
    const unitPrice = listPrice * (1 - discount / 100);
    const qty = item.quantity || 1;
    const subtotal = unitPrice * qty;
    total += subtotal;

    const r = ws.getRow(dataStartRow + idx);
    const isAlt = idx % 2 === 1;

    const baseBorder = {
      top: makeBorder("thin", "D0D0D0"),
      bottom: makeBorder("thin", "D0D0D0"),
      left: makeBorder("thin", "D0D0D0"),
      right: makeBorder("thin", "D0D0D0"),
    };
    const baseFill = isAlt ? { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: COLOR_ROW_ALT } } : undefined;
    const baseAlign = { horizontal: "center" as const, vertical: "middle" as const, wrapText: true };

    const textStyle: CellStyle = {
      font: { name: FONT_CN, size: SIZE_DATA },
      fill: baseFill,
      alignment: baseAlign,
      border: baseBorder,
    };
    const numStyle: CellStyle = {
      font: { name: FONT_EN, size: SIZE_DATA },
      fill: baseFill,
      alignment: baseAlign,
      border: baseBorder,
      numFmt: '¥#,##0.00',
    };
    const boldNumStyle: CellStyle = {
      font: { name: FONT_EN, size: SIZE_DATA, bold: true },
      fill: baseFill,
      alignment: baseAlign,
      border: baseBorder,
      numFmt: '¥#,##0.00',
    };

    // 序号
    const c1 = r.getCell(1);
    c1.value = idx + 1;
    applyStyle(c1, textStyle);

    // 产品型号
    const c2 = r.getCell(2);
    c2.value = item.productModel || "";
    applyStyle(c2, textStyle);

    // 产品说明
    const c3 = r.getCell(3);
    c3.value = item.productDesc || "";
    applyStyle(c3, textStyle);

    // 单价
    const c4 = r.getCell(4);
    c4.value = unitPrice;
    applyStyle(c4, numStyle);

    // 数量
    const c5 = r.getCell(5);
    c5.value = qty;
    applyStyle(c5, textStyle);

    // 小计
    const c6 = r.getCell(6);
    c6.value = subtotal;
    applyStyle(c6, boldNumStyle);

    // 分隔列（空）
    // col 7 intentionally left empty

    // 媒体价（右侧，便于手工删除）
    const c8 = r.getCell(8);
    c8.value = listPrice;
    applyStyle(c8, numStyle);

    // 折扣率（右侧，便于手工删除）
    const c9 = r.getCell(9);
    c9.value = discount > 0 ? `${discount}%` : "-";
    applyStyle(c9, textStyle);
  });

  // === Total Row ===
  const totalRowIdx = dataStartRow + items.length;
  const totalRow = ws.getRow(totalRowIdx);
  totalRow.height = 28;

  ws.mergeCells(totalRowIdx, 1, totalRowIdx, 5);
  const totalLabel = totalRow.getCell(1);
  totalLabel.value = "合  计";
  totalLabel.font = { name: FONT_CN, size: SIZE_TOTAL, bold: true };
  totalLabel.alignment = { horizontal: "center", vertical: "middle" };
  totalLabel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_TOTAL_BG } };
  for (let c = 2; c <= 5; c++) {
    totalRow.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_TOTAL_BG } };
  }

  // 小计列显示合计金额
  const totalCell = totalRow.getCell(6);
  totalCell.value = total;
  totalCell.numFmt = '¥#,##0.00';
  totalCell.font = { name: FONT_EN, size: SIZE_TOTAL, bold: true, color: { argb: COLOR_HEADER_BG } };
  totalCell.alignment = { horizontal: "center", vertical: "middle" };
  totalCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_TOTAL_BG } };

  // 分隔列、媒体价、折扣率列留空
  for (const c of [7, 8, 9]) {
    totalRow.getCell(c).value = "";
    totalRow.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_TOTAL_BG } };
  }

  // Border for total row
  const totalBorder: any = {
    top: makeBorder("medium", COLOR_HEADER_BG),
    bottom: makeBorder("medium", COLOR_HEADER_BG),
    left: makeBorder("thin", COLOR_BORDER),
    right: makeBorder("thin", COLOR_BORDER),
  };
  for (let c = 1; c <= 9; c++) {
    totalRow.getCell(c).border = totalBorder;
  }

  // === Notes Row ===
  let currentRow = totalRowIdx + 1;
  if (quotation.notes) {
    const noteRow = ws.getRow(currentRow);
    noteRow.height = 22;
    ws.mergeCells(currentRow, 1, currentRow, 9);
    const noteCell = noteRow.getCell(1);
    noteCell.value = `备注：${quotation.notes}`;
    noteCell.font = { name: FONT_CN, size: SIZE_NOTE, color: { argb: "666666" } };
    noteCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    currentRow++;
  }

  // === Footer ===
  currentRow += 1;
  const footerRow = ws.getRow(currentRow);
  footerRow.height = 20;
  ws.mergeCells(currentRow, 1, currentRow, 9);
  const footerCell = footerRow.getCell(1);
  footerCell.value = "本报价仅供客户参考，最终价格以双方签订合同为准。";
  footerCell.font = { name: FONT_CN, size: SIZE_FOOTER, italic: true, color: { argb: "999999" } };
  footerCell.alignment = { horizontal: "center", vertical: "middle" };

  currentRow++;
  const footerRow2 = ws.getRow(currentRow);
  footerRow2.height = 18;
  ws.mergeCells(currentRow, 1, currentRow, 9);
  const footerCell2 = footerRow2.getCell(1);
  footerCell2.value = `Generated by ALE DAN CPL System · ${new Date().toLocaleDateString("zh-CN")}`;
  footerCell2.font = { name: FONT_EN, size: 7, color: { argb: "BBBBBB" } };
  footerCell2.alignment = { horizontal: "center", vertical: "middle" };

  // === Logo ===
  try {
    const logoResp = await fetch("/ale-logo.png");
    if (logoResp.ok) {
      const logoBuffer = await logoResp.arrayBuffer();
      const logoId = wb.addImage({
        buffer: new Uint8Array(logoBuffer) as any,
        extension: "png",
      });
      ws.addImage(logoId, {
        tl: { col: 0, row: 0 },
        ext: { width: 120, height: 36 },
      });
    }
  } catch {
    // Logo not found, skip
  }

  // === Generate file ===
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `报价单_${quotation.quotationNo || "new"}_${dateStr}.xlsx`;

  saveAs(blob, fileName);
  toast.success("报价单已导出");
}
