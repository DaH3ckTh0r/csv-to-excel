#!/usr/bin/env python3
"""Generate a large CSV to try out the progress bar.

Usage:
  python samples/generate_large_csv.py [rows] [output]
  python samples/generate_large_csv.py 500000 samples/large.csv
"""

import csv
import random
import sys

rows = int(sys.argv[1]) if len(sys.argv) > 1 else 200_000
output = sys.argv[2] if len(sys.argv) > 2 else "samples/large.csv"

cities = ["Madrid", "Bogotá", "Ciudad de México", "Lima", "New York", "São Paulo"]
random.seed(42)

with open(output, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["id", "name", "city", "amount", "zip", "active", "notes"])
    for i in range(1, rows + 1):
        w.writerow(
            [
                i,
                f"Customer {i}, Inc.",
                random.choice(cities),
                round(random.uniform(-1000, 10000), 2),
                f"{random.randint(0, 99999):05d}",
                random.choice(["true", "false"]),
                'Note with "quotes"\nand a newline' if i % 10 == 0 else "",
            ]
        )

print(f"Wrote {rows:,} rows to {output}")
