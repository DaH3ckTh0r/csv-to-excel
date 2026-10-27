import { describe, expect, it } from "vitest";
import { clean, coerce, sanitizeSheetName, uniqueHeaders } from "../src/values.js";

describe("coerce", () => {
  it.each([
    ["42", 42],
    ["-3", -3],
    ["12.5", 12.5],
    ["0", 0],
    ["0.75", 0.75],
    ["1e3", 1000],
    ["true", true],
    ["FALSE", false],
    ["", null],
    ["   ", null],
  ])("converts %j to %j", (input, expected) => {
    expect(coerce(input)).toBe(expected);
  });

  it.each(["00123", "1234567890123456", "12,5", "1.2.3", "abc", "+5", "$10", "1 000"])(
    "keeps %j as text",
    (input) => {
      expect(coerce(input)).toBe(input);
    },
  );
});

describe("clean", () => {
  it("removes control characters but keeps newlines and tabs", () => {
    expect(clean("a\x00b\x07c\nd\te")).toBe("abc\nd\te");
  });

  it("leaves non-strings alone", () => {
    expect(clean(5)).toBe(5);
    expect(clean(null)).toBeNull();
  });
});

describe("sanitizeSheetName", () => {
  it("replaces forbidden characters", () => {
    expect(sanitizeSheetName("Q1/Q2: [draft]?")).toBe("Q1_Q2_ _draft__");
  });

  it("truncates to 31 characters", () => {
    expect(sanitizeSheetName("x".repeat(50))).toHaveLength(31);
  });

  it("falls back to Sheet1 when empty", () => {
    expect(sanitizeSheetName("")).toBe("Sheet1");
  });
});

describe("uniqueHeaders", () => {
  it("fills blanks and de-duplicates", () => {
    expect(uniqueHeaders(["id", "", "id", "name", "id"])).toEqual([
      "id",
      "Column2",
      "id_2",
      "name",
      "id_3",
    ]);
  });
});
