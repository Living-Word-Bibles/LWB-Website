# Living Word Bibles — Website Backend

This directory contains the source-control copy of the Living Word Bibles website backend. It is a data/API backend only. It does not build, edit, generate, or overwrite website pages.

## Current release

- Backend version: `2.2.6`
- Build stamp: `06 October 2026 at 13:20:00Z UTC`
- Public storefront price endpoint: `?action=print-products`
- Portal price tools:
  - authenticated print-product list
  - manual price/date Save
  - on-demand automatic price refresh
- Daily price refresh support is provided by `scheduledPrintProductPriceRefresh`.
- `installDailyPrintPriceRefresh()` installs/replaces the daily 9:00 AM America/Indiana/Indianapolis trigger.

## Print Products pricing

`Print Products` remains the authoritative record used by the public Print Bibles and Christian Books storefronts.

For participating ASINs, v2.2.6 can retrieve the current featured New offer buying price, write `current_price` and `price_observed_date`, and republish the existing public snapshot.

Safeguards:

- no usable current featured New offer → keep the existing stored price unchanged;
- blank/invalid prices are never published as `$0.00`;
- the existing manual Portal Price Reconcile Save workflow remains available;
- the separately managed God Bless The USA Bible listing is not part of the automatic ASIN refresh;
- transient retail-service failures do not erase or zero existing prices.

## Private configuration

Private retail credentials are not stored in this README or in checked-in source.

The backend expects these private runtime properties to already be configured in the deployed backend project:

- `LWB_RETAIL_CLIENT_ID`
- `LWB_RETAIL_CLIENT_SECRET`
- `LWB_RETAIL_PARTNER_TAG`

Do not commit credential values to source control.

## Public price delivery

The storefront continues to read `?action=print-products` through `/assets/js/print-products.js`.

The frontend displays the returned value as the **current featured new-offer price**. It does not label that value as a lowest price or a starting price.

## Deployment

When backend source changes, deploy a new version under the existing production backend deployment. Preserve the existing production deployment URL unless the platform requires a replacement.

Last documented: 06 October 2026 at 13:20:00Z UTC.
