# Contributing

## Before changing language content

1. Identify the learner problem and learning objective.
2. Use one canonical Tagalog form per record.
3. Add alternatives only when register or usage justifies them.
4. Give records with similar meanings unique `exercise_english` prompts.
5. Explain register, aspect, regional context, or usage where learners could be misled.
6. Cite reviewable evidence for language changes.
7. Confirm that any outside material may be published.

See `LANGUAGE-GUIDE.md` for the Academy's editorial standard.

## Required validation

```bash
python -m pip install -r requirements-dev.txt
python tagalog.py validate
node --check assets/js/theme.js
node --check assets/js/core.js
node --check assets/js/app.js
node --check service-worker.js
node tests/test_core.mjs
node tests/test_service_worker.mjs
```

`python tagalog.py validate` runs repository validation, JSON Schema validation, GitHub-template validation, Python tests, and manifest verification.

Update `MANIFEST.sha256` after every release-tree change. When public shell files change, update the service-worker cache name together with the release version.

## Pull requests

Use a feature branch and a pull request. Do not push unreviewed changes directly to `main`.

Include:

- the learner or maintenance problem;
- the smallest useful change;
- evidence supporting language changes;
- validation results;
- screenshots for visible changes;
- the effect on offline caching and printable materials.

## Boundaries

Never commit credentials, private learner data, live meeting details, submission forms, confidential documents, or third-party material that cannot be published.

Report exploitable security vulnerabilities privately under `SECURITY.md`.
