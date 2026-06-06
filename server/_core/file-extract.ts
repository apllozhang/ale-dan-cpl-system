import fs from "fs/promises";

const MAX_TEXT_LENGTH = 120_000; // ~30K tokens (4 chars/token avg)

function truncateText(text: string): string {
  if (text.length <= MAX_TEXT_LENGTH) return text;
  return text.slice(0, MAX_TEXT_LENGTH) + "\n\n[... 文本过长，已截断 ...]";
}

/**
 * Extract text from a file based on its extension.
 * Supports: pdf, docx, xlsx, txt, csv
 */
export async function extractText(
  filePath: string,
  fileType: string
): Promise<string> {
  const ext = fileType.toLowerCase().replace(".", "");

  switch (ext) {
    case "pdf":
      return extractPdf(filePath);
    case "docx":
    case "doc":
      return extractDocx(filePath);
    case "xlsx":
    case "xls":
      return extractXlsx(filePath);
    case "txt":
    case "csv":
      return extractPlainText(filePath);
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}

async function extractPdf(filePath: string): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const buffer = await fs.readFile(filePath);
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  await parser.destroy();
  return truncateText(result.text);
}

async function extractDocx(filePath: string): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ path: filePath });
  return truncateText(result.value);
}

async function extractXlsx(filePath: string): Promise<string> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.readFile(filePath);
  const parts: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    parts.push(`=== Sheet: ${sheetName} ===\n${csv}`);
  }
  return truncateText(parts.join("\n\n"));
}

async function extractPlainText(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath, "utf-8");
  return truncateText(content);
}
