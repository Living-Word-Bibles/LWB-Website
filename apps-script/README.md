# Living Word Bibles — Website Backend

This directory contains the source-control copy of the Living Word Bibles website backend. It is a data/API backend only. It does not build, edit, generate, or overwrite website pages.

## Current release

- Backend version: `2.2.7`
- Build stamp: `06 October 2026 at 14:09:11Z UTC`
- Public storefront price endpoint: `?action=print-products`
- Portal price tools:
  - authenticated print-product list
  - manual price/date Save
  - on-demand automatic price refresh
- Daily price refresh support is provided by `scheduledPrintProductPriceRefresh`.
- `installDailyPrintPriceRefresh()` installs/replaces the daily 9:00 AM America/Indiana/Indianapolis trigger.

## Print Products pricing

`Print Products` remains the authoritative record used by the public Print Bibles and Christian Books storefronts.

For participating ASINs, v2.2.7 can retrieve the current featured New offer buying price, write `current_price` and `price_observed_date`, and republish the existing public snapshot.

Safeguards:

- no usable current featured New offer → keep the existing stored price unchanged;
- blank/invalid prices are never published as `$0.00`;
- the existing manual Portal Price Reconcile Save workflow remains available;
- the separately managed God Bless The USA Bible listing is not part of the automatic ASIN refresh;
- transient retail-service failures do not erase or zero existing prices.


## v2.2.7 refresh behavior

The automatic refresh now reports separate counts for:

- eligible ASIN rows;
- successfully checked products;
- numeric price changes;
- observed-date refreshes;
- skipped products;
- failed products and failed batches.

A complete catalog/authentication failure is returned to the Portal as an error and can no longer appear as a successful `0 / 0 / 0` refresh.

Every successful observation writes today's `price_observed_date` even when the numeric price did not change.

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

Last documented: 06 October 2026 at 14:09:11Z UTC.
