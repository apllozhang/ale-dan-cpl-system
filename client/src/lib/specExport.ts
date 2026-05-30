import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

const FONT_CN = "黑体";
const FONT_EN = "Trebuchet MS";

const COLOR_HEADER_BG = "4B0082";
const COLOR_HEADER_FG = "FFFFFF";
const COLOR_ROW_ALT = "F5F5F5";
const COLOR_BORDER = "B0B0B0";
const COLOR_LABEL_BG = "EDEDED";
const COLOR_TITLE = "1B0033";

interface MatchedItem {
  productModel: string;
  productDesc?: string;
  quantity: number;
  listPrice?: string;
  specs: Record<string, string>;
}

export async function exportSpecTable(params: {
  quotation: any;
  matched: MatchedItem[];
  unmatched: { productModel: string; productDesc?: string; quantity: number }[];
  specKeys: string[];
}) {
  const { quotation, matched, unmatched, specKeys } = params;
  const wb = new ExcelJS.Workbook();
  wb.creator = "ALE DAN CPL System";
  wb.created = new Date();

  const ws = wb.addWorksheet("技术参数表", {
    properties: { defaultRowHeight: 22 },
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  // Freeze header row
  let rowIdx = 1;

  // Title
  ws.mergeCells(rowIdx, 1, rowIdx, specKeys.length + 4);
  const titleCell = ws.getCell(rowIdx, 1);
  titleCell.value = "项目产品技术参数表";
  titleCell.font = { name: FONT_CN, size: 16, bold: true, color: { argb: COLOR_TITLE } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(rowIdx).height = 36;
  rowIdx++;

  // Customer info rows
  const infoRows = [
    ["客户名称", quotation.customerName || "", "项目名称", quotation.projectName || ""],
    ["报价编号", quotation.quotationNo || "", "报价日期", new Date(quotation.createdAt).toLocaleDateString("zh-CN")],
  ];
  for (const row of infoRows) {
    const r = ws.getRow(rowIdx);
    r.getCell(1).value = row[0];
    r.getCell(1).font = { name: FONT_CN, size: 9, bold: true };
    r.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_LABEL_BG } };
    r.getCell(2).value = row[1];
    r.getCell(2).font = { name: FONT_CN, size: 9 };
    if (specKeys.length + 4 >= 4) {
      r.getCell(3).value = row[2];
      r.getCell(3).font = { name: FONT_CN, size: 9, bold: true };
      r.getCell(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_LABEL_BG } };
      r.getCell(4).value = row[3];
      r.getCell(4).font = { name: FONT_CN, size: 9 };
    }
    rowIdx++;
  }

  // Blank row
  rowIdx++;

  // Header row
  const headers = ["#", "产品型号", "产品说明", "数量", ...specKeys];
  const headerRow = ws.getRow(rowIdx);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: FONT_CN, size: 10, bold: true, color: { argb: COLOR_HEADER_FG } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_HEADER_BG } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: COLOR_BORDER } },
      bottom: { style: "medium", color: { argb: COLOR_BORDER } },
      left: { style: "thin", color: { argb: COLOR_BORDER } },
      right: { style: "thin", color: { argb: COLOR_BORDER } },
    };
  });
  headerRow.height = 28;
  rowIdx++;

  // Data rows - matched items
  matched.forEach((item, idx) => {
    const r = ws.getRow(rowIdx);
    const isAlt = idx % 2 === 1;
    const values = [
      idx + 1,
      item.productModel,
      item.productDesc || "",
      item.quantity,
      ...specKeys.map(k => item.specs?.[k] || ""),
    ];
    values.forEach((v, i) => {
      const cell = r.getCell(i + 1);
      cell.value = v;
      cell.font = { name: FONT_CN, size: 9.5 };
      cell.alignment = { vertical: "middle", wrapText: i >= 2 };
      cell.border = {
        top: { style: "thin", color: { argb: COLOR_BORDER } },
        bottom: { style: "thin", color: { argb: COLOR_BORDER } },
        left: { style: "thin", color: { argb: COLOR_BORDER } },
        right: { style: "thin", color: { argb: COLOR_BORDER } },
      };
      if (isAlt) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_ROW_ALT } };
      }
    });
    rowIdx++;
  });

  // Unmatched section
  if (unmatched.length > 0) {
    rowIdx++; // blank row
    const warnRow = ws.getRow(rowIdx);
    ws.mergeCells(rowIdx, 1, rowIdx, specKeys.length + 4);
    warnRow.getCell(1).value = `未匹配产品（${unmatched.length} 项，无对应参数数据）`;
    warnRow.getCell(1).font = { name: FONT_CN, size: 10, bold: true, color: { argb: "CC0000" } };
    rowIdx++;

    unmatched.forEach((item, idx) => {
      const r = ws.getRow(rowIdx);
      [matched.length + idx + 1, item.productModel, item.productDesc || "", item.quantity].forEach((v, i) => {
        const cell = r.getCell(i + 1);
        cell.value = v;
        cell.font = { name: FONT_CN, size: 9.5, color: { argb: "666666" } };
        cell.border = {
          top: { style: "thin", color: { argb: COLOR_BORDER } },
          bottom: { style: "thin", color: { argb: COLOR_BORDER } },
          left: { style: "thin", color: { argb: COLOR_BORDER } },
          right: { style: "thin", color: { argb: COLOR_BORDER } },
        };
      });
      rowIdx++;
    });
  }

  // Column widths
  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 22;
  ws.getColumn(3).width = 30;
  ws.getColumn(4).width = 8;
  specKeys.forEach((_, i) => {
    ws.getColumn(i + 5).width = 16;
  });

  // Export
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const fileName = `技术参数表_${quotation.customerName || "unknown"}_${new Date().toISOString().split("T")[0]}.xlsx`;
  saveAs(blob, fileName);
}
