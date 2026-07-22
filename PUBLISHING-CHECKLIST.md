# Publishing Checklist

## Content

- [ ] Qualified Tagalog educator reviewed all active weeks
- [ ] Accepted variants are documented
- [ ] English glosses are accurate
- [ ] Adult relevance confirmed
- [ ] No source-only branding remains
- [ ] No private class link is present
- [ ] External media rights and availability checked
- [ ] Source-curriculum ownership and transformation rights confirmed

## Technical

- [ ] `CACHE` in `service-worker.js` matches the release version.
- [ ] Lesson JSON passes `python scripts/validate_schema.py` after installing `requirements-dev.txt`.
- [ ] `node tests/test_app_logic.mjs` passes.
- [ ] `python tagalog.py validate` passes
- [ ] GitHub Actions passes
- [ ] `index.html` is at repository root
- [ ] `CNAME` contains `tagalog.academy`
- [ ] `.nojekyll` exists
- [ ] GitHub Pages publishes from `main` and `/ (root)`
- [ ] HTTPS is enforced
- [ ] PWA installs on a real device
- [ ] Offline reload succeeds after first visit

## UX

- [ ] Week switching works
- [ ] Search and category filter work
- [ ] Review ratings persist
- [ ] Typing accepts intended variants
- [ ] Quiz score persists
- [ ] Microphone permission is understandable
- [ ] Builders produce useful sentences
- [ ] Mission completion persists
- [ ] Export and import work
- [ ] Mobile tap targets are usable

## Launch proof

- [ ] Five adult learners complete one week
- [ ] Baseline and final quiz scores captured
- [ ] One-day delayed recall tested
- [ ] Seven-day return behavior observed
- [ ] Confusing steps documented
- [ ] Educator corrections recorded
