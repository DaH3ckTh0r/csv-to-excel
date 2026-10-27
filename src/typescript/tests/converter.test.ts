import ExcelJS from "exceljs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildWorkbook, convertFile, decode } from "../src/converter.js";

const SAMPLE =
  'id,name,notes,amount,zip,active\r\n1,"Smith, John","line1\nline2",12.5,00123,true\r\n2,"Say ""hi""",,-3,90210,FALSE\r\n3,,x\r\n';

function values(ws: ExcelJS.Worksheet): unknown[][] {
  const out: unknown[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => out.push((row.values as unknown[]).slice(1)));
  return out;
}

describe("decode", () => {
  it("strips a UTF-8 BOM", () => {
    expect(decode(Buffer.from("﻿a,b", "utf8"))).toBe("a,b");
  });

  it("reads UTF-16 LE with BOM (PowerShell 5)", () => {
    const buf = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("á,b", "utf16le")]);
    expect(decode(buf)).toBe("á,b");
  });

  it("reads UTF-16 BE with BOM", () => {
    const le = Buffer.from("a,b", "utf16le");
    const be = Buffer.from(le).swap16();
    expect(decode(Buffer.concat([Buffer.from([0xfe, 0xff]), be]))).toBe("a,b");
  });

  it("honors an explicit encoding", () => {
    expect(decode(Buffer.from([0xe9]), "latin1")).toBe("é");
  });
});

describe("buildWorkbook", () => {
  it("converts values with type detection", () => {
    const { workbook, stats } = buildWorkbook(SAMPLE);
    const ws = workbook.getWorksheet("Sheet1")!;
    expect(stats).toMatchObject({ rows: 4, columns: 6, delimiter: "," });
    const rows = values(ws);
    expect(rows[0]).toEqual(["id", "name", "notes", "amount", "zip", "active"]);
    expect(rows[1]).toEqual([1, "Smith, John", "line1\nline2", 12.5, "00123", true]);
    expect(rows[2].slice(0, 2)).toEqual([2, 'Say "hi"']);
    expect(rows[2][5]).toBe(false);
  });

  it("keeps everything as text with types: false", () => {
    const { workbook } = buildWorkbook("a\n42", { types: false });
    expect(values(workbook.worksheets[0])[1]).toEqual(["42"]);
  });

  it("does not coerce the header row", () => {
    const { workbook } = buildWorkbook("2024,true\n1,2");
    expect(values(workbook.worksheets[0])[0]).toEqual(["2024", "true"]);
  });

  it("coerces the first row when header: false", () => {
    const { workbook } = buildWorkbook("2024,true\n1,2", { header: false });
    expect(values(workbook.worksheets[0])[0]).toEqual([2024, true]);
  });

  it("bolds, freezes and filters the header", () => {
    const ws = buildWorkbook(SAMPLE).workbook.worksheets[0];
    expect(ws.getRow(1).font?.bold).toBe(true);
    expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(ws.autoFilter).toBeTruthy();
  });

  it("creates an Excel table with unique headers", () => {
    const ws = buildWorkbook("id,id,\n1,2,3", { table: true }).workbook.worksheets[0];
    const table = ws.getTable("Data") as unknown as { table: { columns: { name: string }[] } };
    expect(table.table.columns.map((c) => c.name)).toEqual(["id", "id_2", "Column3"]);
  });

  it("uses the requested, sanitized sheet name", () => {
    const { workbook } = buildWorkbook("a", { sheet: "Ventas/2026" });
    expect(workbook.worksheets[0].name).toBe("Ventas_2026");
  });

  it("auto-detects semicolons", () => {
    expect(buildWorkbook("a;b\n1;2").stats.delimiter).toBe(";");
  });

  it("pads short rows to the widest row", () => {
    const { stats } = buildWorkbook("a,b,c\n1");
    expect(stats.columns).toBe(3);
  });

  it("warns about an unterminated quote", () => {
    expect(buildWorkbook('a,"b').stats.warnings).toHaveLength(1);
  });

  it("throws when the data exceeds Excel's sheet limits", () => {
    expect(() => buildWorkbook(Array(16_385).fill("x").join(","))).toThrow(/Too many/);
  });

  it("throws on empty input", () => {
    expect(() => buildWorkbook("\n\n")).toThrow(/empty/);
  });
});

describe("convertFile", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "csv2xlsx-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("writes a readable .xlsx file", async () => {
    const input = join(dir, "in.csv");
    const output = join(dir, "out.xlsx");
    await writeFile(input, SAMPLE);
    const stats = await convertFile(input, output);
    expect(stats.rows).toBe(4);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(output);
    expect(values(wb.worksheets[0])[1][1]).toBe("Smith, John");
  });
});
