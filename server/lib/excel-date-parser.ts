/**
 * Shared Excel date parsing utilities.
 *
 * Excel stores dates as serial numbers (days since 1900-01-01, with the Lotus 1-2-3 leap-year bug).
 * These helpers convert Excel serial dates to either ISO date strings or Date objects.
 */

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30); // 1899-12-30 to account for Lotus bug

/** Parse an Excel cell value to an ISO date string (YYYY-MM-DD), or empty string. */
export function parseExcelDateToString(val: unknown): string {
  if (val == null || val === "") return "";
  if (typeof val === "number") {
    const d = new Date(EXCEL_EPOCH_MS + val * 86400 * 1000);
    return d.toISOString().split("T")[0];
  }
  const s = String(val).trim();
  if (/^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(s)) return s.replace(/\//g, "-");
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return s;
}

/** Parse an Excel cell value to a Date object, or null. */
export function parseExcelDateToDate(val: unknown): Date | null {
  if (val == null || val === "" || val === "－" || val === "-") return null;
  if (typeof val === "number") {
    const d = new Date(EXCEL_EPOCH_MS + val * 86400 * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  const str = String(val).trim().replace(/^\s+/, "");
  if (/^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(str)) {
    const d = new Date(str.replace(/\//g, "-"));
    return isNaN(d.getTime()) ? null : d;
  }
  if (/^\d{2}[/-]\d{1,2}[/-]\d{2,4}$/.test(str)) {
    const parts = str.split(/[/-]/);
    const normalized = parts[0].length === 2 ? `20${parts[0]}-${parts[1]}-${parts[2]}` : str;
    const d = new Date(normalized.replace(/\//g, "-"));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}
