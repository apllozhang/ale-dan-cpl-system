/**
 * Import spec data from Excel file into database.
 * Usage: node scripts/import-spec-data.mjs [filepath]
 */
import XLSX from "xlsx";
import mysql from "mysql2/promise";

const DB_URL = process.env.DATABASE_URL || "mysql://root:@localhost:3306/ale_cpl";

const DATA_SHEETS = [
  "OmniAccess Stellar",
  "OmniSwitch",
  "OmniSwitch (2960 2560 2160)",
  "OmniSwitch (工业)",
  "OmniAccess ESR",
  "OmniAccess Vista2500",
];

async function main() {
  const filePath = process.argv[2] || "ALE常用型号简要参数集v1.4 20250624.xlsx";
  console.log(`Reading: ${filePath}`);

  const workbook = XLSX.readFile(filePath);
  const conn = await mysql.createConnection(DB_URL);

  let totalSets = 0;
  let totalEntries = 0;

  for (const sheetName of DATA_SHEETS) {
    if (!workbook.SheetNames.includes(sheetName)) {
      console.log(`  SKIP: "${sheetName}" not found`);
      continue;
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    const modelCol = headers.find(h => h.includes("型号"));
    const descCol = headers.find(h => h.includes("简要参数"));
    const noteCol = headers.find(h => h.includes("备注"));

    if (!modelCol) {
      console.log(`  SKIP: "${sheetName}" - no 型号 column`);
      continue;
    }

    const entries = rows
      .filter(row => (row[modelCol] || "").toString().trim() !== "")
      .map(row => {
        const productModel = row[modelCol].toString().trim();
        const productDesc = descCol ? (row[descCol] || "").toString().trim() : "";
        const note = noteCol ? (row[noteCol] || "").toString().trim() : "";
        const specs = {};
        if (note) specs["备注"] = note;
        return { productModel, productDesc, specs };
      });

    if (entries.length === 0) {
      console.log(`  SKIP: "${sheetName}" - no entries`);
      continue;
    }

    // Check if set already exists
    const [existing] = await conn.execute(
      "SELECT id FROM product_spec_sets WHERE name = ? LIMIT 1",
      [sheetName]
    );
    let setId;

    if (existing.length > 0) {
      setId = existing[0].id;
      await conn.execute("DELETE FROM product_specs WHERE setId = ?", [setId]);
      await conn.execute(
        "UPDATE product_spec_sets SET modelCount = ?, updatedAt = NOW() WHERE id = ?",
        [entries.length, setId]
      );
      console.log(`  UPDATE: "${sheetName}" (id=${setId}) - ${entries.length} entries`);
    } else {
      const [result] = await conn.execute(
        "INSERT INTO product_spec_sets (name, fileName, description, modelCount, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, 1, NOW(), NOW())",
        [sheetName, filePath, `${sheetName} 简要参数集`, entries.length]
      );
      setId = result.insertId;
      console.log(`  INSERT: "${sheetName}" (id=${setId}) - ${entries.length} entries`);
    }

    // Insert entries
    for (const entry of entries) {
      await conn.execute(
        "INSERT INTO product_specs (setId, productModel, productDesc, specs, createdAt, updatedAt) VALUES (?, ?, ?, ?, NOW(), NOW())",
        [setId, entry.productModel, entry.productDesc || null, JSON.stringify(entry.specs)]
      );
    }

    totalSets++;
    totalEntries += entries.length;
  }

  await conn.end();
  console.log(`\nDone: ${totalSets} sets, ${totalEntries} total entries imported.`);
}

main().catch(err => {
  console.error("Import failed:", err);
  process.exit(1);
});
