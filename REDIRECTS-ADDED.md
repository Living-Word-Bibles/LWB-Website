# Redirects and Legacy Aliases

The build creates direct, single-hop redirects for the following known legacy routes:

| Legacy route | Canonical destination |
|---|---|
| `/home/` | `/` |
| `/the-holy-bible/` | `/bibles/` |
| `/bibles-1/` | `/bibles/` |
| `/churches/` | `/for-churches/` |
| `/copyright-notice/` | `/copyright/` |
| `/instagram/` | `/social-media/` |
| `/twitter/` | `/social-media/` |
| `/youtube/` | `/social-media/` |
| `/order/success/` | `/payment-complete/` |

Canonical URLs are emitted with trailing-slash directory routes. The internal-link validator accepts only routes whose generated `index.html` exists or whose explicit redirect stub exists.
