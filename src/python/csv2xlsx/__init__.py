"""csv2xlsx — convert CSV files to Excel (.xlsx) workbooks."""

from .converter import ConvertOptions, ConvertStats, build_workbook, convert_file, convert_text, decode
from .csv_utils import detect_delimiter, parse_csv
from .progress import ProgressBar
from .values import coerce, sanitize_sheet_name, unique_headers

__version__ = "1.0.0"

__all__ = [
    "ConvertOptions",
    "ConvertStats",
    "ProgressBar",
    "build_workbook",
    "coerce",
    "convert_file",
    "convert_text",
    "decode",
    "detect_delimiter",
    "parse_csv",
    "sanitize_sheet_name",
    "unique_headers",
]
