import { execSync } from 'child_process';
import path from 'path';
import { z } from 'zod';

/**
 * Generate quotation Excel file using Python backend
 */
export async function generateQuotationExcelFile(quotation: any, items: any[]): Promise<Buffer> {
  const pythonScript = path.join(__dirname, 'generateQuotationExcel.py');
  
  const inputData = {
    quotation: {
      quotationNo: quotation.quotationNo || '',
      customerName: quotation.customerName || '',
      projectName: quotation.projectName || '',
      customerContact: quotation.customerContact || '',
      customerPhone: quotation.customerPhone || '',
      customerEmail: quotation.customerEmail || '',
      createdAt: quotation.createdAt || '',
      validUntil: quotation.validUntil || '',
      notes: quotation.notes || '',
    },
    items: items.map((item: any) => ({
      productModel: item.productModel || '',
      productDesc: item.productDesc || '',
      listPrice: item.listPrice || 0,
      quantity: item.quantity || 1,
      discountRate: item.discountRate || 0,
    })),
  };
  
  try {
    // Execute Python script with JSON input
    const result = execSync(`python3 "${pythonScript}"`, {
      input: JSON.stringify(inputData),
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    }).trim();
    
    // Decode base64 to Buffer
    return Buffer.from(result, 'base64');
  } catch (error: any) {
    console.error('Excel generation error:', error.message);
    throw new Error('Failed to generate Excel file');
  }
}
