# Bible Reader Diagnostic Report

Date: 5 June 2026

## Static integration result

All fifteen expected reader routes were generated and passed the route, asset, and anchor audit:

- KJV, NKJV, NIV, ESV, NET, LEB, ASV, YLT, WEB, OEB, DBY, GNV, BSB, BBE, and DRB.
- Every reader page references the local `/assets/LivingWordBibles01.png` logo.
- Every reader route has a translation selector, canonical history-page link, responsive shell, and local fallback mark.
- Legacy hash forms such as `#net=`, `#gnv=`, `#bsb=`, `#oeb=`, `#dby=`, and `#drb=` are normalized by the shared reader.
- The shared reader no longer creates a fake 150-chapter list. It uses source metadata first and canonical chapter counts as a safe fallback.

## Reader sources

| Reader | Integration | Status / diagnostic |
|---|---|---|
| KJV | Preserved supplied legacy reader | Generated and locally branded. |
| NKJV | Preserved supplied legacy reader | Generated and locally branded. Publisher/source access still requires live-browser verification. |
| NIV | Preserved supplied legacy reader | Generated and locally branded. Publisher/source access still requires live-browser verification. |
| ESV | Preserved supplied legacy reader | Generated and locally branded. Publisher/source access still requires live-browser verification. |
| NET | NET Bible JSONP endpoint | Shared controls and reference normalization integrated. |
| LEB | Logos/Biblia embedded reader | Local LWB shell and attribution retained. |
| ASV | Preserved supplied legacy reader | Generated and locally branded. |
| YLT | Preserved supplied legacy reader | Generated and locally branded. |
| WEB | Preserved supplied legacy reader | Generated and locally branded. |
| OEB | Bible API `oeb-us`, with `oeb-cw` fallback | Starts at Ruth 1:1. Only books returned by the source are shown. No fabricated chapters. |
| DBY | Bible API `darby` | Canonical chapter-count fallback and numbered-book normalization added. |
| GNV | Bible SuperSearch `geneva` | Canonical chapter counts added; legacy hashes normalized; unavailable API responses fail gracefully. |
| BSB | Free Use Bible API / HelloAO `BSB` | Chapter content is flattened without exposing notes as verse text; selected-verse sharing uses current state. |
| BBE | Preserved supplied legacy reader | Generated and locally branded. |
| DRB | Bible API `dra` | Catholic aliases are normalized; canonical counts include Tobit, Judith, Wisdom, Sirach, Baruch, and 1–2 Maccabees. |

## Known live-service dependencies

The build environment validated local HTML, JavaScript syntax, routes, anchors, and assets. It could not fully execute third-party Bible endpoints inside a deployed browser. Post-deployment testing is still required for NET, LEB, OEB, DBY, GNV, BSB, DRB, and proprietary-source legacy readers.

The Geneva implementation depends on a third-party public API and should be reviewed for production traffic, terms, and capacity. A self-hosted/local Geneva dataset remains the strongest long-term option.
