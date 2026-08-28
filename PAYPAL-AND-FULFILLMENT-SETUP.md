# PayPal Auto Return and Google Drive Fulfillment

## Account-wide fallback

Set PayPal Auto Return to:

```text
https://www.livingwordbibles.com/payment-complete/
```

This is a general fallback only. The paid eBible Hosted Buttons should use their product-specific return URLs below.

## Paid eBible Hosted Buttons

| Product | Hosted Button ID | Item number | Auto Return URL |
|---|---|---|---|
| KJV | `YXUZPMWTKME24` | `the-holy-bible-king-james-version` | `https://www.livingwordbibles.com/estore/order-complete/?product=the-holy-bible-king-james-version` |
| ASV | `KBJTWT23LA6JN` | `the-holy-bible-american-standard-version-asv` | `https://www.livingwordbibles.com/estore/order-complete/?product=the-holy-bible-american-standard-version-asv` |
| YLT | `5A5Z2VDH74DFG` | `the-holy-bible-youngs-literal-translation-ylt` | `https://www.livingwordbibles.com/estore/order-complete/?product=the-holy-bible-youngs-literal-translation-ylt` |
| WEB | `K7C2SJYLCDKMU` | `the-holy-bible-world-english-bible-web` | `https://www.livingwordbibles.com/estore/order-complete/?product=the-holy-bible-world-english-bible-web` |

The Apps Script also recognizes the exact product title and title plus abbreviation, but setting the item number to the slug gives the most reliable verification.

## Other Hosted Buttons

| Purpose | Hosted Button ID | Return URL |
|---|---|---|
| LWB Bible App | `4HCP6WRVGQNV2` | Keep the direct app destination configured in PayPal. |
| Donation | `QQDSDMS4D9FC4` | `https://www.livingwordbibles.com/donate/thank-you/` |

## What the return page does

1. PayPal returns a transaction ID in the `tx` parameter.
2. `/estore/order-complete/` sends that transaction ID to Apps Script.
3. Apps Script exchanges it with PayPal using the PDT identity token.
4. Apps Script requires a successful PDT response, `Completed` status, a recognized item, the exact USD amount, and the expected merchant when configured.
5. It records the order and grants an entitlement to the PayPal payer email.
6. It creates an expiring signed download URL.
7. The download endpoint redirects to the matched file in the configured Google Drive folder.

The browser return URL by itself is never treated as proof of payment.

## Drive filenames

The paid files belong in the existing `LWB Product Files` Drive folder with these exact filenames:

- `kjv.epub`
- `asv.epub`
- `ylt.epub`
- `web.epub`

The two free products remain in the public repository:

- `/assets/products/kjvspecial.epub`
- `/assets/products/drb.epub`
