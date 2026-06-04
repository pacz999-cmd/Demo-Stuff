import csv
import sys


def main() -> int:
    if len(sys.argv) != 4:
        print(
            "Usage: python3 scripts/make_single_active.py <input_csv> <active_product_id> <output_csv>"
        )
        return 1

    input_path = sys.argv[1]
    active_id = sys.argv[2]
    output_path = sys.argv[3]

    with open(input_path, newline="", encoding="utf-8") as src, open(
        output_path, "w", newline="", encoding="utf-8"
    ) as dst:
        reader = csv.DictReader(src)
        writer = csv.DictWriter(dst, fieldnames=["Id", "IsActive"])
        writer.writeheader()
        found = False
        for row in reader:
            is_target = row["Id"] == active_id
            if is_target:
                found = True
            writer.writerow({"Id": row["Id"], "IsActive": "true" if is_target else "false"})

    if not found:
        print(f"Active product id not found in source CSV: {active_id}")
        return 2

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
