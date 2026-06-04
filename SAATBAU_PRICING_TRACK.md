# Saatbau Pricing Track (`sesam24`)

## Scope
- Org: `Saatbau`
- Store: `sesam24`
- User tested: `Klara Sommer` (`klara@example.com`)

## What was validated
- Klara user/account/contact linkage is correct.
- BuyerAccount for Klara account is active.
- Store buyer group + entitlement + pricebook mappings exist and are active.
- EUR entries exist and are active in `sesam24 Price Book`.

## Root-cause discovered during outage
- Pricing backend failed with:
  - `UNKNOWN_EXCEPTION` in `Cirrus - Commerce Default Pricing Procedure`
  - Step `ListContainer5`
  - `INVALID_TYPE` for object `ProcedureOutputResolution`
- This caused storefront price resolution to fail even with correct pricebook data.

## Current status
- Salesforce Pricing was enabled and price data synced.
- Live pricing API checks now pass for known products/account.
- Health check script added and working.

## Operational command
- Default:
  - `npm run health:pricing:sesam24`
- Buyer-based:
  - `BUYER_USERNAME=klara@example.com npm run health:pricing:buyer`

