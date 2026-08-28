# LWB Website Workbook Schema

The `LWB Website` spreadsheet contains these operational tabs:

- `Settings`
- `Products`
- `Product Features`
- `Product Images`
- `Digital Assets`
- `Customers`
- `Orders`
- `Order Items`
- `Entitlements`
- `Download Log`
- `Newsletter Subscribers`
- `Audience Memberships`
- `Do Not Email`
- `Contact Messages`
- `Newsletter Campaigns`
- `Social Posts`
- `System Log`

Exact headers are declared in `apps-script/Code.gs` under `SCHEMAS`.

## Products

The checked-in eStore HTML is the static fallback and remains usable without the Sheet. The Products tab can enhance product title, price, description, cover, canonical path, and Hosted Button ID through the API after the new backend is connected.

## Digital Assets

Important columns:

```text
asset_id product_id asset_type repository_path drive_file_name drive_file_id drive_resource_key mime_type download_name active max_downloads updated_at
```

The paid EPUB rows in `Digital Assets` are linked to files in the existing `LWB Product Files` Drive folder by `drive_file_name`. Paid products intentionally have no public repository path.

## Customers and entitlements

Firebase owns identity and passwords. Apps Script stores only Firebase UID, verified email metadata, orders, and entitlements. Purchases are attached to the PayPal payer email; when a Firebase user signs in with the same address, the account bridge returns matching library/order data.
