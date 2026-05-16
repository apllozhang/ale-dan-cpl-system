import * as XLSX from 'xlsx';

export interface ExportColumn {
  key: string;
  label: string;
}

export interface ExportData {
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Export data to Excel file
 * @param data Array of data objects to export
 * @param columns Column definitions with key and label
 * @param filename Name of the exported file (without .xlsx extension)
 */
export function exportToExcel(
  data: ExportData[],
  columns: ExportColumn[],
  filename: string = 'export'
) {
  if (data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Create worksheet data with headers
  const wsData: (string | number | boolean | null)[][] = [
    columns.map(col => col.label), // Headers
    ...data.map(row =>
      columns.map(col => {
        const value = row[col.key];
        // Handle null/undefined values
        if (value === null || value === undefined) {
          return '';
        }
        return value;
      })
    ),
  ];

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths based on content
  const colWidths = columns.map((col, idx) => {
    const headerWidth = col.label.length;
    const maxContentWidth = Math.max(
      ...data.map(row => {
        const value = row[col.key];
        return String(value || '').length;
      })
    );
    // Add some padding and ensure minimum width
    return Math.min(Math.max(headerWidth, maxContentWidth) + 2, 50);
  });

  ws['!cols'] = colWidths.map(width => ({ wch: width }));

  // Style header row
  const headerStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '6366F1' } }, // Indigo color
    alignment: { horizontal: 'center' as const, vertical: 'center' as const },
  };

  // Apply header styling
  for (let i = 0; i < columns.length; i++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
    if (ws[cellRef]) {
      ws[cellRef].s = headerStyle;
    }
  }

  // Create workbook and add worksheet
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const fullFilename = `${filename}_${timestamp}.xlsx`;

  // Write file
  XLSX.writeFile(wb, fullFilename);
}
