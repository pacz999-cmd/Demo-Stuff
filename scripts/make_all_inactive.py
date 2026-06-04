import csv
import sys


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: python scripts/make_all_inactive.py <input_csv> <output_csv>")
        return 1

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    with open(input_path, newline="", encoding="utf-8") as src, open(
        output_path, "w", newline="", encoding="utf-8"
    ) as dst:
        reader = csv.DictReader(src)
        writer = csv.DictWriter(dst, fieldnames=["Id", "IsActive"])
        writer.writeheader()
        for row in reader:
            writer.writerow({"Id": row["Id"], "IsActive": "false"})

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
