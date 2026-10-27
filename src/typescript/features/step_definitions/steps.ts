import { After, Given, Then, When, World, setWorldConstructor } from "@cucumber/cucumber";
import ExcelJS from "exceljs";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../../src/cli.js";

class CliWorld extends World {
  dir = "";
  exitCode = -1;
  stderr = "";
  workbooks = new Map<string, ExcelJS.Workbook>();
  lastOutput = "";
}
setWorldConstructor(CliWorld);

/** Run the CLI in-process with cwd set to the scenario directory, capturing stderr. */
async function runCli(world: CliWorld, args: string[]): Promise<void> {
  const cwd = process.cwd();
  const origError = console.error;
  const origLog = console.log;
  const errors: string[] = [];
  console.error = (...a: unknown[]) => errors.push(a.join(" "));
  console.log = () => {};
  try {
    process.chdir(world.dir);
    world.exitCode = await run([...args, "--quiet"]);
  } finally {
    process.chdir(cwd);
    console.error = origError;
    console.log = origLog;
  }
  world.stderr = errors.join("\n");
}

async function sheet(world: CliWorld, name: string): Promise<ExcelJS.Worksheet> {
  const file = world.lastOutput;
  let wb = world.workbooks.get(file);
  if (!wb) {
    wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(join(world.dir, file));
    world.workbooks.set(file, wb);
  }
  const ws = wb.getWorksheet(name);
  assert.ok(ws, `Sheet "${name}" not found`);
  return ws;
}

Given("a working directory", async function (this: CliWorld) {
  this.dir = await mkdtemp(join(tmpdir(), "csv2xlsx-bdd-"));
});

Given("a CSV file {string} containing:", async function (this: CliWorld, name: string, body: string) {
  await writeFile(join(this.dir, name), body + "\n", "utf8");
});

When("I run csv2xlsx with {string}", async function (this: CliWorld, argLine: string) {
  const args = argLine.split(/\s+/).filter(Boolean);
  const positionals = args.filter((a, i) => !a.startsWith("-") && !/^-/.test(args[i - 1] ?? ""));
  this.lastOutput = positionals[1] ?? positionals[0].replace(/\.[^.]+$/, "") + ".xlsx";
  await runCli(this, args);
});

Then("the command succeeds", function (this: CliWorld) {
  assert.equal(this.exitCode, 0, `stderr: ${this.stderr}`);
});

Then("the command fails with exit code {int}", function (this: CliWorld, code: number) {
  assert.equal(this.exitCode, code);
});

Then("the error output mentions {string}", function (this: CliWorld, text: string) {
  assert.match(this.stderr, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

Then("the file {string} exists", function (this: CliWorld, name: string) {
  assert.ok(existsSync(join(this.dir, name)), `${name} was not created`);
});

Then(
  "sheet {string} has {int} rows and {int} columns",
  async function (this: CliWorld, name: string, rows: number, cols: number) {
    const ws = await sheet(this, name);
    assert.equal(ws.actualRowCount, rows);
    assert.equal(ws.actualColumnCount, cols);
  },
);

Then(
  "cell {string} of sheet {string} is the text {string}",
  async function (this: CliWorld, ref: string, name: string, expected: string) {
    const unescaped = expected.replace(/\\n/g, "\n").replace(/\\"/g, '"');
    assert.equal((await sheet(this, name)).getCell(ref).value, unescaped);
  },
);

Then(
  "cell {string} of sheet {string} is the number {float}",
  async function (this: CliWorld, ref: string, name: string, expected: number) {
    assert.equal((await sheet(this, name)).getCell(ref).value, expected);
  },
);

Then(
  "cell {string} of sheet {string} is the boolean {word}",
  async function (this: CliWorld, ref: string, name: string, expected: string) {
    assert.equal((await sheet(this, name)).getCell(ref).value, expected === "true");
  },
);

Then("sheet {string} contains an Excel table", async function (this: CliWorld, name: string) {
  const ws = await sheet(this, name);
  assert.ok(ws.getTables().length > 0, "No table found");
});

After(async function (this: CliWorld) {
  if (this.dir) await rm(this.dir, { recursive: true, force: true });
});
