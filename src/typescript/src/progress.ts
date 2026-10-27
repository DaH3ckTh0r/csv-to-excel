/**
 * Minimal, dependency-free console progress bar.
 *
 *   Parsing  [██████████████░░░░░░░░░░░░░░░░]  47% · 1.2s
 *
 * Renders on a single line using \r, only when the stream is a TTY,
 * and throttles redraws so it never slows down the conversion.
 */

export interface ProgressStream {
  write(chunk: string): boolean;
  isTTY?: boolean;
  columns?: number;
}

export interface ProgressBarOptions {
  stream?: ProgressStream;
  width?: number;
  /** Minimum milliseconds between redraws. */
  throttleMs?: number;
  /** Force rendering even when the stream is not a TTY (used in tests). */
  force?: boolean;
}

export class ProgressBar {
  private readonly stream: ProgressStream;
  private readonly width: number;
  private readonly throttleMs: number;
  private readonly enabled: boolean;
  private readonly start = Date.now();
  private lastDraw = 0;
  private lastPercent = -1;
  private label = "";
  private finished = false;

  constructor(opts: ProgressBarOptions = {}) {
    this.stream = opts.stream ?? process.stderr;
    this.width = opts.width ?? 30;
    this.throttleMs = opts.throttleMs ?? 50;
    this.enabled = opts.force ?? Boolean(this.stream.isTTY);
  }

  /** Update to an overall fraction (0..1) with the current phase label. */
  update(fraction: number, label = this.label): void {
    if (!this.enabled || this.finished) return;
    const pct = Math.max(0, Math.min(100, Math.floor(fraction * 100)));
    const now = Date.now();
    const labelChanged = label !== this.label;
    this.label = label;
    if (!labelChanged && pct === this.lastPercent) return;
    if (!labelChanged && pct < 100 && now - this.lastDraw < this.throttleMs) return;
    this.lastDraw = now;
    this.lastPercent = pct;
    this.stream.write("\r" + ProgressBar.format(pct, this.label, this.width, now - this.start));
  }

  /** Draw 100% and move to a new line. */
  finish(label = "Done"): void {
    if (!this.enabled || this.finished) return;
    this.lastPercent = -1;
    this.update(1, label);
    this.finished = true;
    this.stream.write("\n");
  }

  /** Stop without drawing 100% (e.g. on error), leaving the cursor on a fresh line. */
  abort(): void {
    if (!this.enabled || this.finished) return;
    this.finished = true;
    if (this.lastPercent >= 0) this.stream.write("\n");
  }

  /** Pure formatter, exported for unit testing. */
  static format(percent: number, label: string, width: number, elapsedMs: number): string {
    const filled = Math.round((percent / 100) * width);
    const bar = "█".repeat(filled) + "░".repeat(width - filled);
    const secs = (elapsedMs / 1000).toFixed(1);
    return `${label.padEnd(9)}[${bar}] ${String(percent).padStart(3)}% · ${secs}s`;
  }
}

/**
 * Maps a sub-task's 0..1 progress into a slice of the overall bar.
 * e.g. phase(bar, 0.0, 0.4, "Parsing") covers 0%–40%.
 */
export function phase(
  bar: ProgressBar | undefined,
  from: number,
  to: number,
  label: string,
): (fraction: number) => void {
  return (f) => bar?.update(from + (to - from) * f, label);
}
