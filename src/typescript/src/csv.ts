/**
 * CSV parsing utilities (RFC 4180).
 */

export const CANDIDATE_DELIMITERS = [",", ";", "\t", "|"] as const;

/** Callback receiving the fraction (0..1) of the input processed so far. */
export type ProgressCallback = (fraction: number) => void;

/** Pick the most frequent candidate delimiter on the first line (outside quotes). */
export function detectDelimiter(text: string): string {
  const counts = new Map<string, number>(CANDIDATE_DELIMITERS.map((c) => [c, 0]));
  let inQuotes = false;
  for (const ch of text) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === "\n" || ch === "\r")) break;
    else if (!inQuotes && counts.has(ch)) counts.set(ch, counts.get(ch)! + 1);
  }
  let best = ",";
  for (const [c, n] of counts) if (n > counts.get(best)!) best = c;
  return best;
}

export interface ParseResult {
  rows: string[][];
  /** True when the input ended inside a quoted field. */
  unterminatedQuote: boolean;
}

/**
 * Parse CSV text with a state machine. Handles quoted fields containing
 * delimiters, newlines (LF, CRLF, CR) and escaped quotes ("").
 * Fully empty lines are dropped.
 */
export function parseCsv(
  text: string,
  delimiter = ",",
  onProgress?: ProgressCallback,
): ParseResult {
  if (delimiter.length !== 1) throw new Error("Delimiter must be a single character");

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const total = text.length;
  const step = Math.max(1, Math.floor(total / 200)); // ~200 progress updates max

  const endRow = () => {
    row.push(field);
    field = "";
    if (!(row.length === 1 && row[0] === "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < total; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"' && field === "") {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endRow();
    } else {
      field += ch;
    }
    if (onProgress && i % step === 0) onProgress(i / total);
  }

  if (field !== "" || row.length > 0) endRow();
  onProgress?.(1);
  return { rows, unterminatedQuote: inQuotes };
}
