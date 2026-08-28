# Build and Deployment Instructions

There is **no site build step**. The checked-in page-level HTML files are the production source.

Last updated: **27 August 2026 at 14:59:40Z UTC**.

## Local validation

```bash
npm ci
npm run validate
```

Validation reads the repository root directly. It does not create `dist/`, regenerate pages, or alter page HTML. The validator may refresh its text validation reports only.

There is no `build.mjs` and no `npm run build` command.

## GitHub Pages

`.github/workflows/deploy-pages.yml` performs four actions only:

1. checks out `main`;
2. runs the static link/asset validator;
3. uploads the repository root as the GitHub Pages artifact;
4. deploys that artifact.

A push to `main` therefore publishes exactly the checked-in page files.

## LWB Backend

The website is connected through `assets/js/config.js` to:

```text
https://script.google.com/macros/s/AKfycbwHIonCe2_aijuiflRSq1jtXMpueX6DCoVIssW-YRqWT3gDisH13g1UzJrhnY1KteM1/exec
```

The backend uses the already-created `LWB Website` Google Sheet and `LWB Product Files` Drive folder. It does not generate website pages.

## Clean terminal submission as CookInternational

For a downloaded ZIP, use the safe replacement workflow documented in the final handoff or `DEPLOYMENT-CHECKLIST.md`. Do not run a site build before committing.
