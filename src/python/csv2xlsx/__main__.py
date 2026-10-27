"""Allow `python -m csv2xlsx ...`."""

import sys

from .cli import main

sys.exit(main())
