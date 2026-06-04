# Kaercher Professional B2B Demo Setup

This setup creates a Kaercher Professional B2B demo on top of the existing storefront `B2B Commerce enhanced`.
All content and positioning are derived from the Kaercher Professional page and intentionally exclude B2C Home and Garden topics.

## Included assets in this repository

- Branding + messaging source: `config/kaercher_professional_branding.json`
- Demo product seed file: `scripts/soql/kaercher_professional_products_template.csv`
- Product creation automation: `scripts/soql/create-kaercher-professional-products-from-csv.sh`

## 1) Pre-check your org mappings

Run these and confirm names in your target org:

```bash
sf data query --target-org <ORG_ALIAS> --query "SELECT Id, Name FROM WebStore WHERE Name = 'B2B Commerce enhanced'"
sf data query --target-org <ORG_ALIAS> --query "SELECT Id, Name FROM CommerceEntitlementPolicy"
sf data query --target-org <ORG_ALIAS> --query "SELECT Id, Name, IsStandard FROM Pricebook2"
```

You need:

- WebStore: `B2B Commerce enhanced`
- Entitlement policy for that store (default expected by script: `All Access for B2B Commerce enhanced`)
- Store pricebook (default expected by script: `B2B Commerce enhanced Price Book`)
- One existing template parent product with correct category/media assignments

## 2) Run a dry run first

```bash
ORG_ALIAS=<ORG_ALIAS> \
TEMPLATE_PARENT_PRODUCT_ID=<01t...> \
DRY_RUN=true \
bash "scripts/soql/create-kaercher-professional-products-from-csv.sh" \
  --csv "scripts/soql/kaercher_professional_products_template.csv"
```

## 3) Execute product creation

```bash
ORG_ALIAS=<ORG_ALIAS> \
TEMPLATE_PARENT_PRODUCT_ID=<01t...> \
DRY_RUN=false \
bash "scripts/soql/create-kaercher-professional-products-from-csv.sh" \
  --csv "scripts/soql/kaercher_professional_products_template.csv"
```

The script creates `Product2` records, clones categories/media from the template parent product, links entitlement policy, and adds standard + store pricebook entries.

## 4) Apply storefront branding content

Use the values in `config/kaercher_professional_branding.json` for:

- Hero headline/subline and CTA labels
- Professional-only navigation and service links
- Product advisor and myKaercher Business promo blocks

Do not include consumer language or Home and Garden product sections.

## 5) Optional verification queries

```bash
sf data query --target-org <ORG_ALIAS> --query "SELECT Id, Name, ProductCode FROM Product2 WHERE ProductCode LIKE 'DPRO-%' ORDER BY CreatedDate DESC LIMIT 20"
sf data query --target-org <ORG_ALIAS> --query "SELECT Product2.Name, Pricebook2.Name, UnitPrice, CurrencyIsoCode FROM PricebookEntry WHERE Product2.ProductCode LIKE 'DPRO-%' ORDER BY CreatedDate DESC LIMIT 50"
sf data query --target-org <ORG_ALIAS> --query "SELECT ProductId, Policy.Name FROM CommerceEntitlementProduct WHERE Product.ProductCode LIKE 'DPRO-%' ORDER BY CreatedDate DESC LIMIT 50"
```

## Source

- Kaercher Professional (DE): <https://www.kaercher.com/de/professional.html>
