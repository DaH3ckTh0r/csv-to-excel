/**
 * Cell value helpers: type coercion and Excel naming rules.
 */

export type CellValue = string | number | boolean | null;

const NUMBER_RE = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/;
// Control characters Excel rejects in cell values.
const ILLEGAL_CHARS_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f]/g;

/**
 * Convert text to number/boolean when it is safe to do so.
 * IDs and codes with leading zeros ("00123") and numbers with more than
 * 15 significant digits stay as text so Excel doesn't corrupt them.
 */
export function coerce(value: string): CellValue {
  const v = value.trim();
  if (v === "") return null;
  if (/^(true|false)$/i.test(v)) return v.toLowerCase() === "true";
  if (NUMBER_RE.test(v) && v.replace(/\D/g, "").length <= 15) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return value;
}

/** Remove control characters that make Excel reject the file. */
export function clean<T extends CellValue>(value: T): T {
  return (typeof value === "string" ? value.replace(ILLEGAL_CHARS_RE, "") : value) as T;
}

/** Excel sheet names: 1–31 chars, none of : \ / ? * [ ] */
export function sanitizeSheetName(name: string): string {
  return name.replace(/[:\\/?*[\]]/g, "_").slice(0, 31) || "Sheet1";
}

/** Excel tables require non-empty, unique header names. */
export function uniqueHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((raw, i) => {
    const h = raw.trim() || `Column${i + 1}`;
    const n = (seen.get(h) ?? 0) + 1;
    seen.set(h, n);
    return n > 1 ? `${h}_${n}` : h;
  });
}
