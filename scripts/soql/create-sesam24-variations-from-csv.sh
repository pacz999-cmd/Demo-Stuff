#!/usr/bin/env bash
set -euo pipefail

# Bulk-create sesam24 product variations from CSV.
#
# Usage:
#   bash scripts/soql/create-sesam24-variations-from-csv.sh --csv scripts/soql/sesam24_variations_template.csv
#
# Optional env vars:
#   ORG_ALIAS=Saatbau
#   PARENT_PRODUCT_ID=01t...
#   ENTITLEMENT_POLICY_NAME="All Access for sesam24"
#   SESAM_PRICEBOOK_NAME="sesam24 Price Book"
#   CURRENCY=EUR
#   DRY_RUN=true|false   (default: false)
#
# CSV headers (required):
#   name,sku,short_description,price

ORG_ALIAS="${ORG_ALIAS:-Saatbau}"
PARENT_PRODUCT_ID="${PARENT_PRODUCT_ID:-01tJ9000002MMkfIAG}"
ENTITLEMENT_POLICY_NAME="${ENTITLEMENT_POLICY_NAME:-All Access for sesam24}"
SESAM_PRICEBOOK_NAME="${SESAM_PRICEBOOK_NAME:-sesam24 Price Book}"
CURRENCY="${CURRENCY:-EUR}"
DRY_RUN="${DRY_RUN:-false}"
CSV_PATH=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --csv)
      CSV_PATH="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "${CSV_PATH}" ]]; then
  echo "ERROR: --csv <path> is required." >&2
  exit 1
fi

if [[ ! -f "${CSV_PATH}" ]]; then
  echo "ERROR: CSV file not found: ${CSV_PATH}" >&2
  exit 1
fi

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: required command not found: $1" >&2
    exit 1
  }
}

require_cmd sf
require_cmd jq
require_cmd python3

echo "== sesam24 CSV Variation Creator =="
echo "org:            ${ORG_ALIAS}"
echo "parent product: ${PARENT_PRODUCT_ID}"
echo "policy:         ${ENTITLEMENT_POLICY_NAME}"
echo "pricebook:      ${SESAM_PRICEBOOK_NAME}"
echo "currency:       ${CURRENCY}"
echo "dry run:        ${DRY_RUN}"
echo "csv:            ${CSV_PATH}"
echo

policy_id="$(sf data query --target-org "${ORG_ALIAS}" --query "SELECT Id FROM CommerceEntitlementPolicy WHERE Name = '${ENTITLEMENT_POLICY_NAME}' LIMIT 1" --json | jq -r '.result.records[0].Id // empty')"
if [[ -z "${policy_id}" ]]; then
  echo "ERROR: entitlement policy not found: ${ENTITLEMENT_POLICY_NAME}" >&2
  exit 1
fi

sesam_pricebook_id="$(sf data query --target-org "${ORG_ALIAS}" --query "SELECT Id FROM Pricebook2 WHERE Name = '${SESAM_PRICEBOOK_NAME}' LIMIT 1" --json | jq -r '.result.records[0].Id // empty')"
standard_pricebook_id="$(sf data query --target-org "${ORG_ALIAS}" --query "SELECT Id FROM Pricebook2 WHERE IsStandard = true LIMIT 1" --json | jq -r '.result.records[0].Id // empty')"
if [[ -z "${sesam_pricebook_id}" || -z "${standard_pricebook_id}" ]]; then
  echo "ERROR: could not resolve required pricebooks." >&2
  exit 1
fi

category_json="$(sf data query --target-org "${ORG_ALIAS}" --query "SELECT ProductCategoryId, IsPrimaryCategory FROM ProductCategoryProduct WHERE ProductId = '${PARENT_PRODUCT_ID}'" --json)"
media_json="$(sf data query --target-org "${ORG_ALIAS}" --query "SELECT ElectronicMediaId, ElectronicMediaGroupId, SortOrder FROM ProductMedia WHERE ProductId = '${PARENT_PRODUCT_ID}'" --json)"

category_count="$(echo "${category_json}" | jq -r '.result.records | length')"
media_count="$(echo "${media_json}" | jq -r '.result.records | length')"

if [[ "${category_count}" == "0" ]]; then
  echo "ERROR: parent product has no ProductCategoryProduct mapping." >&2
  exit 1
fi
if [[ "${media_count}" == "0" ]]; then
  echo "ERROR: parent product has no ProductMedia mapping." >&2
  exit 1
fi

echo "resolved policyId: ${policy_id}"
echo "resolved sesamPB:  ${sesam_pricebook_id}"
echo "resolved stdPB:    ${standard_pricebook_id}"
echo "parent categories: ${category_count}"
echo "parent media rows: ${media_count}"
echo

