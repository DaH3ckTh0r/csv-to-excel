import pytest

from csv2xlsx.values import clean, coerce, sanitize_sheet_name, unique_headers


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("42", 42),
        ("-3", -3),
        ("12.5", 12.5),
        ("0", 0),
        ("0.75", 0.75),
        ("1e3", 1000.0),
        ("true", True),
        ("FALSE", False),
        ("", None),
        ("   ", None),
    ],
)
def test_coerce_converts(value, expected):
    result = coerce(value)
    assert result == expected
    assert type(result) is type(expected)


@pytest.mark.parametrize("value", ["00123", "1234567890123456", "12,5", "1.2.3", "abc", "+5", "$10", "1 000"])
def test_coerce_keeps_text(value):
    assert coerce(value) == value


def test_clean_removes_control_chars_but_keeps_whitespace():
    assert clean("a\x00b\x07c\nd\te") == "abc\nd\te"


def test_clean_leaves_non_strings():
    assert clean(5) == 5
    assert clean(None) is None


def test_sanitize_sheet_name_replaces_forbidden_chars():
    assert sanitize_sheet_name("Q1/Q2: [draft]?") == "Q1_Q2_ _draft__"


def test_sanitize_sheet_name_truncates():
    assert len(sanitize_sheet_name("x" * 50)) == 31


def test_sanitize_sheet_name_fallback():
    assert sanitize_sheet_name("") == "Sheet1"


def test_unique_headers():
    assert unique_headers(["id", "", "id", "name", "id"]) == ["id", "Column2", "id_2", "name", "id_3"]
