"""Cell value helpers: type coercion and Excel naming rules."""

from __future__ import annotations

import re
from collections import Counter

CellValue = str | int | float | bool | None

_NUMBER_RE = re.compile(r"^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$")
# Control characters Excel rejects in cell values (tab, LF and CR are allowed).
_ILLEGAL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
_SHEET_FORBIDDEN_RE = re.compile(r"[:\\/?*\[\]]")


def coerce(value: str) -> CellValue:
    """Convert text to a number/boolean when it is safe to do so.

    IDs and codes with leading zeros ("00123") and numbers with more than
    15 significant digits stay as text so Excel doesn't corrupt them.
    """
    v = value.strip()
    if v == "":
        return None
    low = v.lower()
    if low in ("true", "false"):
        return low == "true"
    if _NUMBER_RE.match(v) and sum(c.isdigit() for c in v) <= 15:
        if "." not in v and "e" not in low:
            return int(v)
        return float(v)
    return value


def clean(value: CellValue) -> CellValue:
    """Remove control characters that make Excel reject the file."""
    return _ILLEGAL_CHARS_RE.sub("", value) if isinstance(value, str) else value


def sanitize_sheet_name(name: str) -> str:
    """Excel sheet names: 1–31 chars, none of : \\ / ? * [ ]"""
    return _SHEET_FORBIDDEN_RE.sub("_", name)[:31] or "Sheet1"


def unique_headers(headers: list[str]) -> list[str]:
    """Excel tables require non-empty, unique header names."""
    seen: Counter[str] = Counter()
    out: list[str] = []
    for i, raw in enumerate(headers):
        h = raw.strip() or f"Column{i + 1}"
        seen[h] += 1
        out.append(f"{h}_{seen[h]}" if seen[h] > 1 else h)
    return out
