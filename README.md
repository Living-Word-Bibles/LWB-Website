[README.md](https://github.com/user-attachments/files/31712376/README.md)
<p align="center">
  <a href="https://www.livingwordbibles.com/">
    <img src="assets/LivingWordBibles01.png" alt="Living Word Bibles" width="320">
  </a>
</p>

<h1 align="center">Living Word Bibles Website</h1>

<p align="center"><strong>Production Static Website &amp; Digital Bible Platform</strong></p>

<p align="center">
  <a href="https://github.com/Living-Word-Bibles/LWB-Website/actions/workflows/deploy-pages.yml"><img alt="GitHub Pages deployment" src="https://github.com/Living-Word-Bibles/LWB-Website/actions/workflows/deploy-pages.yml/badge.svg?branch=main"></a>
  <img alt="Frontend package v2.5.8" src="https://img.shields.io/badge/frontend-v2.5.8-555555">
  <img alt="Google Apps Script v2.0.0" src="https://img.shields.io/badge/Google%20Apps%20Script-v2.0.0-555555">
  <img alt="Hosting GitHub Pages" src="https://img.shields.io/badge/hosting-GitHub%20Pages-555555">
</p>

<p align="center">
  <a href="https://www.livingwordbibles.com/"><strong>www.livingwordbibles.com</strong></a>
  &nbsp;•&nbsp;
  <a href="https://github.com/Living-Word-Bibles/LWB-Website"><strong>GitHub Repository</strong></a>
</p>

<p align="center"><sub>© 2026 Living Word Bibles | All Rights Reserved | Developed by <a href="https://cts.cook-international.com">Cook Technology Services</a> in Chicago, Illinois | Last Updated on 01 September 2026 at 20:47:21Z UTC</sub></p>

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
| Frontend package version | `2.5.8` |
| Google Apps Script version | `2.0.0` |
| Apps Script build stamp | `01 September 2026 at 20:47:21Z UTC` |
| Runtime configuration architecture stamp | `2026-08-27T14:59:40Z` |
| Static-site architecture repair timestamp | `2026-08-27T22:28:20Z` |
| README revision | `01 September 2026 at 20:47:21Z UTC` |

> **Architecture rule:** page HTML is authoritative. Shared includes, runtime JavaScript, validation tooling, the Google Apps Script backend, and GitHub Actions support the site; none of them should regenerate or overwrite page bodies.

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

No `assets/js/config.js` replacement is required for this release unless the Apps Script deployment URL itself changes after publishing v2.0.0.

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

For Apps Script v2.0.0, replace the Apps Script source with `/apps-script/Code.gs`, save it in the existing Apps Script project, and deploy a new Web App version using the same production configuration. If the production Web App URL remains the same deployment URL, no frontend config change is necessary.

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
**Apps Script build stamp:** `01 September 2026 at 20:47:21Z UTC`  
**Google Apps Script version:** `2.0.0`  
**Frontend package version:** `2.5.8`  
**README last updated:** **01 September 2026 at 20:47:21Z UTC**

---

<p align="center"><strong>© 2026 Living Word Bibles | All Rights Reserved | Developed by <a href="https://cts.cook-international.com">Cook Technology Services</a> in Chicago, Illinois | Last Updated on 01 September 2026 at 20:47:21Z UTC</strong></p>
