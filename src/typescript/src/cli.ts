#!/usr/bin/env node
/**
 * csv2xlsx command-line entry point.
 */
import { basename, extname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { convertText, decode, type ConvertOptions } from "./converter.js";
import { ProgressBar } from "./progress.js";
import { readFile } from "node:fs/promises";
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const HELP = `csv2xlsx — convert a CSV file to an Excel workbook.

Usage:
  csv2xlsx <input.csv|-> [output.xlsx] [options]

Options:
  -d, --delimiter <char>   Field delimiter (default: auto-detect , ; tab |)
  -s, --sheet <name>       Worksheet name (default: Sheet1)
  -e, --encoding <enc>     Input encoding (default: auto, UTF-8/UTF-16)
      --no-types           Keep every cell as text (no number/boolean detection)
      --no-header          Don't treat the first row as a header
      --table              Format the data as an Excel table (with filters)
  -q, --quiet              No progress bar or summary
  -h, --help               Show this help
  -v, --version            Show version

Examples:
  csv2xlsx data.csv
  csv2xlsx data.csv report.xlsx --sheet Ventas --table
  type data.csv | csv2xlsx - out.xlsx      (cmd / PowerShell)
  cat data.csv  | csv2xlsx - out.xlsx      (bash)`;

export interface CliArgs extends ConvertOptions {
  input: string;
  output: string;
  encoding?: BufferEncoding;
  quiet: boolean;
}

export class UsageError extends Error {}

/** Parse argv (without node and script path). Returns null when help/version was printed. */
export function parseCliArgs(argv: string[]): CliArgs | "help" | "version" {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    allowNegative: true,
    options: {
      delimiter: { type: "string", short: "d" },
      sheet: { type: "string", short: "s", default: "Sheet1" },
      encoding: { type: "string", short: "e" },
      types: { type: "boolean", default: true },
      header: { type: "boolean", default: true },
      table: { type: "boolean", default: false },
      quiet: { type: "boolean", short: "q", default: false },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
    },
  });

  if (values.help) return "help";
  if (values.version) return "version";
  if (positionals.length === 0) throw new UsageError("No input file given");
  if (positionals.length > 2) throw new UsageError("Too many arguments");

  let delimiter = values.delimiter;
  if (delimiter !== undefined) {
    if (delimiter === "\\t" || delimiter.toLowerCase() === "tab") delimiter = "\t";
    if (delimiter.length !== 1) throw new UsageError("Delimiter must be a single character");
  }

  const input = positionals[0];
  const output =
    positionals[1] ?? (input === "-" ? "output.xlsx" : basename(input, extname(input)) + ".xlsx");

  return {
    input,
    output,
    delimiter,
    sheet: values.sheet,
    encoding: values.encoding as BufferEncoding | undefined,
    types: values.types,
    header: values.header,
    table: values.table,
    quiet: values.quiet,
  };
}

async function readStdin(): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

export async function run(argv: string[]): Promise<number> {
  let args: ReturnType<typeof parseCliArgs>;
  try {
    args = parseCliArgs(argv);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}\n\nRun with --help for usage.`);
    return 2;
  }
  if (args === "help") {
    console.log(HELP);
    return 0;
  }
  if (args === "version") {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    console.log(pkg.version);
    return 0;
  }

  const bar = args.quiet ? undefined : new ProgressBar();
  try {
    bar?.update(0, "Reading");
    const buf = args.input === "-" ? await readStdin() : await readFile(resolve(args.input));
    const stats = await convertText(decode(buf, args.encoding), args.output, args, bar);
    for (const w of stats.warnings) console.error(`Warning: ${w}`);
    if (!args.quiet) {
      const label = stats.delimiter === "\t" ? "tab" : stats.delimiter;
      console.log(
        `✔ ${stats.rows.toLocaleString()} rows × ${stats.columns} cols ` +
          `(delimiter "${label}") → ${resolve(args.output)}`,
      );
    }
    return 0;
  } catch (err) {
    bar?.abort();
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") console.error(`Error: Cannot read file "${args.input}"`);
    else if (e.code === "EBUSY" || e.code === "EPERM" || e.code === "EACCES")
      console.error(`Error: Cannot write "${args.output}" — is it open in Excel?`);
    else console.error(`Error: ${e.message}`);
    return 1;
  }
}

// Run only when executed directly (not when imported by tests). realpath resolves
// the symlink npm creates for the global `csv2xlsx` command.
function invokedDirectly(): boolean {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}
if (invokedDirectly()) {
  run(process.argv.slice(2)).then((code) => process.exit(code));
}
