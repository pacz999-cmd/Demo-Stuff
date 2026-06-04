# Rolls Supersession Track (`sdo_scom_product_supersession`)

## Scope
- Org: `Rolls`
- Component: `force-app/main/default/lwc/sdo_scom_product_supersession`
- Controller: `force-app/main/default/classes/ProductSupersessionController.cls`

## Problem addressed
- Supersession cards showed missing/wrong images from CMS.
- Needed CMS-only behavior (no AWS/non-CMS fallbacks).

## Key findings
- ProductMedia links existed, but storefront context often could not resolve ManagedContent via SOQL.
- Some media IDs resolved to non-image/help URLs and had to be filtered out.
- Endpoint responses could be empty/redirected; JSON parsing needed to be hardened.

## Implemented approach
- CMS-only resolution path.
- Multiple fallback strategies for CMS URL resolution.
- Return `electronicMediaId`/`electronicMediaIds`, `channelId`, and `orgId` from Apex.
- LWC attempts media resolution through channel content endpoints and filters non-image URLs.
- Retry candidate URLs per product.

## Additional behavior added
- Disable old-product PDP Add to Cart when supersession is active.

## Current status
- Card 1 and 2 images confirmed OK in latest feedback.
- Card 3 was failing due bad first media candidate; multi-media-id selection fix deployed and published.
- Latest publish job used for this stream: `08PJ600000Mhi3iMAB`.

