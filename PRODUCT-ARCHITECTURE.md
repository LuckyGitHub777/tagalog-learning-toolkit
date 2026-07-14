# Product Architecture

## Delivery Decision

**Use the progressive web app as the learner-facing product. Use Python as a companion tool, not the primary interface.**

| Surface | Primary user | Best use | Decision |
|---|---|---|---|
| Progressive web app | General learners | Learning, practice, speaking, builders, application work | Primary |
| Python CLI | Maintainers and terminal users | Validation, local serving, lightweight recall | Companion |
| Printable PDFs | Learners and teachers | Offline worksheets, classroom handouts, review | Supporting |
| Structured JSON | Contributors and future tooling | Reusable lesson content | Core data layer |

## Experience Loop

```text
Understand -> Retrieve -> Speak -> Create -> Apply -> Review again
```

## Technical Layers

1. **Content layer** - versioned lesson JSON and schema.
2. **Learning layer** - search, adaptive review, typing, quiz, speaking, builders, application work.
3. **Persistence layer** - local browser storage with export and import.
4. **Offline layer** - service worker and app manifest.
5. **Quality layer** - Python validation, unit tests, manifest hashes, browser V&V.
6. **Distribution layer** - GitHub repository, GitHub Pages, downloadable PDFs.

## Adaptive Review Model

Each practice phrase stores:

- Mastery level from 0 to 5
- Number of reviews
- Last review time
- Next review time

Ratings update the review interval:

- **Again** - lower mastery and return soon
- **Hard** - preserve low mastery and return tomorrow
- **Good** - increase mastery and lengthen the interval

This is a transparent, lightweight scheduling model. It is not presented as a scientifically optimized memory algorithm.

## Privacy Boundary

The application intentionally avoids:

- User accounts
- Remote databases
- Advertising
- Tracking scripts
- Cloud audio upload
- Automated pronunciation grading claims

Microphone recordings exist only in the active browser session.

## Scaling Rule

Add future lessons by creating new JSON lesson files that conform to `data/lesson.schema.json`. Do not duplicate the whole website for every week.
