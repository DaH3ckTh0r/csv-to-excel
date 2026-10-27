"""Core conversion logic: CSV text → openpyxl workbook → .xlsx file.

Kept free of CLI concerns so it can be unit tested and reused as a library.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Font
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo

from .csv_utils import detect_delimiter, parse_csv
from .progress import ProgressBar, phase
from .values import CellValue, clean, coerce, sanitize_sheet_name, unique_headers

# Excel's per-sheet limits.
MAX_ROWS = 1_048_576
MAX_COLS = 16_384


@dataclass
class ConvertOptions:
    delimiter: str | None = None  # auto-detected when None
    sheet: str = "Sheet1"
    types: bool = True  # detect numbers and booleans
    header: bool = True  # treat the first row as a header
    table: bool = False  # format as an Excel table


@dataclass
class ConvertStats:
    rows: int
    columns: int
    delimiter: str
    warnings: list[str] = field(default_factory=list)


def decode(data: bytes, encoding: str | None = None) -> str:
    """Decode raw bytes.

    Honors UTF-16 BOMs (PowerShell 5 redirection), strips a UTF-8 BOM, and
    falls back to cp1252 (common for Excel exports on Windows).
    """
    if encoding:
        return data.decode(encoding).lstrip("﻿")
    if data[:2] in (b"\xff\xfe", b"\xfe\xff"):
        return data.decode("utf-16")
    try:
        return data.decode("utf-8-sig")
    except UnicodeDecodeError:
        return data.decode("cp1252", errors="replace")


def build_workbook(
    text: str,
    options: ConvertOptions | None = None,
    bar: ProgressBar | None = None,
) -> tuple[Workbook, ConvertStats]:
    """Build a workbook in memory from CSV text."""
    opts = options or ConvertOptions()
    delimiter = opts.delimiter or detect_delimiter(text)
    warnings: list[str] = []

    result = parse_csv(text, delimiter, phase(bar, 0.05, 0.45, "Parsing"))
    if result.unterminated_quote:
        warnings.append("Unterminated quoted field at end of input")
    rows = result.rows
    if not rows:
        raise ValueError("Input is empty")

    width = max(len(r) for r in rows)
    if len(rows) > MAX_ROWS or width > MAX_COLS:
        raise ValueError(
            f"Too many rows for one Excel sheet: {len(rows):,} rows × {width} cols "
            f"(max {MAX_ROWS:,} × {MAX_COLS:,})"
        )
    report = phase(bar, 0.45, 0.85, "Building")
    step = max(1, len(rows) // 200)

    data: list[list[CellValue]] = []
    for i, r in enumerate(rows):
        if i % step == 0:
            report(i / len(rows))
        is_header = opts.header and i == 0
        padded = r + [""] * (width - len(r))
        data.append([clean(c if is_header or not opts.types else coerce(c)) for c in padded])
    report(1.0)

    wb = Workbook()
    ws = wb.active
    ws.title = sanitize_sheet_name(opts.sheet)
    last_col = get_column_letter(width)

    if opts.table:
        headers = unique_headers([str(h or "") for h in data[0]] if opts.header else [""] * width)
        body = data[1:] if opts.header else data
        ws.append(headers)
        for body_row in body or [[None] * width]:
            ws.append(body_row)
        table = Table(displayName="Data", ref=f"A1:{last_col}{ws.max_row}")
        table.tableStyleInfo = TableStyleInfo(name="TableStyleMedium2", showRowStripes=True)
        ws.add_table(table)
    else:
        for data_row in data:
            ws.append(data_row)
        if opts.header:
            for cell in ws[1]:
                cell.font = Font(bold=True)
            ws.freeze_panes = "A2"
            ws.auto_filter.ref = f"A1:{last_col}{ws.max_row}"

    # Auto-fit column widths (capped at 60).
    for c in range(width):
        longest = 8
        for data_row in data:
            v = data_row[c]
            if v is None:
                continue
            for line in str(v).split("\n"):
                longest = max(longest, len(line))
        ws.column_dimensions[get_column_letter(c + 1)].width = min(longest + 2, 60)

    return wb, ConvertStats(rows=len(rows), columns=width, delimiter=delimiter, warnings=warnings)


def convert_text(
    text: str,
    output: str | Path,
    options: ConvertOptions | None = None,
    bar: ProgressBar | None = None,
) -> ConvertStats:
    """Convert CSV text and write the .xlsx file."""
    wb, stats = build_workbook(text, options, bar)
    if bar:
        bar.update(0.85, "Saving")
    wb.save(output)
    if bar:
        bar.finish("Done")
    return stats


def convert_file(
    input_path: str | Path,
    output: str | Path,
    options: ConvertOptions | None = None,
    encoding: str | None = None,
    bar: ProgressBar | None = None,
) -> ConvertStats:
    """Convert a CSV file on disk to an .xlsx file."""
    if bar:
        bar.update(0.0, "Reading")
    text = decode(Path(input_path).read_bytes(), encoding)
    return convert_text(text, output, options, bar)
