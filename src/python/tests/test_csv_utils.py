import pytest

from csv2xlsx.csv_utils import detect_delimiter, parse_csv


@pytest.mark.parametrize(
    ("text", "expected"),
    [("a,b,c\n1,2,3", ","), ("a;b;c\n1;2;3", ";"), ("a\tb\tc", "\t"), ("a|b|c", "|")],
)
def test_detect_delimiter(text, expected):
    assert detect_delimiter(text) == expected


def test_detect_ignores_delimiters_inside_quotes():
    assert detect_delimiter('"x;y;z;w",b,c') == ","


def test_detect_only_looks_at_first_line():
    assert detect_delimiter("a,b\n1;2;3;4;5") == ","


def test_detect_defaults_to_comma():
    assert detect_delimiter("single") == ","


def test_parse_simple_rows():
    assert parse_csv("a,b\n1,2").rows == [["a", "b"], ["1", "2"]]


def test_parse_quotes_escapes_and_newlines():
    rows = parse_csv('"Smith, John","Say ""hi""","line1\nline2"').rows
    assert rows == [["Smith, John", 'Say "hi"', "line1\nline2"]]


def test_parse_crlf_and_cr_line_endings():
    assert parse_csv("a,b\r\n1,2\r3,4").rows == [["a", "b"], ["1", "2"], ["3", "4"]]


def test_parse_keeps_empty_fields():
    assert parse_csv(",a,,").rows == [["", "a", "", ""]]


def test_parse_drops_blank_lines():
    assert parse_csv("a\n\n\nb\n\n").rows == [["a"], ["b"]]


def test_parse_custom_delimiter():
    assert parse_csv("a;b", ";").rows == [["a", "b"]]


@pytest.mark.parametrize(
    ("text", "unterminated"),
    [
        ('a,"open', True),
        ('a,"closed"', False),
        ('"a ""b"" c"', False),
        ('x"y,z', False),
        ('"a""', True),
        ('5"7,"open', True),  # even quote count, but a bare quote hides the open field
        ('5"7,8"9', False),
    ],
)
def test_parse_detects_unterminated_quote(text, unterminated):
    assert parse_csv(text).unterminated_quote is unterminated


def test_parse_rejects_multi_char_delimiter():
    with pytest.raises(ValueError, match="single character"):
        parse_csv("a", ";;")


def test_parse_reports_monotonic_progress_ending_at_one():
    calls: list[float] = []
    parse_csv("a,b\n" * 1000, ",", calls.append)
    assert len(calls) > 10
    assert calls[-1] == 1.0
    assert calls == sorted(calls)
