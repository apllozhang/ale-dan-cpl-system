import XLSX from "xlsx";
import fs from "fs";
import path from "path";

const INPUT_FILE = "G:/市场部/eFlash/eFlash-合并数据表.xlsx";
const ARCHIVE_DIR = "G:/市场部/eFlash/存档";
const OUTPUT_FILE = INPUT_FILE; // overwrite

// ==================== 1. Scan all archive PDFs ====================
console.log("Scanning archive PDFs...");

const pdfFiles = [];
function scanDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) scanDir(full);
    else if (/\.pdf$/i.test(entry.name)) {
      const match = entry.name.match(/EF-([A-Za-z]\d+)/i);
      if (match) {
        const id = "EF-" + match[1].toUpperCase();
        const fn = entry.name;
        const isCn = /[-_\s]CN/i.test(fn) || /[-_\s]CN[-_.]/i.test(fn);
        const isEn = /[-_\s]EN/i.test(fn) || /[-_\s]EN[-_.]/i.test(fn);

        // Extract year from folder path or filename
        const folderYear = full.match(/[/\\](\d{4})[/\\]/)?.[1] || "";
        const fileYear = fn.match(/20\d{2}/)?.[0] || "";
        const year = folderYear || fileYear;

        pdfFiles.push({ id, fileName: fn, isCn, isEn, year, size: fs.statSync(full).size });
      }
    }
  }
}
scanDir(ARCHIVE_DIR);

// Group by ID
const byId = {};
for (const f of pdfFiles) {
  if (!byId[f.id]) byId[f.id] = { cn: [], en: [], all: [] };
  if (f.isCn) byId[f.id].cn.push(f);
  else if (f.isEn) byId[f.id].en.push(f);
  byId[f.id].all.push(f);
}

// ==================== 2. Subject extraction from filename ====================
function extractSubject(fileName) {
  const fn = fileName.replace(/\.pdf$/i, "");

  // Pattern 1: type-Subject-EF-X###-lang  (most common)
  let m = fn.match(/(?:Phase[\s_-]*(?:in|out)|Pricing|Service|Logistics)[\s_-]+(.+?)[\s_-]+EF-[A-Za-z]\d+/i);
  if (m) return cleanSubject(m[1]);

  // Pattern 2: eFlash-Phase in/out-Z###-Subject-CN/EN
  m = fn.match(/eFlash[\s_-]+(?:Phase[\s_-]*(?:in|out))[\s_-]+(?:EF-)?[A-Za-z]?\d*[\s_-]*(.+?)(?:[\s_-]+CN|[\s_-]+EN)?$/i);
  if (m) return cleanSubject(m[1]);

  // Pattern 3: Phase-in-Communications-Suite-...-EF-C###-EN
  m = fn.match(/(?:Phase[\s_-]*(?:in|out))[\s_-]+(.+?)[\s_-]*EF-[A-Za-z]\d+/i);
  if (m) return cleanSubject(m[1]);

  // Pattern 4: just extract everything before EF-
  m = fn.match(/(.+?)[\s_-]*EF-[A-Za-z]\d+/i);
  if (m) return cleanSubject(m[1]);

  return "";
}

function cleanSubject(s) {
  return s
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^\s*(Phase[\s_-]*(?:in|out)|Pricing|Service|Logistics)\s*/i, "")
    .replace(/\s*EF-[A-Za-z]\d*$/i, "")
    .trim();
}

// ==================== 3. Read existing data and enrich ====================
console.log("Reading existing data...");
const wb = XLSX.readFile(INPUT_FILE);
const ws = wb.Sheets["eFlash Records"];
const header = XLSX.utils.sheet_to_json(ws, { header: 1 })[0];
const records = XLSX.utils.sheet_to_json(ws);

let enriched = 0;

