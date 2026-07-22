# Product Architecture

## Product decision

The learner-facing product is a Progressive Web App.

Python is a companion layer for local serving, validation, tests, and optional terminal review. It is not the primary interface.

## Learning engine

Each week uses the same outcome sequence:

```text
Understand
→ Retrieve
→ Speak
→ Build
→ Complete a mission
→ Review after a delay
```

## Data model

`data/course.json` defines the roadmap.

Each `data/lessons/weekN.json` file defines:

- Objectives
- Vocabulary
- Grammar notes
- Sentence patterns
- Builders
- Quiz
- Missions
- External resources
- Content status

This makes lesson expansion a content operation rather than a new website build.

## Progress model

Progress is stored by week under localStorage keys beginning with:

```text
tagalog-academy.progress.
```

The week score combines:

- Familiar vocabulary
- Typed recall
- Review mastery
- Quiz score
- Lesson completion
- Mission completion

## Public/private boundary

Public repository:

- Neutral transformed lessons
- Native quizzes
- Native builders
- Optional public song links
- Printable neutral Week 1 resources

Excluded:

- Zoom links
- Homework upload forms
- Student information
- Branded source files
- Unreviewed administrative material

## Deployment

GitHub Pages serves the root of `main`.

The root `CNAME` preserves:

```text
tagalog.academy
```

The service worker precaches the four active weeks and core application assets.
