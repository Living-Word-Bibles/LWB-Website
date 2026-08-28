# Living Word Bibles — Google Apps Script backend

This directory contains the source-control copy of the **LWB Backend** used by the static Living Word Bibles website. It is a data/API backend only. It does **not** build, edit, generate, or overwrite website pages.

## Current resources

- Google account: `gospellivingwordbibles@gmail.com`
- Spreadsheet: `LWB Website`
- Spreadsheet ID: `1xnzdo1UJsEOTqcO2066Nfb6ayqKn8Zg5RbNLdpbaTcc`
- Product folder: `LWB Product Files`
- Product folder ID: `1G6H26CknI1XI090cMVVjb8aVYxM94APP`
- Deployed Web App: `LWB Backend`
- Web App URL: `https://script.google.com/macros/s/AKfycbwHIonCe2_aijuiflRSq1jtXMpueX6DCoVIssW-YRqWT3gDisH13g1UzJrhnY1KteM1/exec`

The website consumes this URL through `assets/js/config.js`.

## Current public endpoints

- `?action=ping`
- `?action=health`
- `?action=settings`
- `?action=products`
- `?action=product&slug=...`
- `?action=social`
- `?action=free-download-link&product=...`
- `?action=verify-pdt&tx=...&product=...`
- `?action=download&token=...`

POST actions currently implemented by the source-controlled backend include `subscribe`, `unsubscribe`, `contact`, and `free-download`.

## Paid product files

The private Drive folder contains the paid EPUB assets using these exact filenames:

- `kjv.epub`
- `asv.epub`
- `ylt.epub`
- `web.epub`

Free EPUBs remain static website assets and are not moved into paid fulfillment:

- `/assets/products/kjvspecial.epub`
- `/assets/products/drb.epub`

## Script Properties

The core setup function records the current Sheet/folder IDs and creates `DOWNLOAD_TOKEN_SECRET` if missing. PayPal settings remain separate.

`PAYPAL_PDT_IDENTITY_TOKEN` and `PAYPAL_RECEIVER_EMAIL` are **not** supplied or changed by the website migration. Do not replace a PayPal receiver email merely because the public website contact email changed.

## Deployment

When the Apps Script source itself is changed, create a new Web App deployment version under the existing **LWB Backend** deployment. If Google issues a different `/exec` URL, change only `assets/js/config.js` in the website repository.

Last documented: **27 August 2026 at 14:59:40Z UTC**.
