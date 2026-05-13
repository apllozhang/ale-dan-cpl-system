import 'dotenv/config';
import XLSX from 'xlsx';
import { drizzle } from 'drizzle-orm/mysql2';
import { sql } from 'drizzle-orm';
import fs from 'fs';

const EXCEL_PATH = '/home/ubuntu/upload/DataCPL-(Q2May2026CN).xlsx';

const COLUMN_MAP = {
  "产品组件": "productGroup",
  "OmniVista 2500 Partner Support Software": "productGroup",
  "税务小类": "taxCategory",
  "线缆": "taxCategory",
  "类别": "taxCategory",
  "产品型号": "productModel",
  "型号": "productModel",
  "产品说明": "productDesc",
  "描述": "productDesc",
  "销售类别": "salesCategory",
  "服务类别": "serviceCategory",
  "产品状态": "productStatus",
  "服务状态": "productStatus",
  "状态": "productStatus",
  "媒体价": "listPrice",
  "价格说明": "priceNote",
  "新品": "isNew",
  "备注": "remark",
  "注释": "remark",
  "子类别": "serviceCategory",
};

function escapeStr(s) {
  if (!s) return "''";
  return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

async function main() {
  console.log('Reading Excel file...');
  const buffer = fs.readFileSync(EXCEL_PATH);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  
  const sheetsToSkip = ['Summary', 'LBS场景化报价模型'];
  
  // Parse Summary
  let summaryContent = '';
  if (workbook.SheetNames.includes('Summary')) {
    const ws = workbook.Sheets['Summary'];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const lines = [];
    for (const row of data) {
      if (Array.isArray(row)) {
        const text = row.filter(c => c !== null && c !== undefined && c !== '').join(' ').trim();
        if (text) lines.push(text);
      }
    }
    summaryContent = lines.join('\n');
  }
  
  // Parse product sheets
  const allProducts = [];
  const sheetMeta = [];
  let order = 0;
  
  for (const sheetName of workbook.SheetNames) {
    if (sheetsToSkip.includes(sheetName)) continue;
    const trimmedName = sheetName.trim();
    const ws = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    
    let count = 0;
    for (const row of rows) {
      const mapped = {};
      for (const [key, value] of Object.entries(row)) {
        const mappedKey = COLUMN_MAP[key.trim()];
        if (mappedKey) {
          mapped[mappedKey] = value != null ? String(value).trim() : '';
        }
      }
      if (!mapped.productModel && !mapped.productDesc && !mapped.productGroup) continue;
      
      allProducts.push({
        sheetName: trimmedName,
        productGroup: mapped.productGroup || '',
        taxCategory: mapped.taxCategory || '',
        productModel: mapped.productModel || '',
        productDesc: mapped.productDesc || '',
        salesCategory: mapped.salesCategory || '',
        serviceCategory: mapped.serviceCategory || '',
        productStatus: mapped.productStatus || '',
        listPrice: mapped.listPrice || '',
        priceNote: mapped.priceNote || '',
        isNew: mapped.isNew || '',
        remark: mapped.remark || '',
      });
      count++;
    }
    
    sheetMeta.push({ sheetName: trimmedName, displayOrder: order++, productCount: count });
  }
  
  console.log(`Parsed ${allProducts.length} products across ${sheetMeta.length} sheets`);
  
  // Connect to database
  const db = drizzle(process.env.DATABASE_URL);
  
  // Clear existing data
  console.log('Clearing existing data...');
  await db.execute(sql`DELETE FROM cpl_products`);
  await db.execute(sql`DELETE FROM cpl_sheets`);
  await db.execute(sql`DELETE FROM cpl_summary`);
  
  // Insert sheets
  console.log('Inserting sheet metadata...');
  for (const sheet of sheetMeta) {
    await db.execute(sql`INSERT INTO cpl_sheets (sheetName, displayOrder, productCount) VALUES (${sheet.sheetName}, ${sheet.displayOrder}, ${sheet.productCount})`);
  }
  
  // Insert products in batches
  console.log('Inserting products...');
  const batchSize = 50;
  for (let i = 0; i < allProducts.length; i += batchSize) {
    const batch = allProducts.slice(i, i + batchSize);
    for (const p of batch) {
      await db.execute(sql`INSERT INTO cpl_products (sheetName, productGroup, taxCategory, productModel, productDesc, salesCategory, serviceCategory, productStatus, listPrice, priceNote, isNew, remark) VALUES (${p.sheetName}, ${p.productGroup}, ${p.taxCategory}, ${p.productModel}, ${p.productDesc}, ${p.salesCategory}, ${p.serviceCategory}, ${p.productStatus}, ${p.listPrice}, ${p.priceNote}, ${p.isNew}, ${p.remark})`);
    }
    process.stdout.write(`\r  Inserted ${Math.min(i + batchSize, allProducts.length)}/${allProducts.length}`);
  }
  console.log('');
  
  // Insert summary
  if (summaryContent) {
    console.log('Inserting summary...');
    await db.execute(sql`INSERT INTO cpl_summary (content, version) VALUES (${summaryContent}, ${'DataCPL-(Q2May2026CN).xlsx'})`);
  }
  
  console.log('Seed complete!');
  process.exit(0);
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
