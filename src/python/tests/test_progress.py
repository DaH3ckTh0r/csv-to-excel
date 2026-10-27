import io

from csv2xlsx.progress import ProgressBar, phase


class FakeTTY(io.StringIO):
    def __init__(self, tty: bool = True) -> None:
        super().__init__()
        self._tty = tty
        self.writes: list[str] = []

    def isatty(self) -> bool:
        return self._tty

    def write(self, s: str) -> int:
        self.writes.append(s)
        return super().write(s)


def test_format_empty():
    assert ProgressBar.format(0, "Parsing", 10, 0) == "Parsing  [░░░░░░░░░░]   0% · 0.0s"


def test_format_half():
    assert ProgressBar.format(50, "Parsing", 10, 1.234) == "Parsing  [█████░░░░░]  50% · 1.2s"


def test_format_full():
    assert ProgressBar.format(100, "Done", 4, 0) == "Done     [████] 100% · 0.0s"


def test_no_output_when_not_a_tty():
    s = FakeTTY(tty=False)
    bar = ProgressBar(stream=s)
    bar.update(0.5, "Parsing")
    bar.finish()
    assert s.writes == []


def test_single_line_rendering_ends_with_newline():
    s = FakeTTY()
    bar = ProgressBar(stream=s, width=10, throttle=0)
    bar.update(0.25, "Parsing")
    bar.update(0.5, "Parsing")
    bar.finish()
    assert all(w.startswith("\r") for w in s.writes[:-1])
    assert s.writes[-1] == "\n"
    assert "100%" in s.writes[-2]


def test_skips_redraw_when_percent_unchanged():
    s = FakeTTY()
    bar = ProgressBar(stream=s, throttle=0)
    for f in (0.501, 0.502, 0.509):
        bar.update(f, "Parsing")
    assert len(s.writes) == 1


def test_clamps_out_of_range():
    s = FakeTTY()
    ProgressBar(stream=s, throttle=0).update(5, "X")
    assert "100%" in s.writes[0]


def test_abort_only_ends_line_if_drawn():
    a = FakeTTY()
    ProgressBar(stream=a).abort()
    assert a.writes == []

    b = FakeTTY()
    bar = ProgressBar(stream=b, throttle=0)
    bar.update(0.3, "Parsing")
    bar.abort()
    assert b.writes[-1] == "\n"
    assert "100%" not in "".join(b.writes)


def test_ignores_updates_after_finish():
    s = FakeTTY()
    bar = ProgressBar(stream=s, throttle=0)
    bar.finish()
    count = len(s.writes)
    bar.update(0.3, "Late")
    assert len(s.writes) == count


def test_phase_maps_into_slice():
    s = FakeTTY()
    bar = ProgressBar(stream=s, throttle=0)
    phase(bar, 0.4, 0.8, "Building")(0.5)
    assert " 60%" in s.writes[0]
    assert "Building" in s.writes[0]


def test_phase_without_bar_is_noop():
    phase(None, 0, 1, "x")(0.5)
