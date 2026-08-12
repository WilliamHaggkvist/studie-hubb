import { format, parseISO, isValid } from "date-fns";

/**
 * Formaterar ett datum (ISO, YYYY-MM-DD eller Date-objekt) till yyyy-mm-dd (t.ex. 2024-10-15).
 */
export function formatDateYYYYMMDD(
  dateInput: string | Date | null | undefined,
  fallback: string = "Saknar datum"
): string {
  if (!dateInput) return fallback;
  try {
    if (typeof dateInput === "string") {
      const str = dateInput.trim();
      if (!str) return fallback;

      // Om redan i yyyy-mm-dd format
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
      if (/^\d{4}\/\d{2}\/\d{2}$/.test(str)) return str.replace(/\//g, "-");
      if (/^\d{4}\.\d{2}\.\d{2}$/.test(str)) return str.replace(/\./g, "-");

      // Om i dd-mm-yyyy format
      if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
        const [d, m, y] = str.split("-");
        return `${y}-${m}-${d}`;
      }

      const isoParsed = parseISO(str.length === 10 ? `${str}T00:00:00` : str);
      if (isValid(isoParsed)) return format(isoParsed, "yyyy-MM-dd");

      const directParsed = new Date(str);
      if (isValid(directParsed) && !isNaN(directParsed.getTime())) {
        return format(directParsed, "yyyy-MM-dd");
      }
      return str;
    } else if (isValid(dateInput)) {
      return format(dateInput, "yyyy-MM-dd");
    }
  } catch {
    // fallback
  }
  return typeof dateInput === "string" ? dateInput : fallback;
}

/**
 * Tolkar användarinmatning i format som yyyy-mm-dd, dd-mm-yyyy, dd/mm/yyyy, dd.mm.yyyy
 * och returnerar standard ISO YYYY-MM-DD för lagring i databasen.
 */
export function parseDateInputToISO(input: string | null | undefined): string | null {
  if (!input) return null;
  const str = input.trim();
  if (!str) return null;

  // Format: YYYY-MM-DD, YYYY/MM/YYYY, YYYY.MM.DD (t.ex. 2024-10-15)
  const yyyymmddMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (yyyymmddMatch) {
    const year = yyyymmddMatch[1];
    const month = yyyymmddMatch[2].padStart(2, "0");
    const day = yyyymmddMatch[3].padStart(2, "0");
    const isoCandidate = `${year}-${month}-${day}`;
    const d = new Date(`${isoCandidate}T00:00:00`);
    if (isValid(d) && !isNaN(d.getTime())) return isoCandidate;
  }

  // Format: DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY (t.ex. 15-10-2024, 15/10/2024, 15.10.2024)
  const ddmmyyyyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (ddmmyyyyMatch) {
    const day = ddmmyyyyMatch[1].padStart(2, "0");
    const month = ddmmyyyyMatch[2].padStart(2, "0");
    const year = ddmmyyyyMatch[3];
    const isoCandidate = `${year}-${month}-${day}`;
    const d = new Date(`${isoCandidate}T00:00:00`);
    if (isValid(d) && !isNaN(d.getTime())) return isoCandidate;
  }

  // Fallback vanlig Date parse
  const d = new Date(str);
  if (isValid(d) && !isNaN(d.getTime())) {
    return format(d, "yyyy-MM-dd");
  }

  return null;
}
