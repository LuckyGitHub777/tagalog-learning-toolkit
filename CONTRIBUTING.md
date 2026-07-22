# Contributing

## Contribution priorities

1. Correct language
2. Clear learner outcome
3. Privacy
4. Accessibility
5. Repeatability
6. Technical simplicity

## Lesson changes

Edit the appropriate JSON file in `data/lessons/`.

Every lesson should include:

- At least four objectives
- Substantial vocabulary grouped by category
- At least two grammar notes
- At least two builders
- Exactly ten quiz questions
- At least two missions
- Source and review status

## Before opening a pull request

```bash
python -m pip install -r requirements-dev.txt
python tagalog.py validate
python scripts/validate_schema.py
python tagalog.py serve
```

Test:

- Desktop and mobile
- Keyboard navigation
- Week switching
- Vocabulary search
- Review
- Typing
- Quiz
- Speaking playback
- Builders
- Mission completion
- Progress export/import
- Offline reload

## Language corrections

A correction should explain:

- Existing wording
- Proposed wording
- Why it is more accurate or natural
- Register or regional considerations
- Source or reviewer

Do not replace one valid variant with another merely because it is personally preferred.

## Schema enforcement

`data/lesson.schema.json` is enforced in continuous integration through `scripts/validate_schema.py`. Update the schema and lesson files together when the content contract changes.
