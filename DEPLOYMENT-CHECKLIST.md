# Deployment Checklist

Updated **27 August 2026 at 14:59:40Z UTC**.

- [ ] Confirm `assets/js/config.js` contains the deployed `LWB Backend` `/exec` URL.
- [ ] Confirm public contact email is `gospellivingwordbibles@gmail.com`.
- [ ] Confirm no legacy public-contact address references remain.
- [ ] Confirm PayPal Hosted Button IDs/client configuration remain unchanged.
- [ ] Confirm visible legal/licensing revision labels use `27 August 2026`.
- [ ] Confirm there is no `dist/` directory and no `build.mjs`.
- [ ] Run `npm ci` and `npm run validate`.
- [ ] Review `git diff` before committing.
- [ ] Commit and push `main` as `CookInternational`.

The deployment publishes checked-in static pages directly; no page generator is run.
