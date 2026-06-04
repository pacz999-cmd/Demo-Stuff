#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   bash scripts/soql/healthcheck-sesam24-pricing.sh
#   ORG_ALIAS=Saatbau ACCOUNT_ID=001... PRODUCT_IDS=01t...,01t... bash scripts/soql/healthcheck-sesam24-pricing.sh
#   ORG_ALIAS=Saatbau BUYER_USERNAME=klara@example.com PRODUCT_IDS=01t...,01t... bash scripts/soql/healthcheck-sesam24-pricing.sh

ORG_ALIAS="${ORG_ALIAS:-Saatbau}"
WEBSTORE_ID="${WEBSTORE_ID:-0ZEJ9000000HBTAOA4}"
ACCOUNT_ID="${ACCOUNT_ID:-001J900000PLj1ZIAT}"
BUYER_USERNAME="${BUYER_USERNAME:-}"
PRODUCT_IDS="${PRODUCT_IDS:-01tJ9000002MMkpIAG,01tJ9000002MMlJIAW}"

echo "== sesam24 Pricing Health Check =="
echo "org:        ${ORG_ALIAS}"
echo "webstore:   ${WEBSTORE_ID}"
echo "account:    ${ACCOUNT_ID}"
echo "products:   ${PRODUCT_IDS}"
echo

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: required command not found: $1" >&2
    exit 1
  }
}

require_cmd sf
require_cmd jq
require_cmd curl

if [[ -n "${BUYER_USERNAME}" ]]; then
  resolved_account="$(sf data query \
    --target-org "${ORG_ALIAS}" \
    --query "SELECT AccountId FROM User WHERE Username = '${BUYER_USERNAME}' AND IsActive = true LIMIT 1" \
    --json | jq -r '.result.records[0].AccountId // empty')"

  if [[ -z "${resolved_account}" ]]; then
    echo "ERROR: Could not resolve active user/account for BUYER_USERNAME=${BUYER_USERNAME}" >&2
    exit 1
  fi
  ACCOUNT_ID="${resolved_account}"
fi

echo "-- WebStore Configuration --"
sf data query \
  --target-org "${ORG_ALIAS}" \
  --query "SELECT Id, Name, PricingStrategy, SupportedCurrencies, DefaultLanguage FROM WebStore WHERE Id = '${WEBSTORE_ID}'" \
  --json | jq -r '.result.records[] | "name=\(.Name) strategy=\(.PricingStrategy) currencies=\(.SupportedCurrencies) language=\(.DefaultLanguage)"'

echo
if [[ -n "${BUYER_USERNAME}" ]]; then
  echo "-- Resolved Buyer Context --"
  echo "buyerUsername=${BUYER_USERNAME}"
  echo "effectiveAccountId=${ACCOUNT_ID}"
  echo
fi

echo
echo "-- Buyer Group Membership (account scope) --"
sf data query \
  --target-org "${ORG_ALIAS}" \
  --query "SELECT BuyerGroup.Name FROM BuyerGroupMember WHERE BuyerId = '${ACCOUNT_ID}'" \
  --json | jq -r '.result.records[]?.BuyerGroup.Name'

echo
echo "-- Store Buyer Groups + Active Pricebooks --"
sf data query \
  --target-org "${ORG_ALIAS}" \
  --query "SELECT BuyerGroupId, BuyerGroup.Name FROM WebStoreBuyerGroup WHERE WebStoreId = '${WEBSTORE_ID}'" \
  --json | jq -r '.result.records[] | "\(.BuyerGroupId),\(.BuyerGroup.Name)"' \
  | while IFS=',' read -r bg_id bg_name; do
      echo "buyerGroup=${bg_name} (${bg_id})"
      sf data query \
        --target-org "${ORG_ALIAS}" \
        --query "SELECT Pricebook2.Name, IsActive, Priority FROM BuyerGroupPricebook WHERE BuyerGroupId = '${bg_id}'" \
        --json | jq -r '.result.records[]? | "  pricebook=\(.Pricebook2.Name) active=\(.IsActive) priority=\(.Priority)"'
    done

ACCESS_TOKEN="$(sf org display --target-org "${ORG_ALIAS}" --verbose --json | jq -r '.result.accessToken')"
INSTANCE_URL="$(sf org display --target-org "${ORG_ALIAS}" --verbose --json | jq -r '.result.instanceUrl')"

echo
echo "-- Live Pricing API Checks --"
IFS=',' read -r -a product_array <<< "${PRODUCT_IDS}"
failed=0

for product_id in "${product_array[@]}"; do
  url="${INSTANCE_URL}/services/data/v66.0/commerce/webstores/${WEBSTORE_ID}/pricing/products/${product_id}?effectiveAccountId=${ACCOUNT_ID}"
  raw="$(curl -s -H "Authorization: Bearer ${ACCESS_TOKEN}" "${url}")"

  if echo "${raw}" | jq -e 'type=="array" and .[0].errorCode' >/dev/null 2>&1; then
    code="$(echo "${raw}" | jq -r '.[0].errorCode')"
    msg="$(echo "${raw}" | jq -r '.[0].message')"
    echo "FAIL product=${product_id} errorCode=${code} message=${msg}"
    failed=1
    continue
  fi

  unit_price="$(echo "${raw}" | jq -r '.unitPrice // empty')"
  currency="$(echo "${raw}" | jq -r '.currencyIsoCode // empty')"
  success_count="$(echo "${raw}" | jq -r '[.productPriceEntries[]? | select(.success==true)] | length')"

  if [[ -z "${unit_price}" || "${success_count}" == "0" ]]; then
    echo "FAIL product=${product_id} unitPrice=<empty> currency=${currency:-<empty>} payload=${raw}"
    failed=1
  else
    echo "PASS product=${product_id} unitPrice=${unit_price} currency=${currency}"
  fi
done

echo
if [[ "${failed}" -eq 0 ]]; then
  echo "RESULT: PASS - Pricing is healthy for tested products."
else
  echo "RESULT: FAIL - One or more pricing checks failed."
  exit 2
fi