for (const r of records) {
  const id = r["eFlash ID"];
  const info = byId[id];
  if (!info) continue;

  // ---- Subject (EN) ----
  if (!r["Subject (EN)"]) {
    const enPdf = info.en[0] || info.all.find(f => !f.isCn);
    if (enPdf) {
      const subj = extractSubject(enPdf.fileName);
      if (subj) {
        r["Subject (EN)"] = subj;
        enriched++;
      }
    }
  }

  // ---- Subject (CN) ----
  if (!r["Subject (CN)"]) {
    const cnPdf = info.cn[0];
    if (cnPdf) {
      const subj = extractSubject(cnPdf.fileName);
      if (subj) {
        r["Subject (CN)"] = subj;
        enriched++;
      }
    }
  }

  // ---- PDF Path: update to CN version if available ----
  if (!r["PDF Path"] && info.cn[0]) {
    r["PDF Path"] = info.cn[0].fileName;
    r["Has PDF"] = "Yes";
  }

  // ---- Author (CN): from PDF file context ----
  // We can't extract author from filename, skip

  // ---- Infer dates from year folder ----
  if (!r["Effective Date"] && info.all[0]?.year) {
    // Don't guess exact date, just note the year in comments if empty
    if (!r.Comments) {
      r.Comments = `~${info.all[0].year}`;
    }
  }
}

// ==================== 4. Cross-fill from EN to CN subjects ====================
// For records with EN subject but no CN, and vice versa

// For NET Global records missing CN subject but having EN subject,
// add a prefix based on type
for (const r of records) {
  if (!r["Subject (CN)"] && r["Subject (EN)"]) {
    const type = r.Type;
    let prefix = "";
    if (type === "Phase-in") prefix = "正式发布 | ";
    else if (type === "Phase-out") prefix = "停售通知 | ";
    else if (type === "Pricing") prefix = "价格 | ";
    else if (type === "Service") prefix = "服务 | ";

    // Only add prefix to English title for CN display
    r["Subject (CN)"] = prefix + r["Subject (EN)"];
    enriched++;
  }
}

// ==================== 5. Fix Type for unknowns ====================
for (const r of records) {
  if (r.Type === "Unknown" || r.Type === "Other") {
    const id = r["eFlash ID"];
    if (id.startsWith("EF-L")) {
      r.Type = "Program";
      r.Division = "General";
    }
    if (id.startsWith("EF-B")) {
      r.Type = "Phase-out";
    }
  }
}

// ==================== 6. Write output ====================
console.log(`Enriched ${enriched} fields`);

// Convert back to AOA
const aoa = [header, ...records.map(r => header.map(h => r[h] || ""))];
const newWs = XLSX.utils.aoa_to_sheet(aoa);
newWs["!cols"] = [
  { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 8 },
  { wch: 60 }, { wch: 60 },
  { wch: 12 }, { wch: 12 }, { wch: 14 },
  { wch: 25 }, { wch: 25 }, { wch: 30 },
  { wch: 8 }, { wch: 60 }, { wch: 12 },
];

// Keep Guide sheet
const guideWs = wb.Sheets["Guide"];

const outWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(outWb, newWs, "eFlash Records");
XLSX.utils.book_append_sheet(outWb, guideWs, "Guide");
XLSX.writeFile(outWb, OUTPUT_FILE);

// ==================== 7. Stats ====================
const final = XLSX.utils.sheet_to_json(outWb.Sheets["eFlash Records"]);
const total = final.length;
console.log(`\nOutput: ${OUTPUT_FILE}`);
console.log(`Total: ${total} records`);

const stillMissing = {
  subjectEn: final.filter(r => !r["Subject (EN)"]).length,
  subjectCn: final.filter(r => !r["Subject (CN)"]).length,
  effectiveDate: final.filter(r => !r["Effective Date"]).length,
};
console.log("\nStill missing:");
for (const [k, v] of Object.entries(stillMissing)) {
  console.log(`  ${k}: ${v} (${Math.round(v/total*100)}%)`);
}

console.log("\n--- Records still missing both subjects ---");
final.filter(r => !r["Subject (EN)"] && !r["Subject (CN)"]).forEach(r => {
  console.log(r["eFlash ID"], "|", r.Type, "| PDF:", r["Has PDF"], "| Src:", r.Source);
});
