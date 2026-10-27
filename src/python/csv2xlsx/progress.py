"""Minimal, dependency-free console progress bar.

    Parsing  [██████████████░░░░░░░░░░░░░░░░]  47% · 1.2s

Renders on a single line using \\r, only when the stream is a TTY,
and throttles redraws so it never slows down the conversion.
"""

from __future__ import annotations

import contextlib
import sys
import time
from collections.abc import Callable
from typing import TextIO


class ProgressBar:
    def __init__(
        self,
        stream: TextIO | None = None,
        width: int = 30,
        throttle: float = 0.05,
        force: bool | None = None,
    ) -> None:
        self.stream = stream if stream is not None else sys.stderr
        self.width = width
        self.throttle = throttle
        is_tty = getattr(self.stream, "isatty", lambda: False)()
        self.enabled = force if force is not None else is_tty
        self._start = time.monotonic()
        self._last_draw = 0.0
        self._last_percent = -1
        self._label = ""
        self._finished = False
        if self.enabled:
            _enable_windows_utf8(self.stream)

    def update(self, fraction: float, label: str | None = None) -> None:
        """Update to an overall fraction (0..1) with the current phase label."""
        if not self.enabled or self._finished:
            return
        label = self._label if label is None else label
        pct = max(0, min(100, int(fraction * 100)))
        now = time.monotonic()
        label_changed = label != self._label
        self._label = label
        if not label_changed and pct == self._last_percent:
            return
        if not label_changed and pct < 100 and now - self._last_draw < self.throttle:
            return
        self._last_draw = now
        self._last_percent = pct
        self.stream.write("\r" + self.format(pct, label, self.width, now - self._start))
        self.stream.flush()

    def finish(self, label: str = "Done") -> None:
        """Draw 100% and move to a new line."""
        if not self.enabled or self._finished:
            return
        self._last_percent = -1
        self.update(1.0, label)
        self._finished = True
        self.stream.write("\n")
        self.stream.flush()

    def abort(self) -> None:
        """Stop without drawing 100% (e.g. on error), leaving the cursor on a fresh line."""
        if not self.enabled or self._finished:
            return
        self._finished = True
        if self._last_percent >= 0:
            self.stream.write("\n")
            self.stream.flush()

    @staticmethod
    def format(percent: int, label: str, width: int, elapsed: float) -> str:
        """Pure formatter, exposed for unit testing."""
        filled = round(percent / 100 * width)
        bar = "█" * filled + "░" * (width - filled)
        return f"{label:<9}[{bar}] {percent:>3}% · {elapsed:.1f}s"


def phase(bar: ProgressBar | None, start: float, end: float, label: str) -> Callable[[float], None]:
    """Map a sub-task's 0..1 progress into a slice of the overall bar."""

    def report(fraction: float) -> None:
        if bar is not None:
            bar.update(start + (end - start) * fraction, label)

    return report


def _enable_windows_utf8(stream: TextIO) -> None:
    """Old Windows consoles default to a code page that can't print █ — switch to UTF-8."""
    if sys.platform == "win32" and hasattr(stream, "reconfigure"):
        with contextlib.suppress(OSError, ValueError):
            stream.reconfigure(encoding="utf-8")
