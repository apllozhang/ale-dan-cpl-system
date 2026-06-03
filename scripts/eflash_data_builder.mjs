import XLSX from "xlsx";
import fs from "fs";
import path from "path";

const TRACKING_FILE = "G:/市场部/eFlash/China-eFlash-tracking-sheetlist.xlsx";
const ARCHIVE_DIR = "G:/市场部/eFlash/存档";
const OUTPUT_FILE = "G:/市场部/eFlash/eFlash-合并数据表.xlsx";

// ==================== 1. Read tracking sheet ====================
console.log("Reading tracking sheet...");
const wb = XLSX.readFile(TRACKING_FILE);

const TYPE_NORMALIZE = {
  "phase-in": "Phase-in",
  "phase_in": "Phase-in",
  "phase-out": "Phase-out",
  "phase_out": "Phase-out",
  "service": "Service",
  "pricing": "Pricing",
  "program": "Program",
};

function parseDate(val) {
  if (val == null || val === "" || val === "－" || val === "-") return "";
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    return "";
  }
  const s = String(val).trim();
  if (/^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(s)) return s.replace(/\//g, "-");
  if (/^\d{2}[/-]\d{1,2}[/-]\d{2,4}$/.test(s)) {
    const parts = s.split(/[/-]/);
    const y = parts[0].length === 2 ? `20${parts[0]}` : parts[0];
    return `${y}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
  }
  return s;
}

function deriveFromPrefix(eflashId, divisionCol) {
  const prefix = eflashId.match(/^EF-([A-Z])/)?.[1] || "";
  let division = "General";
  let scope = "Global";
  if (prefix === "Z") {
    scope = "China";
    division = String(divisionCol || "").toLowerCase().includes("network") ? "Network" : "Communications";
  } else if (prefix === "N") {
    division = "Network";
    scope = "Global";
  } else if (prefix === "C") {
    division = "Communications";
    scope = "Global";
  } else if (prefix === "S" || prefix === "P") {
    division = String(divisionCol || "").toLowerCase().includes("network") ? "Network" : "General";
    scope = "Global";
  }
  return { division, scope };
}

const records = [];

for (const sheetName of ["China", "NET Global", "COMM Global"]) {
  const ws = wb.Sheets[sheetName];
  if (!ws) continue;
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 4) continue;

    const eflashId = String(row[3] || "").trim().replace(/\s+/g, "");
    if (!eflashId.startsWith("EF-")) continue;

    const typeRaw = String(row[1] || "").trim();
    const type = TYPE_NORMALIZE[typeRaw.toLowerCase()] || typeRaw;
    let { division, scope } = deriveFromPrefix(eflashId, row[0]);
    // Override from sheet context
    const divCol = String(row[0] || "").trim();
    if (divCol.toLowerCase().includes("network")) division = "Network";
    else if (divCol.toLowerCase().includes("comm")) division = "Communications";
    // Override scope from column
    const scopeCol = String(row[2] || "").trim();
    if (scopeCol === "China") scope = "China";
    else if (scopeCol === "Global") scope = "Global";

    records.push({
      eflashId,
      type,
      division,
      scope,
      subjectEn: String(row[4] || "").trim(),
      subjectCn: String(row[5] || "").trim(),
      globalDate: parseDate(row[6]),
      chinaDate: parseDate(row[7]),
      effectiveDate: parseDate(row[8]),
      authorEn: String(row[9] || "").trim(),
      authorCn: String(row[10] || "").trim(),
      comments: String(row[11] || "").trim(),
      sourceSheet: sheetName,
      hasPdf: "",
      pdfPath: "",
    });
  }
}

console.log(`Parsed ${records.length} records from tracking sheet`);

// ==================== 2. Scan archive for PDFs ====================
console.log("Scanning archive folder...");

const pdfMap = {}; // eflashId -> [{fileName, path, size}]

function scanDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(full);
    } else if (/\.pdf$/i.test(entry.name)) {
      const match = entry.name.match(/EF-([A-Z]\d+)/i);
      if (match) {
        const id = ("EF-" + match[1].toUpperCase()).replace(/\s+/g, "");
        if (!pdfMap[id]) pdfMap[id] = [];
        pdfMap[id].push({
          fileName: entry.name,
          relativePath: path.relative(ARCHIVE_DIR, full).replace(/\\/g, "/"),
          size: fs.statSync(full).size,
        });
      }
    }
  }
}
scanDir(ARCHIVE_DIR);

const pdfIds = Object.keys(pdfMap);
console.log(`Found ${pdfIds.length} unique eFlash IDs with PDF files`);

// ==================== 3. Merge: link PDFs to records ====================
for (const r of records) {
  const pdfs = pdfMap[r.eflashId];
  if (pdfs && pdfs.length > 0) {
    r.hasPdf = "Yes";
    // Prefer CN version, then any PDF
    const cn = pdfs.find(p => p.fileName.includes("-CN"));
    r.pdfPath = cn ? cn.relativePath : pdfs[0].relativePath;
  }
}

// ==================== 4. Find PDFs NOT in tracking sheet ====================
const trackedIds = new Set(records.map(r => r.eflashId));
let newFromPdf = 0;

for (const [id, pdfs] of Object.entries(pdfMap)) {
  if (trackedIds.has(id)) continue;

  // Derive metadata from file name
  const fileName = pdfs[0].fileName;
  let type = "Unknown";
  const fnLower = fileName.toLowerCase();
  if (fnLower.includes("phase-in") || fnLower.includes("phase_in")) type = "Phase-in";
  else if (fnLower.includes("phase-out") || fnLower.includes("phase_out")) type = "Phase-out";
  else if (fnLower.includes("pricing") || fnLower.includes("price")) type = "Pricing";
  else if (fnLower.includes("service")) type = "Service";

  const { division, scope } = deriveFromPrefix(id, "");

  // Extract subject from filename
  const subjectMatch = fileName.match(/(?:EF-[A-Z]\d+[-_]\s*)(.+?)(?:\.(?:pdf|docx?))/i);
  const subject = subjectMatch ? subjectMatch[1].replace(/[-_]/g, " ").trim() : fileName.replace(/\.pdf$/i, "");

  const cnPdf = pdfs.find(p => p.fileName.includes("-CN"));

  records.push({
    eflashId: id,
    type,
    division,
    scope,
    subjectEn: "",
    subjectCn: subject.includes("Omni") || subject.includes("ALE") ? subject : "",
    globalDate: "",
    chinaDate: "",
    effectiveDate: "",
    authorEn: "",
    authorCn: "",
    comments: "From archive PDF (auto-extracted)",
    sourceSheet: "Archive",
    hasPdf: "Yes",
    pdfPath: cnPdf ? cnPdf.relativePath : pdfs[0].relativePath,
  });
  newFromPdf++;
}

console.log(`Added ${newFromPdf} records from archive PDFs not in tracking sheet`);

// ==================== 5. Sort records ====================
records.sort((a, b) => {
  const ma = a.eflashId.match(/EF-([A-Z])(\d+)/);
  const mb = b.eflashId.match(/EF-([A-Z])(\d+)/);
  if (!ma || !mb) return a.eflashId.localeCompare(b.eflashId);
  if (ma[1] !== mb[1]) return ma[1] < mb[1] ? -1 : 1;
  return Number(ma[2]) - Number(mb[2]);
});

// ==================== 6. Write output Excel ====================
console.log("Writing output file...");

const header = [
  "eFlash ID", "Type", "Division", "Scope",
  "Subject (EN)", "Subject (CN)",
  "Global Date", "China Date", "Effective Date",
  "Author (EN)", "Author (CN)", "Comments",
  "Has PDF", "PDF Path", "Source",
];

const rows = records.map(r => [
  r.eflashId, r.type, r.division, r.scope,
  r.subjectEn, r.subjectCn,
  r.globalDate, r.chinaDate, r.effectiveDate,
  r.authorEn, r.authorCn, r.comments,
  r.hasPdf, r.pdfPath, r.sourceSheet,
]);

const wsData = [header, ...rows];
const ws = XLSX.utils.aoa_to_sheet(wsData);

// Set column widths
ws["!cols"] = [
  { wch: 14 },  // eFlash ID
  { wch: 12 },  // Type
  { wch: 16 },  // Division
  { wch: 8 },   // Scope
  { wch: 60 },  // Subject EN
  { wch: 60 },  // Subject CN
  { wch: 12 },  // Global Date
  { wch: 12 },  // China Date
  { wch: 12 },  // Effective Date
  { wch: 25 },  // Author EN
  { wch: 25 },  // Author CN
  { wch: 30 },  // Comments
  { wch: 8 },   // Has PDF
  { wch: 60 },  // PDF Path
  { wch: 12 },  // Source
];

const outWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(outWb, ws, "eFlash Records");

// Add a "Guide" sheet
const guideWs = XLSX.utils.aoa_to_sheet([
  ["eFlash 合并数据表 — 使用说明"],
  [""],
  ["此文件由脚本自动生成，合并了以下数据源："],
  ["1. China-eFlash-tracking-sheetlist.xlsx 的 3 个 Sheet（China、NET Global、COMM Global）"],
  ["2. 存档文件夹中的 PDF 文件名解析"],
  [""],
  ["列说明："],
  ["eFlash ID", "编号，如 EF-Z001、EF-N140、EF-C143"],
  ["Type", "类型：Phase-in / Phase-out / Service / Pricing / Program"],
  ["Division", "产品线：Communications / Network / General"],
  ["Scope", "范围：Global / China"],
  ["Subject (EN)", "英文标题"],
  ["Subject (CN)", "中文标题"],
  ["Global Date", "全球发布日期"],
  ["China Date", "中国发布日期"],
  ["Effective Date", "生效日期"],
  ["Author (EN)", "英文版作者"],
  ["Author (CN)", "中文版译者/作者"],
  ["Comments", "备注"],
  ["Has PDF", "是否有关联 PDF 文件"],
  ["PDF Path", "PDF 文件相对路径（相对于存档目录）"],
  ["Source", "数据来源：China / NET Global / COMM Global / Archive"],
  [""],
  ["使用方式："],
  ["1. 手动编辑：直接在此文件中补充缺失的信息（标题、日期等）"],
  ["2. 批量导入：在 eFlash 管理页面点击「导入 Excel」，选择此文件即可"],
  ["3. 导入时系统会自动识别 eFlash ID 前缀来设置 Division 和 Scope"],
  [""],
  ["统计："],
  ["总记录数", records.length],
  ["来自 Tracking Sheet", records.filter(r => r.sourceSheet !== "Archive").length],
  ["来自 Archive PDF", newFromPdf],
  ["有 PDF 附件", records.filter(r => r.hasPdf === "Yes").length],
  ["缺少 PDF", records.filter(r => r.hasPdf !== "Yes").length],
]);
guideWs["!cols"] = [{ wch: 20 }, { wch: 80 }];
XLSX.utils.book_append_sheet(outWb, guideWs, "Guide");

XLSX.writeFile(outWb, OUTPUT_FILE);

console.log(`\nDone! Output: ${OUTPUT_FILE}`);
console.log(`Total: ${records.length} records`);

// Print summary by type
const byType = {};
for (const r of records) {
  byType[r.type] = (byType[r.type] || 0) + 1;
}
console.log("\nBy Type:");
for (const [t, c] of Object.entries(byType).sort((a,b) => b[1]-a[1])) {
  console.log(`  ${t}: ${c}`);
}

const byScope = {};
for (const r of records) {
  byScope[r.scope] = (byScope[r.scope] || 0) + 1;
}
console.log("\nBy Scope:");
for (const [s, c] of Object.entries(byScope)) {
  console.log(`  ${s}: ${c}`);
}
