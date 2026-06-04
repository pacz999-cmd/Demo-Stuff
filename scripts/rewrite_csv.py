import csv
import sys


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: python3 scripts/rewrite_csv.py <input_csv> <output_csv>")
        return 1

    src_path = sys.argv[1]
    dst_path = sys.argv[2]

    with open(src_path, newline="", encoding="utf-8") as src:
        reader = csv.DictReader(src)
        fieldnames = reader.fieldnames or []
        rows = list(reader)

    with open(dst_path, "w", newline="", encoding="utf-8") as dst:
        writer = csv.DictWriter(dst, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
