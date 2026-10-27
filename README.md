# csv-to-excel

[![CI](https://github.com/DaH3ckTh0r/csv-to-excel/actions/workflows/ci.yml/badge.svg)](https://github.com/DaH3ckTh0r/csv-to-excel/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Convert CSV files to real Excel workbooks (`.xlsx`) from PowerShell, cmd or any terminal, with a live progress bar.

The tool comes in two feature-equivalent implementations, **TypeScript (Node.js)** and **Python**. Pick the one that fits your environment.

```text
$ csv2xlsx sales.csv --table
Building [████████████████████░░░░░░░░░░]  68% · 2.4s
✔ 500,000 rows × 7 cols (delimiter ",") → C:\data\sales.xlsx
```

## Features

- **Correct CSV parsing (RFC 4180).** Handles commas inside quotes, `""` escaped quotes, line breaks inside a field, and CRLF / LF / CR line endings.
- **Delimiter auto-detection** for `,` `;` tab and `|`. Semicolon-separated exports from Spanish/European Excel just work.
- **Safe type detection.** Numbers and booleans become real Excel values. Codes like `00123`, and numbers longer than 15 digits, stay as text so they aren't corrupted.
- **Encoding detection.** Reads UTF-8 with or without BOM, and UTF-16 (what `>` produces in Windows PowerShell 5). The Python version also falls back to cp1252.
- **Formatting.** The header row is bold, frozen and filterable, columns are auto-fitted, and `--table` creates a styled Excel table.
- **Progress bar** showing the current phase, percentage and elapsed time. It is drawn only in an interactive terminal, so piped output and CI logs stay clean.
- **Reads from stdin** (`-`), returns clear error messages, and uses meaningful exit codes (`0` success, `1` runtime error, `2` bad usage).

## Repository layout

```text
csv-to-excel/
├── src/
│   ├── typescript/            # Node.js implementation
│   │   ├── src/               # cli.ts, converter.ts, csv.ts, values.ts, progress.ts
│   │   ├── tests/             # Vitest unit tests
│   │   └── features/          # Cucumber BDD (shared spec + TS step definitions)
│   └── python/                # Python implementation
│       ├── csv2xlsx/          # cli.py, converter.py, csv_utils.py, values.py, progress.py
│       ├── tests/             # pytest unit tests
│       └── features/          # behave BDD (same spec + Python steps)
├── samples/                   # sample.csv + generator for large test files
├── .github/workflows/ci.yml   # CI on Linux + Windows for both projects
└── .vscode/                   # debug configurations
```

## Quick start

### TypeScript (Node.js ≥ 20)

```powershell
cd src/typescript
npm install
npm run build

node dist/cli.js ..\..\samples\sample.csv            # → sample.xlsx
npm link                                             # optional: global `csv2xlsx` command
csv2xlsx ..\..\samples\sample.csv out.xlsx --table
```

### Python (≥ 3.10)

```powershell
cd src/python
python -m venv .venv
.venv\Scripts\Activate.ps1        # bash: source .venv/bin/activate
pip install -e ".[dev]"

csv2xlsx ..\..\samples\sample.csv                    # → sample.xlsx
python -m csv2xlsx ..\..\samples\sample.csv out.xlsx --table
```

## Usage

```text
csv2xlsx <input.csv|-> [output.xlsx] [options]

  -d, --delimiter <char>   Field delimiter (default: auto-detect , ; tab |)
  -s, --sheet <name>       Worksheet name (default: Sheet1)
  -e, --encoding <enc>     Input encoding (default: auto)
      --no-types           Keep every cell as text
      --no-header          Don't treat the first row as a header
      --table              Format the data as an Excel table
  -q, --quiet              No progress bar or summary
  -h, --help               Show help
  -v, --version            Show version
```

The output defaults to the input file name with `.xlsx` in the current folder, or `output.xlsx` when reading from stdin.

### Examples

| Shell | Command |
|---|---|
| Any | `csv2xlsx data.csv` |
| Any | `csv2xlsx data.csv report.xlsx --sheet Ventas --table` |
| Any | `csv2xlsx data.tsv -d tab` |
| Any | `csv2xlsx legacy.csv -e latin1` |
| PowerShell | `Get-Content data.csv -Raw \| csv2xlsx - out.xlsx` |
| cmd | `type data.csv \| csv2xlsx - out.xlsx` |
| bash | `cat data.csv \| csv2xlsx - out.xlsx` |
| PowerShell (batch) | `Get-ChildItem *.csv \| ForEach-Object { csv2xlsx $_.FullName -q }` |
| cmd / .bat (batch) | `for %f in (*.csv) do csv2xlsx "%f" -q` (use `%%f` inside a `.bat` file) |

### Seeing the progress bar

Small files convert too fast to see the bar. Generate a big file to try it:

```bash
python samples/generate_large_csv.py 500000 samples/large.csv
cd src/typescript && node dist/cli.js ../../samples/large.csv
cd src/python     && csv2xlsx ../../samples/large.csv
```

The bar goes through four phases: **Reading**, **Parsing** (5–45%), **Building** (45–85%) and **Saving** (85–100%). The save step is done by the Excel library in one call, so it holds at 85% until the file is written.

## Development

### Build

| | TypeScript | Python |
|---|---|---|
| Install | `npm install` | `pip install -e ".[dev]"` |
| Build | `npm run build` → `dist/` | `pip install build && python -m build` → `dist/*.whl` |
| Run from source | `npm run dev -- data.csv` | `python -m csv2xlsx data.csv` |
| Type-check | `npm run typecheck` | `mypy` |
| Lint / format | (tsc strict mode) | `ruff check .` / `ruff format .` |

### Tests

Both projects have **unit tests** for every module and the same **BDD spec** ([`features/convert.feature`](src/typescript/features/convert.feature)), written in plain-language Gherkin:

```gherkin
Scenario: Codes with leading zeros stay as text
  Given a CSV file "zips.csv" containing:
    """
    zip,active
    00123,true
    """
  When I run csv2xlsx with "zips.csv"
  Then cell "A2" of sheet "Sheet1" is the text "00123"
  And cell "B2" of sheet "Sheet1" is the boolean true
```

| | TypeScript | Python |
|---|---|---|
| Unit tests | `npm test` (Vitest) | `pytest` |
| Watch / re-run failures | `npm run test:watch` | `pytest --lf -x` |
| Coverage | `npm run test:coverage` → `coverage/` | `pytest --cov --cov-report=html` → `htmlcov/` |
| BDD | `npm run test:bdd` (Cucumber) | `behave` |
| Everything | `npm run test:all` | `ruff check . && mypy && pytest && behave` |

The feature file must stay identical in both projects. CI checks this with a `diff`.

### Debug

**VS Code.** Open the repo root and choose a configuration in **Run and Debug** (F5):

| Configuration | What it does |
|---|---|
| TS: Debug CLI (sample.csv) | Runs `src/cli.ts` through tsx, no build needed |
| TS: Debug current test file | Runs Vitest on the open test file |
| TS: Debug BDD scenarios | Runs Cucumber with breakpoints in step definitions |
| Python: Debug CLI (sample.csv) | Runs `python -m csv2xlsx` with debugpy |
| Python: Debug current test file | Runs pytest on the open file |
| Python: Debug BDD scenarios | Runs behave with breakpoints |

**Terminal:**

```bash
# TypeScript: attach Chrome DevTools (chrome://inspect) or any Node debugger
node --inspect-brk --import tsx src/cli.ts ../../samples/sample.csv

# Python: drop into pdb on start, or on the first exception
python -m pdb -m csv2xlsx ../../samples/sample.csv
pytest --pdb
```

## Using as a library

```ts
import { convertFile, ProgressBar } from "csv2xlsx";
const stats = await convertFile("in.csv", "out.xlsx", { table: true }, new ProgressBar());
```

```python
from csv2xlsx import ConvertOptions, ProgressBar, convert_file
stats = convert_file("in.csv", "out.xlsx", ConvertOptions(table=True), bar=ProgressBar())
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Cannot write "x.xlsx" — is it open in Excel?` | Close the file in Excel and run again. |
| Accented characters look wrong (`Ã©`) | The file isn't UTF-8. Pass `-e latin1` (Node) or `-e cp1252` (Python). |
| Everything lands in column A | The delimiter wasn't detected. Pass it explicitly with `-d ";"`. |
| Progress bar shows `?` or boxes in old cmd.exe | Use Windows Terminal, or run `chcp 65001` first. |
| `Too many rows for one Excel sheet` | Excel holds at most 1,048,576 rows × 16,384 columns per sheet. Split the CSV first. |
| Very large files use lots of memory | The whole workbook is built in memory before saving. |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Changes are tracked in [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)
