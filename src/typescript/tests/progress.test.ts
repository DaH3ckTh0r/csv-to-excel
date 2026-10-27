import { describe, expect, it } from "vitest";
import { ProgressBar, phase } from "../src/progress.js";

function fakeStream(isTTY = true) {
  const out: string[] = [];
  return { out, stream: { isTTY, write: (s: string) => (out.push(s), true) } };
}

describe("ProgressBar.format", () => {
  it("renders an empty bar", () => {
    expect(ProgressBar.format(0, "Parsing", 10, 0)).toBe("Parsing  [░░░░░░░░░░]   0% · 0.0s");
  });

  it("renders a half bar", () => {
    expect(ProgressBar.format(50, "Parsing", 10, 1234)).toBe("Parsing  [█████░░░░░]  50% · 1.2s");
  });

  it("renders a full bar", () => {
    expect(ProgressBar.format(100, "Done", 4, 0)).toBe("Done     [████] 100% · 0.0s");
  });
});

describe("ProgressBar", () => {
  it("draws nothing when the stream is not a TTY", () => {
    const { out, stream } = fakeStream(false);
    const bar = new ProgressBar({ stream });
    bar.update(0.5, "Parsing");
    bar.finish();
    expect(out).toEqual([]);
  });

  it("draws on a single line and ends with a newline", () => {
    const { out, stream } = fakeStream();
    const bar = new ProgressBar({ stream, width: 10, throttleMs: 0 });
    bar.update(0.25, "Parsing");
    bar.update(0.5, "Parsing");
    bar.finish();
    expect(out.every((s, i) => (i === out.length - 1 ? s === "\n" : s.startsWith("\r")))).toBe(
      true,
    );
    expect(out.at(-2)).toContain("100%");
  });

  it("skips redraws when the percentage hasn't changed", () => {
    const { out, stream } = fakeStream();
    const bar = new ProgressBar({ stream, throttleMs: 0 });
    bar.update(0.501, "Parsing");
    bar.update(0.502, "Parsing");
    bar.update(0.509, "Parsing");
    expect(out).toHaveLength(1);
  });

  it("clamps values outside 0..1", () => {
    const { out, stream } = fakeStream();
    const bar = new ProgressBar({ stream, throttleMs: 0 });
    bar.update(5, "X");
    expect(out[0]).toContain("100%");
  });

  it("abort ends the line only if something was drawn", () => {
    const a = fakeStream();
    new ProgressBar({ stream: a.stream }).abort();
    expect(a.out).toEqual([]);

    const b = fakeStream();
    const bar = new ProgressBar({ stream: b.stream, throttleMs: 0 });
    bar.update(0.3, "Parsing");
    bar.abort();
    expect(b.out.at(-1)).toBe("\n");
    expect(b.out.join("")).not.toContain("100%");
  });

  it("ignores updates after finish", () => {
    const { out, stream } = fakeStream();
    const bar = new ProgressBar({ stream, throttleMs: 0 });
    bar.finish();
    const count = out.length;
    bar.update(0.3, "Late");
    expect(out).toHaveLength(count);
  });
});

describe("phase", () => {
  it("maps sub-progress into a slice of the overall bar", () => {
    const { out, stream } = fakeStream();
    const bar = new ProgressBar({ stream, throttleMs: 0 });
    const report = phase(bar, 0.4, 0.8, "Building");
    report(0.5);
    expect(out[0]).toContain(" 60%");
    expect(out[0]).toContain("Building");
  });

  it("is a no-op without a bar", () => {
    expect(() => phase(undefined, 0, 1, "x")(0.5)).not.toThrow();
  });
});
