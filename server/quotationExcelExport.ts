import ExcelJS from 'exceljs';


export interface QuotationItem {
  productModel: string;
  productDesc: string;
  listPrice: number;
  quantity: number;
  discountRate: number;
}

export interface QuotationData {
  quotationNo: string;
  customerName: string;
  projectName: string;
  customerContact?: string;
  customerPhone?: string;
  customerEmail?: string;
  createdAt?: string;
  validUntil?: string;
  notes?: string;
  items: QuotationItem[];
  totalAmount: number;
  discountPercent?: number;
}

export async function generateQuotationExcel(data: QuotationData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('报价单');

  // Set column widths
  worksheet.columns = [
    { header: '#', key: 'index', width: 6 },
    { header: '产品型号', key: 'productModel', width: 18 },
    { header: '产品说明', key: 'productDesc', width: 40 },
    { header: '媒体价', key: 'listPrice', width: 15 },
    { header: '数量', key: 'quantity', width: 10 },
    { header: '折扣(%)', key: 'discountRate', width: 12 },
    { header: '小计', key: 'subtotal', width: 15 },
  ];

  // Define colors and styles
  const headerFill = {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: 'FF7C3AED' }, // Purple
  };

  const headerFont = {
    name: 'Trebuchet MS',
    size: 11,
    bold: true,
    color: { argb: 'FFFFFFFF' }, // White
  };

  const alternateRowFill = {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: 'FFF3F4F6' }, // Light gray
  };

  const border = {
    top: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
    left: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
    bottom: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
    right: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
  };

  // Title row
  const titleRow = worksheet.insertRow(1, []);
  titleRow.height = 28;
  worksheet.mergeCells('A1:G1');
  const titleCell = titleRow.getCell(1);
  titleCell.value = 'DAN 报价单';
  titleCell.font = { name: '黑体', size: 18, bold: true, color: { argb: 'FF1F2937' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Customer info section
  let currentRow = 3;
  const addInfoRow = (label: string, value: string) => {
    const row = worksheet.insertRow(currentRow, []);
    row.height = 20;
    const labelCell = row.getCell(1);
    labelCell.value = label;
    labelCell.font = { name: '黑体', size: 10, bold: true };
    labelCell.alignment = { horizontal: 'left', vertical: 'middle' };

    const valueCell = row.getCell(2);
    valueCell.value = value;
    valueCell.font = { name: 'Trebuchet MS', size: 10 };
    valueCell.alignment = { horizontal: 'left', vertical: 'middle' };

    currentRow++;
  };

  addInfoRow('报价编号', data.quotationNo);
  addInfoRow('客户名称', data.customerName);
  addInfoRow('项目名称', data.projectName);
  if (data.customerContact) addInfoRow('联系人', data.customerContact);
  if (data.customerPhone) addInfoRow('联系电话', data.customerPhone);
  if (data.customerEmail) addInfoRow('邮箱', data.customerEmail);
  if (data.createdAt) addInfoRow('报价日期', new Date(data.createdAt).toLocaleDateString('zh-CN'));
  if (data.validUntil) addInfoRow('有效期至', new Date(data.validUntil).toLocaleDateString('zh-CN'));

  // Empty row
  currentRow++;

  // Header row
  const headerRowNum = currentRow;
  const headerRow = worksheet.insertRow(headerRowNum, []);
  headerRow.height = 22;

  const headers = ['#', '产品型号', '产品说明', '媒体价', '数量', '折扣(%)', '小计'];
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = border;
  });

  // Data rows
  currentRow++;
  let rowIndex = 1;
  data.items.forEach((item, idx) => {
    const row = worksheet.insertRow(currentRow, []);
    row.height = 24;

    const cells = [
      idx + 1,
      item.productModel,
      item.productDesc,
      item.listPrice,
      item.quantity,
      item.discountRate,
      item.listPrice * item.quantity * (item.discountRate / 100),
    ];

    cells.forEach((value, index) => {
      const cell = row.getCell(index + 1);
      cell.value = value;
      cell.font = { name: 'Trebuchet MS', size: 10 };
      cell.border = border;

      // Alternate row colors
      if (rowIndex % 2 === 0) {
        cell.fill = alternateRowFill;
      }

      // Format currency columns
      if (index === 3 || index === 6) {
        cell.numFmt = '"¥"#,##0.00';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (index === 4 || index === 5) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      }
    });

    currentRow++;
    rowIndex++;
  });

  // Summary row
  const summaryRow = worksheet.insertRow(currentRow, []);
  summaryRow.height = 24;

  const summaryFill = {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: 'FFEDE9FE' }, // Light purple
  };

  const summaryFont = {
    name: '黑体',
    size: 11,
    bold: true,
    color: { argb: 'FF7C3AED' },
  };

  // Merge cells for summary label
  worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
  const summaryLabelCell = summaryRow.getCell(1);
  summaryLabelCell.value = '合计金额';
  summaryLabelCell.font = summaryFont;
  summaryLabelCell.fill = summaryFill;
  summaryLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };
  summaryLabelCell.border = border;

  const summaryValueCell = summaryRow.getCell(6);
  summaryValueCell.value = data.totalAmount;
  summaryValueCell.numFmt = '"¥"#,##0.00';
  summaryValueCell.font = summaryFont;
  summaryValueCell.fill = summaryFill;
  summaryValueCell.alignment = { horizontal: 'right', vertical: 'middle' };
  summaryValueCell.border = border;

  // Freeze panes (freeze header row)
  worksheet.views = [
    {
      state: 'frozen',
      ySplit: headerRowNum,
      activeCell: 'A1',
      showGridLines: true,
    },
  ];

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
