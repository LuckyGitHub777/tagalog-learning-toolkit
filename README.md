# Tagalog Learning Toolkit

A privacy-first, offline-ready Tagalog learning experience designed for GitHub Pages.

The website is the primary learner product. A small Python companion supports local serving, validation, and optional terminal practice.

![Desktop preview](docs/images/desktop-preview.png)

## Why This Delivery Model

### Primary: Progressive Web App

The browser is the best front door because learners can begin immediately on a phone, tablet, or computer without installing Python. The site supports:

- Structured lessons and searchable phrases
- Adaptive review based on local mastery records
- Typed retrieval practice and randomized quiz order
- Browser speech playback
- Private, session-only voice recording for self-comparison
- Sentence builders and autosaved application work
- Progress export and import
- Offline use after the first successful visit
- Installation as an app where the browser supports it

### Companion: Python CLI

The CLI is useful for repository maintainers, teachers, developers, and terminal-focused learners. It is intentionally secondary.

```bash
python tagalog.py validate
python tagalog.py serve --port 8000
python tagalog.py study --count 10
```

## Start Locally

```bash
python tagalog.py serve
```

Open `http://127.0.0.1:8000`.

## Validate

```bash
python scripts/validate_repo.py
python -m unittest discover -s tests -v
```

## Publish With GitHub Pages

1. Create a repository.
2. Upload the contents of this folder to the repository root.
3. Open **Settings > Pages**.
4. Select **Deploy from a branch**.
5. Select the `main` branch and `/ (root)` folder.
6. Save and wait for the public URL.

The `.nojekyll` file prevents unnecessary Jekyll processing.

## Repository Structure

```text
.
├── index.html                     # Learner-facing progressive web app
├── manifest.webmanifest           # Installable app metadata
├── service-worker.js              # Offline cache
├── tagalog.py                     # Optional Python companion
├── assets/
│   ├── css/styles.css
│   ├── js/app.js
│   └── icons/
├── data/
│   ├── lesson.schema.json
│   └── lessons/week1.json
├── downloads/                     # Neutral print-ready PDFs
├── scripts/validate_repo.py
├── tests/test_content.py
├── PRODUCT-ARCHITECTURE.md
├── CONTENT-NOTES.md
├── PRIVACY.md
├── PUBLISHING-CHECKLIST.md
├── UX-VV-REPORT.md
└── ROADMAP.md
```

## Product Principles

1. **Useful language first.** Every feature should help learners understand, retrieve, speak, create, or apply language.
2. **Human judgment stays visible.** Speech playback and recording support practice; they do not pretend to certify pronunciation.
3. **Private by default.** No account, analytics, advertising, or cloud storage is required.
4. **Website first.** The web experience serves everyone; Python supports maintainers and optional terminal learning.
5. **Content is data.** New lessons should be added through the lesson schema rather than copied into application code.
6. **Proof before scale.** Expand only after observing learner completion, repeat use, and content-review quality.

## Licensing

- Source code: MIT License (`LICENSE`)
- Original educational content in this repository: Creative Commons Attribution 4.0 (`CONTENT-LICENSE.md`)

Review the licenses before publishing under an organization or incorporating outside materials.

## Important Language Note

This package has undergone structural and technical review. A qualified Tagalog educator or fluent reviewer should still approve expanded curriculum, accepted-answer rules, register choices, and regional usage before formal classroom certification.
