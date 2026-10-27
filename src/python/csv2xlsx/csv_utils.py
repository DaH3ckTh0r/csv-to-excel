"""CSV parsing utilities (RFC 4180) built on the standard `csv` module."""

from __future__ import annotations

import csv
import io
import re
from collections import Counter
from collections.abc import Callable, Iterator
from dataclasses import dataclass

CANDIDATE_DELIMITERS = (",", ";", "\t", "|")

ProgressCallback = Callable[[float], None]


def detect_delimiter(text: str) -> str:
    """Pick the most frequent candidate delimiter on the first line (outside quotes)."""
    counts: Counter[str] = Counter()
    in_quotes = False
    for ch in text:
        if ch == '"':
            in_quotes = not in_quotes
        elif not in_quotes and ch in "\r\n":
            break
        elif not in_quotes and ch in CANDIDATE_DELIMITERS:
            counts[ch] += 1
    if not counts:
        return ","
    # Ties resolve in candidate order (comma first), matching the TypeScript version.
    best = max(counts.values())
    return next(c for c in CANDIDATE_DELIMITERS if counts[c] == best)


@dataclass
class ParseResult:
    rows: list[list[str]]
    unterminated_quote: bool = False


def _tracked_lines(text: str, on_progress: ProgressCallback | None) -> Iterator[str]:
    """Yield lines (keeping line endings) and report how much of the text was consumed."""
    total = len(text) or 1
    consumed = 0
    step = max(1, total // 200)  # ~200 progress updates max
    next_report = 0
    for line in io.StringIO(text, newline=""):
        consumed += len(line)
        if on_progress and consumed >= next_report:
            on_progress(consumed / total)
            next_report = consumed + step
        yield line


def parse_csv(text: str, delimiter: str = ",", on_progress: ProgressCallback | None = None) -> ParseResult:
    """Parse CSV text. Handles quoted delimiters, embedded newlines and "" escapes.

    Fully empty lines are dropped.
    """
    if len(delimiter) != 1:
        raise ValueError("Delimiter must be a single character")

    reader = csv.reader(_tracked_lines(text, on_progress), delimiter=delimiter, strict=False)
    rows = [row for row in reader if row and not (len(row) == 1 and row[0] == "")]

    # csv silently closes an unterminated quote at EOF; detect it ourselves.
    unterminated = _ends_inside_quotes(text, delimiter)
    if on_progress:
        on_progress(1.0)
    return ParseResult(rows, unterminated)


def _has_bare_quotes(text: str, delimiter: str) -> bool:
    """A lone quote between two ordinary characters (e.g. 5"7) can't be part of
    RFC 4180 quoting, so quote parity no longer tells us anything."""
    d = re.escape(delimiter)
    return re.search(rf'[^"{d}\r\n]"[^"{d}\r\n]', text) is not None


def _ends_inside_quotes(text: str, delimiter: str) -> bool:
    """True if the text ends inside a quoted field (same rules as RFC 4180)."""
    # Well-formed quoting always uses quotes in pairs; an even count can only be
    # unterminated if bare quotes appear mid-field, which is rare. The C-level
    # count avoids a slow per-character Python loop on large files.
    if text.count('"') % 2 == 0 and not _has_bare_quotes(text, delimiter):
        return False
    in_quotes = False
    field_empty = True
    i, n = 0, len(text)
    while i < n:
        ch = text[i]
        if in_quotes:
            if ch == '"':
                if i + 1 < n and text[i + 1] == '"':
                    i += 1  # escaped quote
                else:
                    in_quotes = False
        elif ch == '"' and field_empty:
            in_quotes = True
        elif ch == delimiter or ch in "\r\n":
            field_empty = True
            i += 1
            continue
        field_empty = False
        i += 1
    return in_quotes
