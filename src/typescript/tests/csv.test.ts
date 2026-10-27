import { describe, expect, it, vi } from "vitest";
import { detectDelimiter, parseCsv } from "../src/csv.js";

describe("detectDelimiter", () => {
  it.each([
    ["a,b,c\n1,2,3", ","],
    ["a;b;c\n1;2;3", ";"],
    ["a\tb\tc", "\t"],
    ["a|b|c", "|"],
  ])("detects the delimiter in %j", (text, expected) => {
    expect(detectDelimiter(text)).toBe(expected);
  });

  it("ignores delimiters inside quotes", () => {
    expect(detectDelimiter('"x;y;z;w",b,c')).toBe(",");
  });

  it("only looks at the first line", () => {
    expect(detectDelimiter("a,b\n1;2;3;4;5")).toBe(",");
  });

  it("defaults to comma", () => {
    expect(detectDelimiter("single")).toBe(",");
  });
});

describe("parseCsv", () => {
  it("parses simple rows", () => {
    expect(parseCsv("a,b\n1,2").rows).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("handles quoted delimiters, escaped quotes and embedded newlines", () => {
    const { rows } = parseCsv('"Smith, John","Say ""hi""","line1\nline2"');
    expect(rows).toEqual([["Smith, John", 'Say "hi"', "line1\nline2"]]);
  });

  it("handles CRLF and CR line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r3,4").rows).toEqual([["a", "b"], ["1", "2"], ["3", "4"]]);
  });

  it("keeps empty fields, including leading and trailing ones", () => {
    expect(parseCsv(",a,,").rows).toEqual([["", "a", "", ""]]);
  });

  it("drops blank lines", () => {
    expect(parseCsv("a\n\n\nb\n\n").rows).toEqual([["a"], ["b"]]);
  });

  it("supports custom delimiters", () => {
    expect(parseCsv("a;b", ";").rows).toEqual([["a", "b"]]);
  });

  it("flags an unterminated quote", () => {
    expect(parseCsv('a,"open').unterminatedQuote).toBe(true);
  });

  it("rejects multi-character delimiters", () => {
    expect(() => parseCsv("a", ";;")).toThrow(/single character/);
  });

  it("reports progress ending at 1", () => {
    const spy = vi.fn();
    parseCsv("a,b\n".repeat(1000), ",", spy);
    const values = spy.mock.calls.map((c) => c[0] as number);
    expect(values.length).toBeGreaterThan(10);
    expect(values.at(-1)).toBe(1);
    expect(values).toEqual([...values].sort((x, y) => x - y));
  });
});