python3 - <<'PY' "${CSV_PATH}" >/tmp/sesam24_variations_rows.json
import csv, json, sys
path = sys.argv[1]
rows = []
with open(path, newline='', encoding='utf-8') as f:
    r = csv.DictReader(f)
    required = {"name", "sku", "short_description", "price"}
    if not required.issubset(set(r.fieldnames or [])):
        missing = sorted(required.difference(set(r.fieldnames or [])))
        raise SystemExit(f"Missing CSV columns: {', '.join(missing)}")
    for i, row in enumerate(r, 1):
        name = (row.get("name") or "").strip()
        sku = (row.get("sku") or "").strip()
        desc = (row.get("short_description") or "").strip()
        price = (row.get("price") or "").strip()
        if not name or not sku or not desc or not price:
            raise SystemExit(f"Row {i}: name/sku/short_description/price are required.")
        try:
            float(price)
        except ValueError:
            raise SystemExit(f"Row {i}: invalid numeric price '{price}'")
        rows.append({"name": name, "sku": sku, "short_description": desc, "price": price})
print(json.dumps(rows))
PY

row_count="$(jq 'length' /tmp/sesam24_variations_rows.json)"
echo "rows to process: ${row_count}"
echo

if [[ "${DRY_RUN}" == "true" ]]; then
  echo "-- DRY RUN PREVIEW --"
  jq -r '.[] | "- \(.name) | sku=\(.sku) | price=\(.price)"' /tmp/sesam24_variations_rows.json
  echo
  echo "Dry run complete. Set DRY_RUN=false (or unset) to execute."
  exit 0
fi

created=0
failed=0

while IFS= read -r row; do
  name="$(echo "${row}" | jq -r '.name')"
  sku="$(echo "${row}" | jq -r '.sku')"
  desc="$(echo "${row}" | jq -r '.short_description')"
  price="$(echo "${row}" | jq -r '.price')"

  echo "Creating: ${name} (${sku}) @ ${price} ${CURRENCY}"

  create_json="$(sf data create record --target-org "${ORG_ALIAS}" --sobject Product2 --values "Name='${name}' ProductCode='${sku}' StockKeepingUnit='${sku}' Description='${desc}' IsActive=true" --json)"
  product_id="$(echo "${create_json}" | jq -r '.result.id // empty')"
  if [[ -z "${product_id}" ]]; then
    echo "  FAIL: could not create Product2"
    failed=$((failed + 1))
    continue
  fi

  # Clone categories from parent.
  while IFS= read -r cat; do
    cat_id="$(echo "${cat}" | jq -r '.ProductCategoryId')"
    is_primary="$(echo "${cat}" | jq -r '.IsPrimaryCategory')"
    sf data create record --target-org "${ORG_ALIAS}" --sobject ProductCategoryProduct --values "ProductCategoryId='${cat_id}' ProductId='${product_id}' IsPrimaryCategory=${is_primary}" --json >/dev/null
  done < <(echo "${category_json}" | jq -c '.result.records[]')

  # Entitlement.
  sf data create record --target-org "${ORG_ALIAS}" --sobject CommerceEntitlementProduct --values "PolicyId='${policy_id}' ProductId='${product_id}'" --json >/dev/null

  # Clone media from parent.
  while IFS= read -r media; do
    media_id="$(echo "${media}" | jq -r '.ElectronicMediaId')"
    group_id="$(echo "${media}" | jq -r '.ElectronicMediaGroupId')"
    sort_order="$(echo "${media}" | jq -r '.SortOrder')"
    sf data create record --target-org "${ORG_ALIAS}" --sobject ProductMedia --values "ProductId='${product_id}' ElectronicMediaId='${media_id}' ElectronicMediaGroupId='${group_id}' SortOrder=${sort_order}" --json >/dev/null
  done < <(echo "${media_json}" | jq -c '.result.records[]')

  # Standard PB entry first, then sesam24 PB entry.
  sf data create record --target-org "${ORG_ALIAS}" --sobject PricebookEntry --values "Pricebook2Id='${standard_pricebook_id}' Product2Id='${product_id}' UnitPrice=${price} IsActive=true CurrencyIsoCode='${CURRENCY}'" --json >/dev/null
  sf data create record --target-org "${ORG_ALIAS}" --sobject PricebookEntry --values "Pricebook2Id='${sesam_pricebook_id}' Product2Id='${product_id}' UnitPrice=${price} IsActive=true CurrencyIsoCode='${CURRENCY}'" --json >/dev/null

  echo "  OK: ${product_id}"
  created=$((created + 1))
done < <(jq -c '.[]' /tmp/sesam24_variations_rows.json)

echo
echo "Created: ${created}"
echo "Failed:  ${failed}"

if [[ "${failed}" -gt 0 ]]; then
  exit 2
fi

