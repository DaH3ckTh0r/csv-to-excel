/**
 * Core conversion logic: CSV text → ExcelJS workbook → .xlsx file.
 * Kept free of CLI concerns so it can be unit tested and reused as a library.
 */
import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";
import { detectDelimiter, parseCsv } from "./csv.js";
import { ProgressBar, phase } from "./progress.js";
import { clean, coerce, sanitizeSheetName, uniqueHeaders, type CellValue } from "./values.js";

/** Excel's per-sheet limits. */
export const MAX_ROWS = 1_048_576;
export const MAX_COLS = 16_384;

export interface ConvertOptions {
  /** Field delimiter; auto-detected when omitted. */
  delimiter?: string;
  sheet?: string;
  /** Detect numbers and booleans (default true). */
  types?: boolean;
  /** Treat the first row as a header (default true). */
  header?: boolean;
  /** Format the data as an Excel table (default false). */
  table?: boolean;
}

export interface ConvertStats {
  rows: number;
  columns: number;
  delimiter: string;
  warnings: string[];
}

/** Decode raw bytes: honors UTF-16 BOMs (PowerShell 5 redirection) and strips UTF-8 BOM. */
export function decode(buf: Buffer, encoding?: BufferEncoding): string {
  if (encoding) return buf.toString(encoding).replace(/^﻿/, "");
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString("utf16le");
  if (buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.from(buf.subarray(2));
    swapped.swap16();
    return swapped.toString("utf16le");
  }
  return buf.toString("utf8").replace(/^﻿/, "");
}

/** Build a workbook in memory from CSV text. */
export function buildWorkbook(
  text: string,
  options: ConvertOptions = {},
  bar?: ProgressBar,
): { workbook: ExcelJS.Workbook; stats: ConvertStats } {
  const { types = true, header = true, table = false } = options;
  const delimiter = options.delimiter ?? detectDelimiter(text);
  const warnings: string[] = [];

  const { rows, unterminatedQuote } = parseCsv(text, delimiter, phase(bar, 0.05, 0.45, "Parsing"));
  if (unterminatedQuote) warnings.push("Unterminated quoted field at end of input");
  if (rows.length === 0) throw new Error("Input is empty");

  const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
  if (rows.length > MAX_ROWS || width > MAX_COLS) {
    throw new Error(
      `Too many rows for one Excel sheet: ${rows.length.toLocaleString()} rows × ${width} cols ` +
        `(max ${MAX_ROWS.toLocaleString()} × ${MAX_COLS.toLocaleString()})`,
    );
  }
  const report = phase(bar, 0.45, 0.85, "Building");
  const step = Math.max(1, Math.floor(rows.length / 200));

  const data: CellValue[][] = rows.map((r, i) => {
    if (i % step === 0) report(i / rows.length);
    const isHeader = header && i === 0;
    const out: CellValue[] = new Array(width);
    for (let c = 0; c < width; c++) {
      const raw = r[c] ?? "";
      out[c] = clean(types && !isHeader ? coerce(raw) : raw);
    }
    return out;
  });
  report(1);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "csv-to-excel";
  const ws = workbook.addWorksheet(sanitizeSheetName(options.sheet ?? "Sheet1"));

  if (table) {
    const headers = uniqueHeaders(
      header ? data[0].map((h) => String(h ?? "")) : Array<string>(width).fill(""),
    );
    const body = header ? data.slice(1) : data;
    ws.addTable({
      name: "Data",
      ref: "A1",
      headerRow: true,
      style: { theme: "TableStyleMedium2", showRowStripes: true },
      columns: headers.map((name) => ({ name, filterButton: true })),
      rows: body.length ? body : [Array(width).fill(null)],
    });
  } else {
    ws.addRows(data);
    if (header) {
      ws.getRow(1).font = { bold: true };
      ws.views = [{ state: "frozen", ySplit: 1 }];
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: width } };
    }
  }

  // Auto-fit column widths (capped at 60).
  for (let c = 0; c < width; c++) {
    let max = 8;
    for (const r of data) {
      const v = r[c];
      if (v === null || v === undefined) continue;
      for (const line of String(v).split("\n")) if (line.length > max) max = line.length;
    }
    ws.getColumn(c + 1).width = Math.min(max + 2, 60);
  }

  return { workbook, stats: { rows: rows.length, columns: width, delimiter, warnings } };
}

/** Convert CSV text and write the .xlsx file. */
export async function convertText(
  text: string,
  outputPath: string,
  options: ConvertOptions = {},
  bar?: ProgressBar,
): Promise<ConvertStats> {
  const { workbook, stats } = buildWorkbook(text, options, bar);
  bar?.update(0.85, "Saving");
  await workbook.xlsx.writeFile(outputPath);
  bar?.finish("Done");
  return stats;
}

/** Convert a CSV file on disk to an .xlsx file. */
export async function convertFile(
  inputPath: string,
  outputPath: string,
  options: ConvertOptions & { encoding?: BufferEncoding } = {},
  bar?: ProgressBar,
): Promise<ConvertStats> {
  bar?.update(0, "Reading");
  const text = decode(await readFile(inputPath), options.encoding);
  return convertText(text, outputPath, options, bar);
}
