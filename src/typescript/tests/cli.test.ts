import { describe, expect, it } from "vitest";
import { parseCliArgs, UsageError } from "../src/cli.js";

describe("parseCliArgs", () => {
  it("derives the output name from the input", () => {
    expect(parseCliArgs(["data/report.csv"])).toMatchObject({
      input: "data/report.csv",
      output: "report.xlsx",
      sheet: "Sheet1",
      types: true,
      header: true,
      table: false,
      quiet: false,
    });
  });

  it("uses output.xlsx for stdin", () => {
    expect(parseCliArgs(["-"])).toMatchObject({ input: "-", output: "output.xlsx" });
  });

  it("parses all options", () => {
    expect(
      parseCliArgs([
        "in.csv",
        "out.xlsx",
        "-d",
        ";",
        "--sheet",
        "Ventas",
        "--no-types",
        "--no-header",
        "--table",
        "-q",
      ]),
    ).toMatchObject({
      output: "out.xlsx",
      delimiter: ";",
      sheet: "Ventas",
      types: false,
      header: false,
      table: true,
      quiet: true,
    });
  });

  it.each(["tab", "TAB", "\\t"])("accepts %j as a tab delimiter", (d) => {
    expect(parseCliArgs(["in.csv", "-d", d])).toMatchObject({ delimiter: "\t" });
  });

  it("returns help and version markers", () => {
    expect(parseCliArgs(["--help"])).toBe("help");
    expect(parseCliArgs(["-v"])).toBe("version");
  });

  it("rejects missing input", () => {
    expect(() => parseCliArgs([])).toThrow(UsageError);
  });

  it("rejects bad delimiters", () => {
    expect(() => parseCliArgs(["in.csv", "-d", ";;"])).toThrow(/single character/);
  });

  it("rejects too many arguments", () => {
    expect(() => parseCliArgs(["a", "b", "c"])).toThrow(/Too many/);
  });

  it("rejects unknown options", () => {
    expect(() => parseCliArgs(["in.csv", "--bogus"])).toThrow();
  });
});
