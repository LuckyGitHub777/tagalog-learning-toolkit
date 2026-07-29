# Product Architecture

## Product model

Tagalog Academy is one continuous path of short lessons. The learner sees a current lesson, visible progress, and one clear next action.

## Learning loop

1. **Learn** - understand the form and meaning.
2. **Recall** - produce the answer without looking.
3. **Speak** - listen, repeat, record, and compare.
4. **Use** - build original language and complete a practical activity.

## Exercise invariant

Every practice prompt identifies exactly one correct teaching record. When forms share an English meaning, `exercise_english` distinguishes usage or register. Generated quizzes use the same deterministic labels and exclude ambiguous sibling records from distractors.

## Two-layer design

### Human layer

A clear, responsive website with minimal controls and plain language.

### Machine-readable layer

Stable JSON records containing:

- canonical form;
- English meaning;
- deterministic exercise prompt when needed;
- accepted recall forms;
- category and usage type;
- register;
- note and explanation;
- lesson order, objectives, patterns, builders, and activities.

## Boundaries

- No account system
- No learner-data server
- No analytics dependency
- No external runtime libraries
- No live-class administration links
- No copied recordings or branded source documents

## Progress model

Every lesson uses one progress formula across the dashboard and lesson cards. Imported progress is validated before browser storage changes. Legacy progress migrates item-level evidence only and never fabricates completion or quiz scores.

## Offline and update model

The application shell is cached for resilience. Lesson data uses stale-while-revalidate and always resolves to an HTTP response, even when both cache and network are unavailable.

Lesson JSON updates normally appear promptly. HTML, CSS, JavaScript, icons, and other shell updates follow the safer service-worker lifecycle: a new worker does not replace files during an active session. Shell updates may become active only after all open Tagalog Academy tabs are closed and the site is opened again.

## Publishing model

Pull requests run the complete validation suite. The Pages workflow runs the same gates on `main`, builds a public-only `_site` directory, uploads that artifact, and deploys only after validation succeeds.
