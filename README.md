# Tagalog Academy

**Tagalog Academy** is a privacy-first, mastery-oriented Tagalog course published at **https://tagalog.academy**.

The application transforms a multi-week adult-learning curriculum into a reusable learning system:

**Learn → Retrieve → Speak → Build → Apply → Review**

## Current release

Version **3.0.1** includes four active weeks:

1. Introductions and family
2. Colors and food
3. Objects and places at home
4. Numbers, relationships, fruit, and market language

Weeks 5–8 remain visibly planned until their source curriculum is available.

## Learner experience

- Searchable vocabulary grouped by topic
- Device-generated speech playback with a visible warning when no Filipino voice is installed
- Adaptive review with Again, Hard, and Good ratings
- Typed English-to-Tagalog recall
- Ten-question quiz for each week
- Private microphone recording for self-comparison
- Dynamic sentence and dialogue builders
- Weekly real-life missions
- Local progress storage with export and import
- Installable, offline-ready Progressive Web App
- No account, analytics, advertising, or cloud audio upload

## Run locally

Do not double-click `index.html`. The app loads JSON lesson files and must be served over HTTP.

```bash
python tagalog.py serve
```

Then open:

```text
http://127.0.0.1:8000
```

Validate the package:

```bash
python tagalog.py validate
```

Run a terminal recall session:

```bash
python tagalog.py study --week 2 --count 10
```

## Repository architecture

```text
index.html                 Application structure
assets/css/styles.css      Responsive visual system
assets/js/app.js           Course, practice, progress, and PWA behavior
data/course.json           Course roadmap
data/lessons/week1.json    Week 1 lesson data
data/lessons/week2.json    Week 2 lesson data
data/lessons/week3.json    Week 3 lesson data
data/lessons/week4.json    Week 4 lesson data
service-worker.js          Offline caching
manifest.webmanifest       Installable-app metadata
scripts/validate_repo.py   Repository quality gate
scripts/validate_schema.py Lesson-schema quality gate
requirements-dev.txt       CI and contributor validation dependency
tests/                     Automated content and application-logic tests
```

## Updating the live site

The `main` branch is the approved public version. GitHub Pages serves that branch at `tagalog.academy`.

Recommended workflow:

1. Create a feature branch.
2. Change the lesson data or application files.
3. Run `python tagalog.py validate`.
4. Preview locally.
5. Open a pull request.
6. Merge into `main`.
7. Verify the GitHub Pages deployment and live domain.

## Content governance

The public lesson wording is neutral and does not include live-class administration links, student-submission forms, or school branding.

The curriculum should receive final review from a qualified Tagalog educator before it is described as authoritative. See:

- `CONTENT-NOTES.md`
- `CURRICULUM-TRANSFORMATION.md`
- `PUBLISHING-CHECKLIST.md`

## Privacy

Progress is stored in the learner's browser. Voice recordings stay in the active browser session and are not uploaded by this application. See `PRIVACY.md`.

## License

The software is licensed under the MIT License. Educational content is governed separately in `CONTENT-LICENSE.md`.
