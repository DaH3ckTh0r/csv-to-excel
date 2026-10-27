"""csv2xlsx command-line entry point."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from . import __version__
from .converter import ConvertOptions, convert_text, decode
from .progress import ProgressBar

EPILOG = """\
examples:
  csv2xlsx data.csv
  csv2xlsx data.csv report.xlsx --sheet Ventas --table
  type data.csv | csv2xlsx - out.xlsx      (cmd / PowerShell)
  cat data.csv  | csv2xlsx - out.xlsx      (bash)"""


class UsageError(Exception):
    """Invalid command-line usage (exit code 2)."""


class _Parser(argparse.ArgumentParser):
    def error(self, message: str) -> None:  # type: ignore[override]
        raise UsageError(message)


def build_parser() -> argparse.ArgumentParser:
    p = _Parser(
        prog="csv2xlsx",
        description="Convert a CSV file to an Excel workbook.",
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("input", help='CSV file path, or "-" to read from stdin')
    p.add_argument("output", nargs="?", help="output .xlsx (default: input name with .xlsx)")
    p.add_argument("-d", "--delimiter", help="field delimiter (default: auto-detect , ; tab |)")
    p.add_argument("-s", "--sheet", default="Sheet1", help="worksheet name (default: Sheet1)")
    p.add_argument("-e", "--encoding", help="input encoding (default: auto, UTF-8/UTF-16/cp1252)")
    p.add_argument(
        "--no-types",
        dest="types",
        action="store_false",
        help="keep every cell as text (no number/boolean detection)",
    )
    p.add_argument(
        "--no-header", dest="header", action="store_false", help="don't treat the first row as a header"
    )
    p.add_argument("--table", action="store_true", help="format the data as an Excel table (with filters)")
    p.add_argument("-q", "--quiet", action="store_true", help="no progress bar or summary")
    p.add_argument("-v", "--version", action="version", version=f"%(prog)s {__version__}")
    return p


def parse_args(argv: list[str]) -> argparse.Namespace:
    args = build_parser().parse_args(argv)

    if args.delimiter is not None:
        if args.delimiter in ("\\t", "tab", "TAB"):
            args.delimiter = "\t"
        if len(args.delimiter) != 1:
            raise UsageError("Delimiter must be a single character")

    if args.output is None:
        args.output = "output.xlsx" if args.input == "-" else Path(args.input).with_suffix(".xlsx").name
    return args


def main(argv: list[str] | None = None) -> int:
    try:
        args = parse_args(sys.argv[1:] if argv is None else argv)
    except UsageError as e:
        print(f"Error: {e}\n\nRun with --help for usage.", file=sys.stderr)
        return 2
    except SystemExit as e:  # --help / --version
        return int(e.code or 0)

    options = ConvertOptions(
        delimiter=args.delimiter,
        sheet=args.sheet,
        types=args.types,
        header=args.header,
        table=args.table,
    )
    bar = None if args.quiet else ProgressBar()

    try:
        if bar:
            bar.update(0.0, "Reading")
        if args.input == "-":
            data = sys.stdin.buffer.read()
        else:
            try:
                data = Path(args.input).read_bytes()
            except OSError:
                raise FileNotFoundError(f'Cannot read file "{args.input}"') from None
        stats = convert_text(decode(data, args.encoding), args.output, options, bar)
    except PermissionError:
        if bar:
            bar.abort()
        print(f'Error: Cannot write "{args.output}" — is it open in Excel?', file=sys.stderr)
        return 1
    except (OSError, ValueError, LookupError) as e:
        if bar:
            bar.abort()
        print(f"Error: {e}", file=sys.stderr)
        return 1

    for w in stats.warnings:
        print(f"Warning: {w}", file=sys.stderr)
    if not args.quiet:
        label = "tab" if stats.delimiter == "\t" else stats.delimiter
        print(
            f'✔ {stats.rows:,} rows × {stats.columns} cols (delimiter "{label}") '
            f"→ {Path(args.output).resolve()}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
