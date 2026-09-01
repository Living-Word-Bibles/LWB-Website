[READMEv2.5.7.md](https://github.com/user-attachments/files/31705976/READMEv2.5.7.md)
<p align="center">
  <a href="https://www.livingwordbibles.com/">
    <img src="assets/LivingWordBibles01.png" alt="Living Word Bibles" width="320">
  </a>
</p>

<h1 align="center">Living Word Bibles Website</h1>

<p align="center"><strong>Production Static Website &amp; Digital Bible Platform</strong></p>

<p align="center">
  <a href="https://github.com/Living-Word-Bibles/LWB-Website/actions/workflows/deploy-pages.yml"><img alt="GitHub Pages deployment" src="https://github.com/Living-Word-Bibles/LWB-Website/actions/workflows/deploy-pages.yml/badge.svg?branch=main"></a>
  <img alt="Frontend package v2.5.7" src="https://img.shields.io/badge/frontend-v2.5.7-555555">
  <img alt="Backend API v3.0.0" src="https://img.shields.io/badge/backend%20API-v3.0.0-555555">
  <img alt="Hosting GitHub Pages" src="https://img.shields.io/badge/hosting-GitHub%20Pages-555555">
</p>

<p align="center">
  <a href="https://www.livingwordbibles.com/"><strong>www.livingwordbibles.com</strong></a>
  &nbsp;•&nbsp;
  <a href="https://github.com/Living-Word-Bibles/LWB-Website"><strong>GitHub Repository</strong></a>
</p>

<p align="center"><sub>© 2026 Living Word Bibles | All Rights Reserved | Developed by <a href="https://cts.cook-international.com">Cook Technology Services</a> in Chicago, Illinois | Last Updated on 01 September 2026 at 18:30:30Z UTC</sub></p>

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
| Frontend package version | `2.5.7` |
| Google Apps Script API version | `3.0.0` |
| Apps Script build stamp | `27 August 2026 at 15:20:42Z UTC` |
| Runtime configuration architecture stamp | `2026-08-27T14:59:40Z` |
| Static-site architecture repair timestamp | `2026-08-27T22:28:20Z` |
| README revision | `01 September 2026 at 18:30:30Z UTC` |

> **Architecture rule:** page HTML is authoritative. Shared includes, runtime JavaScript, validation tooling, the Google Apps Script backend, and GitHub Actions support the site; none of them should regenerate or overwrite page bodies.

---

## What's New in v2.5.7

- Revised the canonical **About the Ethiopian Bible** page at `/ethiopian-bible/about/` so its title, metadata, structured data, headline, quick facts, article language, calls to action, bibliography annotations, and notes consistently identify the Living Word Bibles edition as an **88-book Ethiopian Bible**.
- Documented the edition's counting method as the familiar **66-book Protestant Bible plus 22 additional complete books**, producing the 88-book total used by Living Word Bibles.
- Added a concise **marketing-count clarification** explaining that the Ethiopian Bible product page uses the phrase **“20 Missing Books”** because **I, II, and III Meqabyan are grouped as one combined volume** for that presentation. Counting the three Meqabyan books individually produces 22 additional books and 88 books overall.
- Preserved the historical discussion of the Ethiopian Orthodox Tewahedo Church's commonly cited **81-book reckoning**, while explaining that book totals can differ when related writings, continuations, and multi-part works are grouped differently.
- Preserved the direct reference link to `/assets/products/EthiopianApocryphaPDF.pdf`, the long-form Geʿez and manuscript history, the embedded video, scholarly notes, and the Chicago-style annotated bibliography.
- Added an **Ethiopian Bible** button to the top navigation links on `/history-of-the-bible/`, positioned immediately after **King James Version** and linked directly to `/ethiopian-bible/about/`.
- Confirmed the Ethiopian Bible product page links readers to the print storefront through **Shop Ethiopian Bible in Print** at `/estore/print-bibles/`.
- Corrected the earlier README reference from the nonexistent `/print-books/` path to the checked-in and deployed `/estore/print-bibles/` route.
- Confirmed that the About page, Ethiopian Bible product page, History of the Bible page, and Print Bibles storefront all return successful production responses after deployment.

### Repository, commit, workflow, and Pages review

The public `main` branch and the release notes recorded in its commit messages were reviewed on 1 September 2026. The recent Ethiopian Bible sequence is consistent with the deployed files:

| Commit | Recorded change |
|---|---|
| [`7b8f01c`](https://github.com/Living-Word-Bibles/LWB-Website/commit/7b8f01c2dcf24fc0f565cd8304fc9c19e7ecfd76) | Uploaded `/ethiopian-bible/about/index.html` |
| [`0a73f93`](https://github.com/Living-Word-Bibles/LWB-Website/commit/0a73f936aa9706295b44f0c83b183e2d17613ee1) | Added the About-page link to `/ethiopian-bible/index.html` |
| [`e40c508`](https://github.com/Living-Word-Bibles/LWB-Website/commit/e40c50825993f910c0d7e2a02d2a42c67024103a) | Corrected the Ethiopian Bible image URL |
| [`674d26e`](https://github.com/Living-Word-Bibles/LWB-Website/commit/674d26e1b6d807f2cefedfbb26f9de13d2a77d3e) | Added the About page to `sitemap.xml` |
| [`0d98260`](https://github.com/Living-Word-Bibles/LWB-Website/commit/0d982609113cea17e63dafd2b18b10f39f44fb4d) | Added the About page to `/site-map/index.html` |
| [`f489ea3`](https://github.com/Living-Word-Bibles/LWB-Website/commit/f489ea3d15185ed6bbe5b707ce920be1323d72b4d) | Linked the Ethiopian Bible product page to the Print Bibles storefront |
| [`39102bb`](https://github.com/Living-Word-Bibles/LWB-Website/commit/39102bb5f889591713ad45cdd0765f70f177c382) | Updated the About page to the full 88-book presentation |
| [`8d7489f`](https://github.com/Living-Word-Bibles/LWB-Website/commit/8d7489fdb39a2fd000780b953d7f87bcbc4c6141) | Added the About the Ethiopian Bible link to the History page |

The checked-in `.github/workflows/deploy-pages.yml` remains a normal push-driven GitHub Pages workflow rather than a scheduled deployment. It:

- runs on pushes to `main` and on manual `workflow_dispatch` requests;
- checks out the repository, installs the locked Node dependencies with `npm ci`, and runs `npm run validate`;
- verifies the required static entry files and shared includes;
- uploads the checked-in repository root as the Pages artifact; and
- publishes only after the validation job succeeds.

The GitHub Actions run for commit `8d7489f`—**Update Bible History page | /history-of-the-bible/index.html**—completed successfully on its first attempt. Both **Validate checked-in static site** and **Publish website** passed, confirming that the latest checked-in page tree validated and deployed through GitHub Pages.

### Release safeguards

- No Google Apps Script backend code, API version, endpoint, spreadsheet schema, authentication, account, entitlement, or download-signing behavior was changed.
- No PayPal Hosted Button ID, merchant configuration, checkout flow, purchase redirect, or digital fulfillment behavior was changed.
- No shared header, shared footer, global stylesheet, or global JavaScript file was changed by the v2.5.7 content pass.
- The History page change is limited to one top-navigation link; the Ethiopian Bible About-page revision preserves its existing route, image, video, sources, notes, and bibliography.
- The established **310-URL** XML and human-readable sitemap inventory remains unchanged in v2.5.7 because no new canonical route was added.

---

## What's New in v2.5.6

- Added the new canonical **About the Ethiopian Bible** page at `/ethiopian-bible/about/`. Also updated the Ethiopian Bible page at `/ethiopian-bible/` to include a link to Print Bibles at `/estore/print-bibles/`.
- Added approximately **4,450 words of original long-form historical content** covering the rise of Christianity in Aksum, the translation of Scripture into Geʿez, the Garima Gospels, Ethiopian manuscript culture, the traditional eighty-one-book canon, distinctive books, worship, commentary, later revision, printing, modern translation, textual scholarship, common misconceptions, and responsible study.
- Explained the Ethiopian Orthodox Tewahedo Church's traditional **eighty-one-book canonical total** while carefully distinguishing book-counting conventions, the commonly described narrower and broader canons, and the difference between the Ethiopian Meqabyan books and the Greek Maccabean books.
- Added focused discussions of **1 Enoch, Jubilees, 1–3 Meqabyan, Sinodos, the Books of Covenant, Ethiopic Clement, and the Ethiopic Didascalia**.
- Added a prominent responsive YouTube embed near the top of the page using the supplied video `https://www.youtube.com/watch?v=f9Fs2A8_C-Q` through YouTube's privacy-enhanced `youtube-nocookie.com` embed domain.
- Added the locally bundled Ethiopian manuscript photograph at `/ethiopian-bible/about/ethiopian-bible-manuscript.jpg` with descriptive alternative text, responsive dimensions, visible creator/source attribution, and a direct license link.
- Preserved the photograph's actual **Creative Commons Attribution-ShareAlike 2.0** licensing information. Although the source gallery provides free downloads, the source identifies this Mark Fischer photograph as **CC BY-SA 2.0 rather than public domain**.
- Added a **Chicago-style annotated bibliography** drawing on current and foundational scholarship, the Ethiopian Orthodox Tewahedo Church's published canonical list, Oxford Academic, the Ethiopian Heritage Fund, manuscript research, and standard studies of Enoch, Jubilees, Geʿez translation, Aksum, and Ethiopian biblical interpretation.
- Added linked scholarly notes throughout the article and accessible return links from the notes to the main page content.
- Added responsive quick-fact cards, book-summary cards, licensed-image captioning, privacy-enhanced video presentation, mobile breakpoints, and scoped Garamond typography consistent with the established Living Word Bibles translation-history pages.
- Added complete page metadata for search and social sharing, including the canonical URL, description, Open Graph fields, Twitter Card fields, article image, publication/update dates, Article schema, WebPage schema, Organization/WebSite relationships, and breadcrumb structured data.
- Added an **Explore the Ethiopian Bible Edition** button on the new About page linking back to `/ethiopian-bible/`.
- Updated `/ethiopian-bible/index.html` with a centered gold **About the Ethiopian Bible** button linking to `/ethiopian-bible/about/`, creating reciprocal navigation between the educational history and the existing digital-edition purchase page.
- Placed the new button beneath the Ethiopian Bible product-page introduction and above the existing two-column purchase grid so visitors can reach the history without disrupting the product presentation.
- Updated the production `sitemap.xml` to add `/ethiopian-bible/about`, increasing the canonical XML sitemap from **309 to 310 public URLs**.
- Updated the human-readable `/site-map/` page to add **About the Ethiopian Bible** beside the existing Ethiopian Bible entry and changed its displayed canonical-page total from **309 to 310**.
- Preserved the Ethiopian Bible PayPal Hosted Button ID `8Z63ZMZEALLG4`, product slug `ethiopian-bible`, digital-download instructions, fulfillment flow, support contacts, shared header/footer includes, and existing product JavaScript.
- Preserved the site's **plain static GitHub Pages architecture**. The new history is checked-in HTML with one local image asset and uses the established shared site shell.

### Ethiopian Bible page relationship in v2.5.6

| Path | Purpose | Reciprocal destination |
|---|---|---|
| `/ethiopian-bible/` | Living Word Bibles digital Ethiopian Bible edition and PayPal purchase page | `/ethiopian-bible/about/` |
| `/ethiopian-bible/about/` | Long-form Ethiopian Bible history, canon guide, media, notes, and annotated bibliography | `/ethiopian-bible/` |
| `/ethiopian-bible/about/ethiopian-bible-manuscript.jpg` | Locally bundled Mark Fischer manuscript photograph, CC BY-SA 2.0 | Displayed on the About page |

### Release safeguards

- No Google Apps Script backend code, API version, endpoint, spreadsheet schema, authentication logic, account behavior, entitlement logic, or download-signing behavior was changed.
- No PayPal merchant configuration, Hosted Button ID, purchase redirect, product slug, checkout logic, or fulfillment behavior was changed.
- No shared header, shared footer, global CSS, global JavaScript, or existing translation-history page was modified.
- The new About page contains exactly one locally bundled image and uses the existing `/assets/css/site.css`, `/assets/js/config.js`, `/assets/js/site.js`, and `/assets/js/forms.js` resources.
- The new canonical route is present in both `sitemap.xml` and the human-readable `/site-map/`; both now represent the same **310-URL** public inventory.
- `PUBLIC-PAGE-REGISTRY.json` was not supplied or modified in this change and should be synchronized to the new 310-route canonical inventory in the next route-maintenance pass.

---

## What's New in v2.5.5

- Expanded the **Print Bibles** storefront at `/estore/print-bibles/` from five to **seven curated Amazon-linked print Bible listings**.
- Added the **NET Bible** print listing using the supplied Amazon Associates destination `https://amzn.to/4i6jAJM` and the local storefront image **`/estore/print-bibles/net-aa.jpg`**.
- Added the **Ethiopian Bible** print listing using the supplied Amazon Associates destination `https://amzn.to/4cR2jk8` and the local storefront image **`/estore/print-bibles/ethiopian-aa.jpg`**.
- Preserved the existing KJV, NKJV, NIV, ESV, and NRSV Catholic Edition listings, producing a seven-edition Print Bibles catalog: **KJV, NKJV, NIV, ESV, NRSV Catholic Edition, NET, and Ethiopian Bible**.
- Preserved the established **Amazon Associates** presentation, including the storefront disclosure, per-product **Paid link** notices, sponsored/nofollow link attributes, and the notice that Amazon controls pricing, availability, sellers, shipping, fulfillment, and transaction processing.
- Kept the new Ethiopian Bible Amazon listing clearly distinct from Living Word Bibles' own Ethiopian Bible resources and digital product at `/ethiopian-bible/`; the Amazon print listing is an externally sold third-party print edition.
- Updated the **About Us** page at `/about-us/` to reflect the expanded ways readers can engage with Scripture through Living Word Bibles.
- Added a direct **Listen to the Bible** call to action from the About Us experience, linking to the KJV Audio Bible at `/audio-bible/`.
- Added new About Us promotional content for the **KJV Audio Bible**, explaining the listening experience and directing visitors to the Audio Bible player.
- Added new About Us promotional content for **Print Bibles**, directing visitors to `/estore/print-bibles/` and distinguishing Amazon-fulfilled physical editions from Living Word Bibles' directly offered digital products.
- Expanded About Us FAQ/help language to cover the Audio Bible and Print Bibles while preserving the existing mission, team, contact, newsletter, support, Bible Study, History, app, licensing, and third-party-order guidance.
- Preserved the site's **plain static GitHub Pages architecture**. These changes remain checked-in HTML and local storefront assets; no server-side store or build-generated page architecture was introduced.

### Print Bibles catalog in v2.5.5

| Translation / edition | Local image | Destination |
|---|---|---|
| King James Version (KJV) | `kjv-aa.jpg` | Amazon |
| New King James Version (NKJV) | `nkjv-aa.jpg` | Amazon |
| New International Version (NIV) | `niv-aa.jpg` | Amazon |
| English Standard Version (ESV) | `esv-aa.jpg` | Amazon |
| NRSV Catholic Edition | `nrsv-aa.jpg` | Amazon |
| NET Bible | `net-aa.jpg` | `https://amzn.to/4i6jAJM` |
| Ethiopian Bible | `ethiopian-aa.jpg` | `https://amzn.to/4cR2jk8` |

### Release safeguards

- No Google Apps Script backend code, API version, runtime endpoint, spreadsheet schema, or account/session behavior was changed.
- No PayPal Hosted Button ID, PayPal client configuration, eBible checkout behavior, digital fulfillment logic, or free-download path was changed.
- The two new Print Bibles links are Amazon Associates destinations; Amazon remains responsible for the external transaction and fulfillment.
- No canonical public route was added or removed by this release, so the established **309-URL sitemap count remains unchanged**.
- The KJV Audio Bible implementation and `/audio-bible/slides/images.json` slideshow architecture introduced and repaired in v2.5.3–v2.5.4 remain unchanged.
- The existing About Us anchors, shared global header/footer integration, contact/newsletter form wiring, and FAQ accordion behavior were preserved.

---

## What's New in v2.5.4

- Fixed the **KJV Audio Bible slideshow deployment path** that caused the player to display only the three built-in emergency fallback images.
- Confirmed that `/audio-bible/index.html` requests the slideshow manifest from **`/audio-bible/slides/images.json`**. The manifest must therefore be deployed at that exact path.
- Documented the three-image fallback behavior: if the manifest is missing, returns an HTTP error, contains invalid JSON, or otherwise cannot be loaded, the Audio Bible intentionally falls back to exactly **three built-in Gustave Doré images** so the player can continue to initialize.
- Restored the scalable Audio Bible visual-library configuration. The manifest contains the initial historic Bible-art records plus **six Wikimedia Commons collection definitions** and a maximum visual-library size of **1,200 images**.
- Preserved the runtime public-domain filter used for Wikimedia Commons expansion so remote files are admitted only when their metadata identifies them as **Public Domain, CC0, or not copyrighted**.
- Clarified that the 1,200-image design does **not** require 1,200 local image files. The checked-in manifest supplies seed records and collection instructions, while the browser expands the library from Wikimedia Commons at runtime up to the configured cap.
- Added the mobile-optimized promotional artwork **`/audio-bible/audio-bible-mobile.png`**, resized from the desktop KJV Audio Bible hero for portrait mobile presentation.
- Updated the public HTML **Site Map** at `/site-map/` so it now mirrors the current canonical route inventory used by the production XML sitemap.
- Expanded the HTML Site Map from its older abbreviated directory into a complete human-readable inventory of the current **309 canonical public URLs**.
- Added the routes that were missing from the older HTML Site Map, including **KJV Audio Bible, Bible Study, Print Bibles, Ethiopian Bible, Support, Editorial Standards, EEO, Catholic Bible resources, eBible product pages, Common Prayers, NLT and CSB histories/readers, all 66 Books of the Bible histories, and all 156 verse-study pages**.
- Removed noncanonical utility entries from the HTML Site Map, including login/account routes and the `/copyright/` redirect alias, and replaced the redirect entry with the canonical `/copyright-notice/` route.
- No new canonical URL was added to `sitemap.xml` in this release; the HTML Site Map was synchronized with the already established **309-URL XML sitemap**.

### Audio Bible slideshow path

```text
/audio-bible/
├── index.html
├── audio-bible.png
├── audio-bible-mobile.png
└── slides/
    └── images.json
```

If the Audio Bible is showing only the three emergency slides, verify first that this URL resolves successfully and displays the manifest:

```text
https://www.livingwordbibles.com/audio-bible/slides/images.json
```

### Release safeguards

- No Google Apps Script backend code, API version, runtime endpoint, spreadsheet schema, or account/session behavior was changed.
- No PayPal Hosted Button IDs, PayPal client configuration, eBible checkout behavior, digital fulfillment logic, or Amazon-linked Print Bible behavior was changed.
- No canonical URL was added to or removed from the production XML sitemap in this release.
- The Audio Bible remains a static GitHub Pages implementation; the slideshow repair is a checked-in manifest/deployment correction, not a new backend service.
- Public-domain audio and visual-source attribution remains visible on the Audio Bible page.

---

## What's New in v2.5.3

- Added the new canonical **KJV Audio Bible** experience at `/audio-bible/`, extending Living Word Bibles from online Bible reading into a dedicated public-domain Scripture listening experience.
- Integrated the complete **King James Version, 1769 Oxford Edition** recording from **LibriVox**, read by **Michael Armenta**. The source recording is organized into **127 LibriVox audio sections** covering Genesis through Revelation.
- Built the Audio Bible as a fully static GitHub Pages page with **book, chapter, and verse navigation**, a complete Books panel, previous/next chapter controls, play/pause controls, playback-speed selection, automatic continuation to the next LibriVox section, and browser media-session support.
- Added approximate chapter/verse positioning within LibriVox's multi-chapter audio files using the public-domain KJV text as the navigation reference.
- Added resilient playback behavior so a missing optional text or slideshow resource does not prevent the Audio Bible player itself from initializing.
- Added persistent local playback state for selected book, chapter, verse, playback position, and playback speed where supported by the browser.
- Added `/audio-bible/slides/images.json` as the scalable visual manifest for the Audio Bible's historic Bible-art slideshow.
- Expanded the public-domain visual system around Gustave Doré, James Tissot, Julius Schnorr von Carolsfeld, historic King James Bible material, Wikimedia Commons rights metadata, and the Library of Congress _Doré Bible Gallery_.
- Configured the visual-library system for a maximum of **1,200 images**, with duplicate control, source metadata, and public-domain/CC0-oriented filtering.
- Added `/audio-bible/audio-bible.png` to the homepage hero carousel as the third slide and linked its **Listen Now** call to action to `/audio-bible/`.
- Updated the shared global header's **The Holy Bible** dropdown to add **Listen to the Bible** immediately beneath **Read the Bible Online**.
- Updated the homepage carousel from five to **six slides**.
- Updated the production XML sitemap to add `/audio-bible`, increasing the canonical sitemap from 308 to **309 URLs**.
- Preserved the plain static GitHub Pages architecture.

### Audio Bible source architecture

| Resource | Production role |
|---|---|
| `/audio-bible/index.html` | Canonical KJV Audio Bible page and player |
| `/audio-bible/slides/images.json` | Public-domain visual-library manifest and collection configuration |
| `/audio-bible/audio-bible.png` | Desktop Audio Bible promotional artwork |
| `/audio-bible/audio-bible-mobile.png` | Portrait mobile Audio Bible promotional artwork |
| LibriVox — _Bible (KJV), Complete_ | Public-domain KJV audio source, read by Michael Armenta |
| Wikimedia Commons | Public-domain / rights-cleared Bible-art collection source and rights metadata |
| Library of Congress | Institutional public-domain source for the _Doré Bible Gallery_ |

---

## What's New in v2.5.2

- Added the canonical **Print Bibles storefront** at `/estore/print-bibles/`.
- Added five curated Amazon-linked print editions: **KJV, NKJV, NIV, ESV, and NRSV Catholic Edition**.
- Added local storefront product artwork and Amazon Associates disclosure presentation.
- Added coordinated **eBibles / Print Bibles** navigation to the eStore.
- Added `/assets/homepage-hero-5.png` and a Print Bibles homepage hero.
- Updated the production XML sitemap from 307 to **308 canonical URLs**.
- Preserved the existing PayPal eBible checkout and fulfillment systems.

---

## What's New in v2.5.1

- Completed a coordinated visual/editorial enhancement pass across **15 Bible Translation History pages**.
- Added public-domain or otherwise rights-cleared historical imagery, captions, source information, and rights notes.
- Preserved long-form histories, bibliographies, canonical URLs, Bible Reader links, and translation-specific licensing.
- Preserved the static GitHub Pages architecture and all payment/backend behavior.

---

## What's New in v2.5.0

- Completed a full public-route inventory of the Living Word Bibles GitHub repository and production website.
- Rebuilt `sitemap.xml` around canonical public content instead of every reachable static route.
- Established a **307-URL canonical public sitemap baseline**.
- Confirmed all **156 `/verses/` study pages**, all **66 Books of the Bible history pages**, current Bible readers, Catholic Bible resources, Common Prayers, eStore pages, translation histories, support/legal resources, and major site hubs.
- Excluded redirect aliases, authentication/account utilities, payment-completion routes, cancellation/thank-you pages, and internal operational pages from sitemap promotion.
- Preserved `/opt-out/`, `/bibles/drb/`, and `/bibles/oeb/` as canonical public routes.
- Preserved the static GitHub Pages publishing model.

### Sitemap policy

The production XML sitemap lists **canonical public content that Living Word Bibles wants search engines to discover**. A file being publicly reachable in the repository does not by itself require inclusion in `sitemap.xml`.

Redirect aliases, duplicate-canonical pages, authentication/account utilities, payment completion pages, cancellation/thank-you flows, and internal operational pages remain outside sitemap promotion unless their purpose changes.

---

## Earlier v2.4.x highlights

- **v2.4.9:** Redesigned About Us and Social Media, preserved shared navigation anchors, added modern media/social presentation, and retained account/payment/runtime behavior.
- **v2.4.8:** Reorganized Christian Living and Bible Study media libraries and preserved all existing video resources.
- **v2.4.7:** Reorganized History of the Bible, repaired anchor navigation, added public-domain imagery, and integrated historical videos into context.
- **v2.4.6:** Repaired Bible Study filtering, added public-domain verse-card imagery, improved prayer links, and refined the EEO page.
- **v2.4.5:** Added the Equal Opportunity & Workplace Policies page and linked EEO in the shared footer.
- **v2.4.4:** Added clickable Cook Services Company, LLC attribution to legal/editorial pages.
- **v2.4.3:** Refined Ethiopian Bible product-page layout.
- **v2.4.2:** Added the mobile-specific Living Word Bibles App homepage hero.
- **v2.4.1:** Simplified homepage eBible merchandising while preserving the eStore catalog and trusted-bookseller presentation.
- **v2.4.0:** Hardened the universal header/footer shell, repaired responsive dropdown behavior, added the app hero, and added authenticated header presentation.

---

## Earlier v2.x highlights

- **v2.3.0:** Added Bible Study, expanded all 156 verse studies, embedded the legacy KJV reader, and added Common Prayers.
- **v2.2.0:** Updated History navigation, expanded Books of the Bible histories, and updated the shared shell.
- **v2.1.0:** Updated PayPal download flows, added Editorial Standards, and updated the shared shell.

---

## Architecture at a glance

```mermaid
flowchart LR
    A[Checked-in page HTML] --> B[GitHub Pages]
    A --> C[Shared header & footer]
    A --> D[Global CSS / JavaScript]
    D --> E[assets/js/config.js]
    E --> F[LWB Google Apps Script API]
    F --> G[LWB Website Google Sheet]
    F --> H[LWB Product Files / digital assets]
    A --> I[PayPal Hosted Buttons]
    I --> J[Payment verification / fulfillment flow]
    J --> F
```

The public website and the operational backend are deliberately separated:

- **GitHub Pages** serves the checked-in website files.
- **Google Apps Script** provides data/API functions and digital fulfillment support.
- **Google Sheets** stores structured operational data.
- **Google Drive and repository assets** provide digital product files as configured.
- **PayPal Hosted Buttons** remain the checkout layer for paid products and donations.

---

## Site architecture

| Path | Responsibility |
|---|---|
| `index.html` and page-level `*/index.html` files | Authoritative production content |
| `assets/includes/lwb-header.html` | Canonical global header and navigation |
| `assets/includes/lwb-footer.html` | Canonical global footer, contact, and newsletter block |
| `assets/css/site.css` | Global website styling |
| `assets/js/site.js` | Shared-shell loading, navigation, and global site behavior |
| `assets/js/config.js` | Single public runtime configuration point for backend URL and contact email |
| `assets/js/forms.js` | Public form behavior |
| `assets/js/products.js` | Product and PayPal-related front-end behavior |
| `audio-bible/index.html` | KJV Audio Bible application |
| `audio-bible/slides/images.json` | Audio Bible public-domain slideshow manifest |
| `ethiopian-bible/index.html` | Ethiopian Bible digital-edition and PayPal purchase page |
| `ethiopian-bible/about/index.html` | Long-form Ethiopian Bible history, canon guide, media, notes, and bibliography |
| `ethiopian-bible/about/ethiopian-bible-manuscript.jpg` | CC BY-SA 2.0 Ethiopian manuscript photograph used by the About page |
| `site-map/index.html` | Human-readable HTML version of the canonical public sitemap |
| `apps-script/Code.gs` | Source-controlled Google Apps Script backend |
| `scripts/validate-links.mjs` | Static route, anchor, and asset validation only |
| `.github/workflows/deploy-pages.yml` | Validation and GitHub Pages deployment |
| `PUBLIC-PAGE-REGISTRY.json` | Public route registry |
| `sitemap.xml` | Search-engine sitemap |
| `404.html` | Branded static 404 page |
| `CNAME` | Production custom-domain configuration |

Major content areas include Bible translation pages, online Bible readers, the KJV Audio Bible, Catholic Bible/deuterocanonical resources, Bible history, Holy Land maps, Bible Study and verse studies, Common Prayers, digital eBibles, the seven-edition Amazon-linked Print Bibles catalog, the Ethiopian Bible digital edition and its expanded historical guide, support/legal pages, donation/social pages, and the Living Word Bibles app. The About Us page also points visitors directly to both the Audio Bible and Print Bibles experiences.

---

## Editing production pages

Edit the relevant checked-in HTML file directly. A deployment does not rebuild page bodies, so a content edit remains exactly as committed.

Pages should use the shared shell rather than duplicating navigation or footer markup:

```html
<div data-lwb-header></div>
...
<div data-lwb-footer></div>
```

`assets/js/site.js` loads those shared fragments at runtime.

### Do not

- Do not recreate a `dist/` production tree.
- Do not reintroduce `scripts/build.mjs` as a page generator.
- Do not add an `npm run build` step that rewrites HTML.
- Do not maintain competing hard-coded copies of the universal header or footer.
- Do not hard-code the Apps Script Web App URL across individual pages.
- Do not change PayPal merchant/receiver settings as part of an unrelated website edit.
- Do not commit private PayPal credentials, download-signing secrets, or other server-side secrets.

---

## Shared header and footer

The universal site shell is maintained in:

```text
/assets/includes/lwb-header.html
/assets/includes/lwb-footer.html
```

The Holy Bible dropdown exposes both primary Scripture experiences directly: **Read the Bible Online** and **Listen to the Bible**, with the latter linking to `/audio-bible/`.

---

## Runtime configuration

`assets/js/config.js` is the single public runtime configuration file:

```js
window.LWB_SITE_CONFIG = Object.freeze({
  apiBase: "https://script.google.com/macros/s/AKfycbwHIonCe2_aijuiflRSq1jtXMpueX6DCoVIssW-YRqWT3gDisH13g1UzJrhnY1KteM1/exec",
  contactEmail: "gospellivingwordbibles@gmail.com",
  lastArchitectureUpdateUtc: "2026-08-27T14:59:40Z"
});
```

Individual pages should not contain alternate backend deployment URLs.

---

## Google Apps Script backend

The source-controlled backend lives at:

```text
/apps-script/Code.gs
```

Current backend metadata:

```text
Service: LWB Website API
Version: 3.0.0
Apps Script build stamp: 27 August 2026 at 15:20:42Z UTC
```

The backend is a **data/API service only**. It does not create, regenerate, or overwrite website HTML.

### Backend data model

- Settings
- Products
- Product Features
- Product Images
- Digital Assets
- Customers
- Orders
- Order Items
- Entitlements
- Download Log
- Newsletter Subscribers
- Audience Memberships
- Do Not Email
- Contact Messages
- Newsletter Campaigns
- Social Posts
- System Log

---

## eStore, Print Bibles, and PayPal

The core eStore presents six digital Bible editions and the Ethiopian Bible PDF through its dedicated page. Print Bibles are presented separately at:

```text
/estore/print-bibles/
```

The Print Bibles storefront currently presents seven curated Amazon-linked editions — KJV, NKJV, NIV, ESV, NRSV Catholic Edition, NET, and Ethiopian Bible. Amazon handles external pricing, availability, fulfillment, and transaction processing. Living Word Bibles PayPal eBible flows remain separate.

### Other PayPal Hosted Buttons

| Purpose | Hosted Button ID |
|---|---|
| KJV eBible | `YXUZPMWTKME24` |
| ASV eBible | `KBJTWT23LA6JN` |
| YLT eBible | `5A5Z2VDH74DFG` |
| WEB eBible | `K7C2SJYLCDKMU` |
| Ethiopian Bible | `8Z63ZMZEALLG4` |
| LWB Bible App | `4HCP6WRVGQNV2` |
| Donate | `QQDSDMS4D9FC4` |

Preserve payment configuration unless a payment change is intentional and separately verified.

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

Deployment is handled by `.github/workflows/deploy-pages.yml`.

A push to `main` validates the repository and publishes the **repository root (`.`)** directly to GitHub Pages. There is no generated production output directory.

---

## Sitemap policy

The machine-readable sitemap is:

```text
/sitemap.xml
```

The human-readable equivalent is:

```text
/site-map/
```

As of v2.5.6, `sitemap.xml` and the human-readable `/site-map/` are synchronized at **310 canonical public URLs**, including `/ethiopian-bible/about`. `PUBLIC-PAGE-REGISTRY.json` remains pending synchronization because it was not supplied in this release pass.

---

## Legal-page revision dates

Visible `Last Updated` and `Last Revised` labels are maintained only on legal or licensing pages that already display such a label.

The established visible date format is:

```text
27 August 2026
```

---

## Operational safeguards

Before merging a production change:

- Run `npm run validate`.
- Confirm universal navigation changes are made in the shared include.
- Confirm `assets/js/config.js` remains the only public backend URL configuration point.
- Confirm payment-related edits preserve the correct Hosted Button IDs.
- Confirm private Apps Script properties and PayPal credentials remain outside source control.
- Confirm free product assets resolve and paid fulfillment remains protected.
- Confirm `/audio-bible/slides/images.json` is actually deployed whenever the Audio Bible visual manifest is changed.
- Confirm `/site-map/` remains synchronized with `sitemap.xml` after canonical-route changes.
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
**Apps Script build stamp:** `27 August 2026 at 15:20:42Z UTC`  
**Backend API version:** `3.0.0`  
**README last updated:** **01 September 2026 at 18:30:30Z UTC**

---

<p align="center"><strong>© 2026 Living Word Bibles | All Rights Reserved | Developed by <a href="https://cts.cook-international.com">Cook Technology Services</a> in Chicago, Illinois | Last Updated on 01 September 2026 at 18:30:30Z UTC</strong></p>
