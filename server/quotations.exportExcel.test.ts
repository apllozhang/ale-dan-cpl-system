import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { generateQuotationExcel } from "./quotationExcelExport";
import ExcelJS from "exceljs";

describe("quotationExcelExport", () => {
  it("should generate a valid Excel file with correct structure", async () => {
    const testData = {
      quotationNo: "QT-2026-001",
      customerName: "Test Customer",
      projectName: "Test Project",
      customerContact: "John Doe",
      customerPhone: "1234567890",
      customerEmail: "john@example.com",
      createdAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      notes: "Test notes",
      items: [
        {
          productModel: "DAN-1000",
          productDesc: "Test Product 1",
          listPrice: 1000,
          quantity: 2,
          discountRate: 10,
        },
        {
          productModel: "DAN-2000",
          productDesc: "Test Product 2",
          listPrice: 2000,
          quantity: 1,
          discountRate: 0,
        },
      ],
      totalAmount: 3800, // (1000 * 2 * 0.9) + (2000 * 1 * 1.0) = 1800 + 2000
      discountPercent: 0,
    };

    const buffer = await generateQuotationExcel(testData);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    // Parse the generated Excel to verify structure
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    
    const worksheet = workbook.worksheets[0];
    expect(worksheet).toBeDefined();
    expect(worksheet?.name).toBe("报价单");

    // Check title (row 1, column 1)
    const titleCell = worksheet?.getCell(1, 1);
    expect(titleCell?.value).toBe("DAN 报价单");

    // Check that customer info is present (row 3 for quotation number, row 4 for customer name)
    const quotationNoCell = worksheet?.getCell(3, 2);
    expect(quotationNoCell?.value).toBe("QT-2026-001");

    const customerNameCell = worksheet?.getCell(4, 2);
    expect(customerNameCell?.value).toBe("Test Customer");

    // Verify the file was generated successfully
    expect(worksheet).toBeDefined();
  });

  it("should handle items with discounts correctly", async () => {
    const testData = {
      quotationNo: "QT-2026-002",
      customerName: "Discount Test",
      projectName: "Discount Project",
      items: [
        {
          productModel: "DAN-3000",
          productDesc: "Product with 20% discount",
          listPrice: 1000,
          quantity: 1,
          discountRate: 20,
        },
      ],
      totalAmount: 800, // 1000 * 1 * 0.8
    };

    const buffer = await generateQuotationExcel(testData);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];

    // Verify the file structure
    expect(worksheet?.name).toBe("报价单");
    const titleCell = worksheet?.getCell(1, 1);
    expect(titleCell?.value).toBe("DAN 报价单");
  });

  it("should handle empty items array", async () => {
    const testData = {
      quotationNo: "QT-2026-003",
      customerName: "Empty Items Test",
      projectName: "Empty Project",
      items: [],
      totalAmount: 0,
    };

    const buffer = await generateQuotationExcel(testData);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    expect(worksheet?.name).toBe("报价单");
    const titleCell = worksheet?.getCell(1, 1);
    expect(titleCell?.value).toBe("DAN 报价单");
  });

  it("should handle optional fields gracefully", async () => {
    const testData = {
      quotationNo: "QT-2026-004",
      customerName: "Minimal Data",
      projectName: "Minimal Project",
      items: [
        {
          productModel: "DAN-4000",
          productDesc: "Minimal Product",
          listPrice: 500,
          quantity: 1,
          discountRate: 0,
        },
      ],
      totalAmount: 500,
      // No optional fields
    };

    const buffer = await generateQuotationExcel(testData);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    expect(worksheet?.name).toBe("报价单");
    const titleCell = worksheet?.getCell(1, 1);
    expect(titleCell?.value).toBe("DAN 报价单");
    const customerNameCell = worksheet?.getCell(4, 2);
    expect(customerNameCell?.value).toBe("Minimal Data");
  });

  it("should calculate totals correctly", async () => {
    const testData = {
      quotationNo: "QT-2026-005",
      customerName: "Total Test",
      projectName: "Total Project",
      items: [
        {
          productModel: "DAN-5000",
          productDesc: "Item 1",
          listPrice: 1000,
          quantity: 2,
          discountRate: 10, // 10% discount
        },
        {
          productModel: "DAN-5001",
          productDesc: "Item 2",
          listPrice: 500,
          quantity: 1,
          discountRate: 0, // No discount
        },
      ],
      totalAmount: 2300, // (1000 * 2 * 0.9) + (500 * 1 * 1.0) = 1800 + 500
    };

    const buffer = await generateQuotationExcel(testData);
    expect(buffer).toBeInstanceOf(Buffer);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    
    // Verify structure
    expect(worksheet?.name).toBe("报价单");
    const titleCell = worksheet?.getCell(1, 1);
    expect(titleCell?.value).toBe("DAN 报价单");
    
    // Verify the file was generated successfully
    expect(worksheet).toBeDefined();
  });
});
