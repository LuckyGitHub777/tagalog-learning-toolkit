# Changelog

## 3.0.1 — V&V Remediation

### Fixed

- Closed the service-worker registration race on repeat visits.
- Added asynchronous Filipino voice detection and a visible fallback warning.
- Updated Week 4 number orthography for typed recall.
- Changed the primary stress phrase to `Na-stress ako.` while documenting accepted variants.
- Added `kuwarto` as an accepted spelling while retaining `kwarto` as the display convention.
- Replaced the hardcoded panel scroll offset with a measured header offset.
- Removed dead roadmap progress computation.
- Updated the license and PDF generator to current Tagalog Academy branding.

### Quality gates

- Added CI-enforced lesson JSON Schema validation.
- Added executable JavaScript behavior tests for the service-worker registration race.
- Added cache-version checks and publishing checklist requirements.
- Qualified the private curriculum-source inventory instead of presenting it as repository-verifiable evidence.

## 3.0.0 — Curriculum Transformation

### Added

- Rebranded the public product as Tagalog Academy.
- Added a four-week course roadmap.
- Added Week 2: Colors and Food.
- Added Week 3: Objects and Places at Home.
- Added Week 4: Numbers, Relationships, Fruit, and Market Language.
- Added dynamic week selection.
- Added weekly learning objectives, grammar notes, sentence patterns, builders, missions, quizzes, and resources.
- Added progress tracking by week.
- Added `CNAME` for `tagalog.academy`.
- Added public/private curriculum separation.
- Added validation for private forms, Zoom links, and legacy branding.
- Added curriculum transformation documentation.

### Changed

- Generalized the Week 1 engine into a reusable multi-week course platform.
- Updated the PWA manifest and offline cache.
- Updated local CLI commands and tests.
- Expanded the learning model from worksheet completion to recognition, recall, speaking, application, and delayed review.

### Known gates

- Final Tagalog educator review remains required.
- Weeks 5–8 require source curriculum.
- External media links require periodic availability and rights checks.
