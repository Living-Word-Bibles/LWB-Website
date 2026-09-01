[README.md](https://github.com/user-attachments/files/31715436/README.md)
[README.md](https://github.com/user-attachments/files/31714041/README.md)
<p align="center">
  <a href="https://www.livingwordbibles.com/">
    <img src="assets/LivingWordBibles01.png" alt="Living Word Bibles" width="320">
  </a>
</p>

<h1 align="center">Living Word Bibles Website</h1>

<p align="center"><strong>Production Static Website &amp; Digital Bible Platform</strong></p>

<p align="center">
  <a href="https://github.com/Living-Word-Bibles/LWB-Website/actions/workflows/deploy-pages.yml"><img alt="GitHub Pages deployment" src="https://github.com/Living-Word-Bibles/LWB-Website/actions/workflows/deploy-pages.yml/badge.svg?branch=main"></a>
  <img alt="Frontend package v2.6.0" src="https://img.shields.io/badge/frontend-v2.6.0-555555">
  <img alt="Google Apps Script v2.0.1" src="https://img.shields.io/badge/Google%20Apps%20Script-v2.0.1-555555">
  <img alt="Hosting GitHub Pages" src="https://img.shields.io/badge/hosting-GitHub%20Pages-555555">
</p>

<p align="center">
  <a href="https://www.livingwordbibles.com/"><strong>www.livingwordbibles.com</strong></a>
  &nbsp;•&nbsp;
  <a href="https://github.com/Living-Word-Bibles/LWB-Website"><strong>GitHub Repository</strong></a>
</p>

<p align="center"><sub>© 2026 Living Word Bibles | All Rights Reserved | Developed by <a href="https://cts.cook-international.com">Cook Technology Services</a> in Chicago, Illinois | Last Updated on 01 September 2026 at 22:08:45Z UTC</sub></p>

---

## Production status

This repository is the production source for **Living Word Bibles** at **https://www.livingwordbibles.com/**.

The website uses a **plain static GitHub Pages architecture**. Checked-in page-level HTML files are the production source of truth. There is no generated `dist/` site, no `build.mjs`, and no site-generation step that rewrites page content before deployment.

A push to `main` validates the checked-in static tree and publishes the repository root directly to GitHub Pages.

### Current release metadata

| Component | Current value |
|---|---|
| Production site | `https://www.livingwordbibles.com/` |
| Deployment branch | `main` |
| Frontend package version | `2.6.0` |
| Google Apps Script version | `2.0.1` |
| Apps Script build stamp | `01 September 2026 at 21:22:11Z UTC` |
| Runtime configuration architecture stamp | `2026-08-27T14:59:40Z` |
| Static-site architecture repair timestamp | `2026-08-27T22:28:20Z` |
| README revision | `01 September 2026 at 22:08:45Z UTC` |

> **Architecture rule:** page HTML is authoritative. Shared includes, runtime JavaScript, validation tooling, the Google Apps Script backend, and GitHub Actions support the site; none of them should regenerate or overwrite page bodies.

---



## What's New in v2.6.0 — Legal, Licensing & Editorial Alignment

Released **01 September 2026 at 22:08:45Z UTC**. Google Apps Script remains **v2.0.1**; this release does not change the backend or spreadsheet architecture.

### Legal-policy refresh

- Updated `/terms-of-service/` for the current account-library architecture, including automatic free KJV Special and Douay-Rheims entitlements, eligible eBible/PDF entitlements, PayPal transaction reconciliation, administrative entitlement corrections, and the separation of print purchases from digital account access.
- Updated `/privacy-policy/` to disclose site-wide page/click/form-event logging, authenticated customer context, portal administrator audit records, purchase-reconciliation processing, newsletter suppression records, and the current logger's deliberate exclusion of typed form values, passwords, verification/reset tokens, and URL query strings from ordinary click telemetry.
- Updated `/editorial-standards/` with dedicated standards for the KJV Audio Bible, Ethiopian Bible resources, digital product/account-entitlement accuracy, licensing implementations, corrections, privacy, and AI-assisted editorial work.

### App and publisher licensing

- Rebuilt `/app-licensing/` with **Effective Date: 30 September 2025**.
- Corrected the standard public web embed license to **KJV only**.
- Clarified that other translations may be made available only to **churches and religious nonprofit organizations**, on an organization-specific basis, and only under the controlling copyright holder's license terms and the scope of LWB's own permission.
- Clarified that LWB does not grant a sublicense in copyrighted Bible translations it does not own.
- Preserved the standard iOS licensing program as **KJV only** unless separate written approval and rightsholder permissions apply.
- Updated `/licensing/` to distinguish publisher-facing compliance from the narrower public App Licensing program.

### Copyright and translation presentation

- Updated `/copyright-notice/` and `/licensing/` with smaller Bible cover-style icons beneath each translation name.
- Translation names and cover icons link to the relevant LWB product or reader.
- Existing LWB-owned local edition covers are used where available; LWB-created book icons are used where reproducing a third-party publisher cover is unnecessary.
- Added the **KJV Audio Bible** and **The Complete Apocrypha of the Ethiopian Bible** to the Copyright Notice with explicit separation between underlying public-domain/ancient source material and LWB's protectable interface, compilation, metadata, formatting, curation, artwork, and edition elements.

### EEO and veteran policy

- Updated `/eeo/` to mirror the structure and substance of the current Cook Services Company, LLC veteran-employment policy.
- The veteran section now contains: **Policy Statement; Covered Veteran Categories; Equal Employment Opportunity for Veterans; Veteran Outreach; Reemployment and Military Service; Confidentiality; Questions and Reporting**.
- Added the general veteran definition and the four protected-veteran categories: **Disabled Veteran, Recently Separated Veteran, Active-Duty Wartime or Campaign Badge Veteran, and Armed Forces Service Medal Veteran**.
- Updated veteran-service references to include U.S. **ground, air, naval, or space service**.

### Cook Services Company operator links

- Standardized the visible “Operated by Cook Services Company, LLC” legal-page badges to link to **https://www.cook-international.com** instead of email links.

---

## What's New in v2.5.9 / Google Apps Script v2.0.1

### New `/portal/` administration page

v2.5.9 adds a private administration route at:

```text
https://www.livingwordbibles.com/portal/
```

The page is marked `noindex,nofollow,noarchive` and is intentionally **not** added to the public sitemap or global navigation.

The portal uses the existing static GitHub Pages + Google Apps Script architecture. It does **not** add an Admin sheet, Portal sheet, click-log sheet, or any other new spreadsheet tab.

Portal login reads these rows from the existing **Settings** tab:

```text
admin_user
admin_password
admin_display_name
admin_email
admin_enabled
admin_session_minutes
admin_created_at
admin_updated_at
```

The values remain editable as normal Settings rows. As requested, `admin_password` is read as a simple plain-text Settings value and is **not stored as a password hash**. The backend creates a short-lived signed portal session token after successful login so the sheet password is not persisted in the browser.

Changing the Settings credentials invalidates new logins immediately. Updating the admin password and `admin_updated_at` also invalidates existing signed portal sessions.

### Portal subscriber management

The **Subscribers** area works entirely through the existing:

- `Newsletter Subscribers`
- `Audience Memberships`
- `Do Not Email`
- `System Log`

tabs.

Administrators can:

- search subscriber records;
- add a new subscriber;
- reactivate an existing subscriber;
- explicitly re-subscribe an address that had previously opted out when the administrator checks the re-subscribe override;
- unsubscribe/remove an address through the same working opt-out logic already used by `/opt-out/`; and
- review the resulting activity in System Log.

An ordinary unsubscribe continues to preserve the subscriber row for audit history, mark it `unsubscribed`, add/update Do Not Email, and deactivate related audience memberships.

### Portal HTML newsletter composer

The new **Newsletter** area lets an administrator type a custom newsletter directly in the browser.

The editor supports:

- subject and preheader;
- bold, italic, and underline;
- headings and paragraphs;
- bullet lists;
- hyperlinks;
- CTA-style buttons;
- a customizable signature;
- a sandboxed email preview;
- a single-address test send; and
- personalization tokens `{{first_name}}` and `{{email}}`.

The backend sanitizes custom HTML before it is queued. Script elements, embedded frames/objects, forms, input fields, inline event handlers, and `javascript:` URLs are removed.

Custom portal newsletters use the same Living Word Bibles branded HTML mail shell introduced in v2.0.0:

- Living Word Bibles logo;
- slogan;
- Read the Bible Online;
- History of the Bible;
- eStore;
- Terms of Service;
- Privacy Policy;
- personalized unsubscribe link;
- copyright line; and
- Cook Technology Services attribution.

The administrator-controlled signature is inserted above the standard legal/navigation footer.

### Newsletter batching remains restricted

The v2.0.0 newsletter delivery safeguards remain mandatory in v2.0.1:

- **99 recipients maximum per subscriber batch**;
- only one campaign batch on an eligible sending date;
- subscriber batches send only on **Monday, Wednesday, and Friday**; and
- transactional account, password, verification, and one-address test messages are not placed into the subscriber campaign queue.

The portal's **Process Eligible Batch** button calls the same guarded campaign processor. It cannot bypass the weekday or 99-recipient rules.

### Account and purchase administration

The **Accounts & Purchases** area uses the existing:

- `Customers`
- `Orders`
- `Order Items`
- `Entitlements`
- `Products`
- `Digital Assets`
- `System Log`

tabs.

Administrators can:

- load an account by customer email;
- review account status, orders, and entitlements;
- reconcile a verified PayPal transaction to a selected account;
- optionally reassign a transaction that is already attached to another account;
- manually grant an eligible product to an account;
- revoke an eligible non-default entitlement;
- add a portal-created manual purchase using the existing Orders + Order Items + Entitlements model; and
- remove a portal-created manual purchase while retaining its audit record as `removed`.

Product eligibility remains unchanged:

```text
product_type = ebook
OR
Living Word Bibles Ethiopian Bible PDF
```

Print products and other non-library products cannot be attached through the portal.

The two required free account products remain protected:

- `prod_kjv_special`
- `prod_drb`

The portal will not revoke those products because every verified Living Word Bibles account is required to have them.

The Ethiopian Bible / Complete Apocrypha PDF remains account-eligible and continues to use:

```text
/assets/products/EthiopianApocryphaPDF.pdf
```

### Expanded existing System Log

v2.5.9 adds `/assets/js/activity-log.js` through the canonical shared footer so the existing **System Log** receives site-wide activity without adding another spreadsheet tab.

The logger records:

- page views;
- clicks;
- form-submit actions;
- page path;
- safe destination path;
- element/tag label;
- authenticated account identity when a valid account session is available;
- portal administrator identity when a valid portal session is available; and
- client/session metadata useful for site auditing.

For security and privacy, the activity logger deliberately does **not** record:

- form field values;
- passwords;
- password-reset tokens;
- email-verification tokens; or
- URL query strings.

Telemetry posts are handled without the main Apps Script write lock so normal site clicks do not block account, payment, subscriber, newsletter, or portal operations.

All administrative operations also create explicit System Log events, including administrator login attempts, subscriber changes, newsletter tests/queues/batches, entitlement changes, purchase reconciliation, and manual-purchase changes.

### Spreadsheet architecture

**No new spreadsheet tabs or columns are required by v2.5.9 / Apps Script v2.0.1.**

The release uses the existing sheet architecture and the Settings rows already added for portal administration.

### Surgical file set for v2.5.9 / v2.0.1

Only these files need to be added or replaced:

```text
/apps-script/Code.gs
/portal/index.html
/assets/js/portal.js
/assets/js/activity-log.js
/assets/includes/lwb-footer.html
/README.md
```

No account page, payment-complete page, opt-out page, `auth.js`, `forms.js`, `config.js`, header include, PayPal button configuration, Products schema, or sitemap replacement is required for this portal pass.

### Deployment notes

1. Replace the existing Apps Script source with `/apps-script/Code.gs`.
2. Save and deploy a new production Web App version from the existing Apps Script project.
3. Keep the existing production Web App URL when possible so `/assets/js/config.js` does not need to change.
4. Upload `/portal/index.html`.
5. Upload `/assets/js/portal.js` and `/assets/js/activity-log.js`.
6. Replace `/assets/includes/lwb-footer.html` so the global activity logger is loaded through the canonical footer.
7. Replace `README.md`.
8. Do **not** add `/portal/` to `sitemap.xml`.
9. Keep the existing newsletter daily trigger installed with `installNewsletterCampaignTrigger()` so the campaign processor can evaluate the Monday/Wednesday/Friday rules.

---

## What's New in v2.5.8 / Google Apps Script v2.0.0

### Account purchase reconciliation

- Added **Reconcile Purchase(s)** to the Living Word Bibles account navigation on the Overview, Library, Orders, and Profile pages.
- `/payment-complete/` now doubles as the account purchase-reconciliation page.
- A signed-in user can enter a **PayPal transaction ID** and ask the backend to verify and attach the purchase to the current account.
- Reconciliation refuses a transaction already attached to another Living Word Bibles customer account.
- Reconciliation is intentionally restricted to account-library products:
  - `product_type = ebook`; and
  - the Living Word Bibles **Ethiopian Bible / Complete Apocrypha PDF**.
- Print Bibles, donations, the app purchase, and other non-library transactions do not become account entitlements.
- Existing completed PayPal orders can be attached without creating duplicate orders or entitlements.
- A newly verified PayPal transaction can still be recorded through the existing PDT verification path and then attached to the signed-in account.

### Free account library

Every verified Living Word Bibles account automatically receives these two free products:

- `prod_kjv_special` — **The Holy Bible: King James Version Special Edition**
- `prod_drb` — **The Holy Bible: Douay-Rheims Bible**

The backend checks these defaults when an account is verified, when the user signs in, and when account data is loaded. Existing entitlements are reused, so the process does not create duplicate active entitlements.

### Ethiopian Bible PDF account support

The backend recognizes the Ethiopian Bible product using the configured product record and the production Hosted Button ID:

```text
8Z63ZMZEALLG4
```

The production repository PDF is:

```text
/assets/products/EthiopianApocryphaPDF.pdf
```

If the Ethiopian Bible product is present in `Products`, it is eligible for account reconciliation even though it is a PDF rather than an EPUB eBible. The backend also provides the repository PDF path as a fulfillment fallback if no separate Digital Assets row has been configured yet.

The product row should remain an active digital product and should use `product_type = pdf`. Supported Ethiopian identifiers in v2.0.0 include the current `/ethiopian-bible/` naming and the `prod_ethiopian_apocrypha` product ID.

### Newsletter opt-out

- The already-working backend unsubscribe behavior is preserved.
- An opt-out continues to update the existing row in **Newsletter Subscribers** to `unsubscribed`, set unsubscribe/update timestamps, add or update the address in **Do Not Email**, and deactivate audience memberships.
- `/opt-out/` now accepts `?email=` so personalized email unsubscribe links can prefill the subscriber's address before submission.
- Subscriber records are retained for audit/history rather than physically deleted from the spreadsheet.

### Branded HTML email system

Google Apps Script v2.0.0 adds one shared branded email shell with:

- Living Word Bibles logo;
- the Living Word Bibles slogan;
- responsive HTML layout suitable for Gmail and other major email clients;
- links to **Read the Bible Online**, **History of the Bible**, **eStore**, **Terms of Service**, and **Privacy Policy**;
- personalized **Unsubscribe** links on newsletter emails;
- Living Word Bibles copyright and Cook Technology Services attribution; and
- plain-text fallback content for every email.

Account registration now sends a **Welcome to Living Word Bibles — verify your account** email. The welcome message explains that the KJV Special Edition and Douay-Rheims Bible are included free with every verified account.

Password-reset emails use the same branded layout.

### Newsletter feature templates

Google Apps Script v2.0.0 includes at least twelve reusable feature-newsletter templates. Current template keys are:

1. `read_bible_online`
2. `audio_bible`
3. `history_of_the_bible`
4. `estore`
5. `ethiopian_bible`
6. `bible_study`
7. `prayers`
8. `maps`
9. `print_bibles`
10. `bible_app`
11. `translations`
12. `catholic_bible`
13. `free_bibles`

For testing a single template from Apps Script:

```javascript
sendNewsletterTemplateTest('example@example.com', 'audio_bible');
```

### Newsletter batching safeguards

Newsletter campaigns are deliberately separated from transactional account email.

**Newsletter-only rules:**

- no more than **99 recipients per batch**;
- only one newsletter batch can be sent on a given sending date;
- scheduled campaign processing sends only on **Monday, Wednesday, and Friday**;
- campaign batches therefore land on different weekdays rather than all being sent at once;
- MailApp's remaining daily quota is checked before sending; and
- transactional email such as welcome/verification and password resets is not delayed by the newsletter schedule.

To install the once-daily campaign processor:

```javascript
installNewsletterCampaignTrigger();
```

To start a campaign:

```javascript
startNewsletterCampaign('history_of_the_bible');
```

The daily trigger may execute every day, but `processNewsletterCampaign()` sends only on Monday, Wednesday, and Friday and never sends more than 99 newsletter recipients in one batch.

---

## Account routes

| Route | Purpose |
|---|---|
| `/account/` | Account overview |
| `/account/library/` | Digital eBible/PDF library |
| `/account/orders/` | Account order history |
| `/account/profile/` | Account profile |
| `/payment-complete/?reconcile=1` | Reconcile eligible PayPal purchases with the signed-in account |

All four account pages expose **Reconcile Purchase(s)** in the account navigation.

---

## Google Apps Script backend

The source-controlled backend lives at:

```text
/apps-script/Code.gs
```

Current backend metadata:

```text
Service: LWB Website API
Version: 2.0.0
Apps Script build stamp: 01 September 2026 at 20:47:21Z UTC
```

The backend is a **data/API service only**. It does not create, regenerate, or overwrite website HTML.

### Backend resources

| Resource | Value |
|---|---|
| Google Sheet | `LWB Website` |
| Product folder | `LWB Product Files` |
| Public contact | `gospellivingwordbibles@gmail.com` |

### Current public API actions

**GET**

- `?action=ping`
- `?action=health`
- `?action=settings`
- `?action=products`
- `?action=product&slug=...`
- `?action=social`
- `?action=free-download-link&product=...`
- `?action=verify-pdt&tx=...&product=...`
- `?action=download&token=...`

**POST**

- `subscribe`
- `unsubscribe`
- `contact`
- `register`
- `login`
- `forgot-password`
- `reset-password`
- `verify-email`
- `account`
- `reconcile-purchase`
- `free-download`

### Backend data model

The Apps Script source references the existing operational sheets:

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

No new spreadsheet tab is required by v2.0.0.

Server-side secrets such as `DOWNLOAD_TOKEN_SECRET`, account-authentication secrets, and the PayPal PDT identity token belong in Apps Script Properties and must never be committed to this repository.

---

## eStore, Print Bibles, and PayPal

The core eStore presents free and paid digital Bible editions. The Ethiopian Bible PDF is offered through its dedicated page at `/ethiopian-bible/`. Print Bibles remain separate at:

```text
/estore/print-bibles/
```

Print Bibles are external Amazon purchases and are **not** Living Word Bibles account-library entitlements.

### PayPal Hosted Buttons

| Purpose | Hosted Button ID |
|---|---|
| KJV eBible | `YXUZPMWTKME24` |
| ASV eBible | `KBJTWT23LA6JN` |
| YLT eBible | `5A5Z2VDH74DFG` |
| WEB eBible | `K7C2SJYLCDKMU` |
| Ethiopian Bible PDF | `8Z63ZMZEALLG4` |
| LWB Bible App | `4HCP6WRVGQNV2` |
| Donate | `QQDSDMS4D9FC4` |

**v2.0.0 does not change any PayPal Hosted Button ID, receiver email, product price, or merchant configuration.**

---

## Shared header and footer

The universal site shell remains maintained in:

```text
/assets/includes/lwb-header.html
/assets/includes/lwb-footer.html
```

No shared header/footer replacement is required for v2.5.8.

---

## Runtime configuration

`assets/js/config.js` remains the single public runtime configuration file for the Apps Script Web App URL and public contact email. Individual pages should not hard-code alternate backend deployments.

No `assets/js/config.js` replacement is required for this release unless the Apps Script deployment URL itself changes after publishing v2.0.1.

---

## Validation — not a build

The Node package is used for validation only.

```bash
npm ci
npm run validate
```

There is intentionally **no `npm run build` command**.

---

## Deployment

Deployment remains handled by `.github/workflows/deploy-pages.yml`.

A push to `main` validates the repository and publishes the **repository root (`.`)** directly to GitHub Pages. There is no generated production output directory.

For Apps Script v2.0.1, replace the Apps Script source with `/apps-script/Code.gs`, save it in the existing Apps Script project, and deploy a new Web App version using the same production configuration. If the production Web App URL remains the same deployment URL, no frontend config change is necessary.

---

## v2.5.7 and earlier highlights

- **v2.5.7:** Finalized the 88-book Ethiopian Bible historical presentation and connected Ethiopian Bible history navigation.
- **v2.5.6:** Added the long-form About the Ethiopian Bible page, reciprocal product/history navigation, bibliography, media, and sitemap coverage.
- **v2.5.5:** Expanded Print Bibles to seven Amazon-linked editions and expanded About Us with Audio Bible and Print Bibles coverage.
- **v2.5.4:** Repaired the KJV Audio Bible slideshow manifest path and synchronized the human-readable site map.
- **v2.5.3:** Added the KJV Audio Bible, LibriVox playback experience, slideshow system, shared navigation entry, and homepage hero.
- **v2.5.2:** Added the Print Bibles storefront.
- **v2.5.1:** Enhanced Bible Translation History pages with historical imagery and source notes.
- **v2.5.0:** Rebuilt the canonical public sitemap inventory.
- **v2.4.x:** Refined About Us, Bible Study, Christian Living, History, EEO, shared navigation, and mobile presentation.
- **v2.3.0:** Added Bible Study, expanded verse studies, and Common Prayers.
- **v2.2.0:** Expanded Books of the Bible histories and History navigation.
- **v2.1.0:** Updated PayPal download flows and Editorial Standards.

---

## Operational safeguards

Before merging or deploying this release:

- Run `npm run validate`.
- Preserve the existing Apps Script Properties and PayPal credentials.
- Confirm `PAYPAL_PDT_IDENTITY_TOKEN` remains configured in Apps Script Properties before testing reconciliation of previously unrecorded transactions.
- Confirm the Ethiopian Bible product exists in `Products` and uses Hosted Button ID `8Z63ZMZEALLG4`.
- Confirm `/assets/products/EthiopianApocryphaPDF.pdf` resolves in production.
- Confirm `prod_kjv_special` and `prod_drb` remain active Products rows.
- Test a brand-new account: verify email, sign in, and confirm both free Bibles appear in Library.
- Test an existing account to confirm the free products are added once without duplicates.
- Test `/payment-complete/?reconcile=1` with an eligible eBible transaction ID.
- Test the Ethiopian Bible PDF transaction reconciliation.
- Test that a non-library PayPal transaction is refused for account attachment.
- Test `/opt-out/?email=example@example.com` and confirm the email field pre-fills and the existing unsubscribe logic updates `Newsletter Subscribers`.
- Run a newsletter template test before starting a campaign.
- Confirm newsletter processing never exceeds 99 recipients per batch and only sends on Monday, Wednesday, and Friday.
- Push only the files intentionally changed.

---

## Repository identity

**Living Word Bibles** develops and publishes Bible reading resources, translation histories, Catholic Bible resources, digital Bible editions, audio Bible resources, and related study material for the web and supported devices.

- **Production:** https://www.livingwordbibles.com/
- **Public email:** gospellivingwordbibles@gmail.com
- **Repository:** https://github.com/Living-Word-Bibles/LWB-Website
- **Developer:** https://cts.cook-international.com

---

**Repository architecture revision:** `2026-08-27T22:28:20Z`  
**Apps Script build stamp:** `01 September 2026 at 21:22:11Z UTC`  
**Google Apps Script version:** `2.0.1`  
**Frontend package version:** `2.5.9`  
**README last updated:** **01 September 2026 at 21:22:11Z UTC**

---

<p align="center"><strong>© 2026 Living Word Bibles | All Rights Reserved | Developed by <a href="https://cts.cook-international.com">Cook Technology Services</a> in Chicago, Illinois | Last Updated on 01 September 2026 at 22:08:45Z UTC</strong></p>
