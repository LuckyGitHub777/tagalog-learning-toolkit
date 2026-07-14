# UX V&V Report

## Executive Verdict

**Publication-ready as a neutral GitHub learning product after final human language review.**

The primary delivery should be the progressive web app. The Python CLI adds repository value but should not replace the browser experience.

## Major Corrective Actions Completed

- Removed legacy school branding and logo dependencies.
- Removed personal places, institutions, occupations, and identity-linked examples.
- Removed branded original documents from the public package.
- Repositioned the website from a single worksheet wrapper to a reusable learning product.
- Added offline installation support through a web app manifest and service worker.
- Added adaptive daily review with transparent mastery records.
- Added local-only speaking playback and self-recording.
- Added progress export and import.
- Added searchable and filterable lesson content.
- Added editable sentence-builder outputs and copy controls.
- Added keyboard-operable tabs with correct ARIA relationships.
- Added light and dark appearance modes.
- Added neutral print materials.
- Added a Python companion for validation, serving, and terminal recall.
- Added continuous-integration validation for GitHub.
- Added lesson schema, expanded tests, and file hashes.

## V&V Dimensions

| Dimension | Result | Notes |
|---|---:|---|
| Brand neutrality | Pass | No legacy organization or personal references in public text assets |
| Learner path clarity | Pass | Understand, retrieve, speak, create, and apply stages are visible |
| Mobile responsiveness | Pass | Exercised in headless Chromium at a phone viewport |
| Desktop responsiveness | Pass | Exercised in headless Chromium at a wide viewport |
| Keyboard navigation | Pass | Tabs support arrows, Home, End, and focus states |
| Local privacy | Pass | Progress remains local; audio is not uploaded |
| Offline readiness | Structural pass | Manifest, cache list, and local references validate; deployed service-worker smoke test remains |
| Content-data separation | Pass | Lesson content is maintained in versioned JSON |
| CLI correctness | Pass | Validate and study-preview commands tested |
| Automated tests | Pass | Repository, content, links, and CLI checks pass |
| PDF rendering | Pass | All final PDF pages rendered and visually inspected |
| Microphone workflow | Code-reviewed | Live microphone permission and recording need a real-device smoke test |
| Formal language certification | Pending | Requires qualified human review |
| Real learner validation | Pending | Requires observed use, completion, and feedback |

## UX Risks That Remain

1. Browser speech voices differ in accent and quality.
2. Microphone support and permission behavior vary across browsers.
3. Local storage can be cleared by the learner; export is therefore important.
4. The review scheduler is intentionally simple and requires learner testing.
5. Week 1 alone cannot prove long-term course retention or engagement.
6. The current V&V environment blocked direct local-site navigation, so interactive browser tests used an in-memory Chromium harness with the production HTML, CSS, JavaScript, and lesson data. A deployed GitHub Pages smoke test remains required.

## Validation Plan

Run a small pilot with at least five new learners:

1. Ask each learner to complete the first session without coaching.
2. Record time to first successful spoken introduction.
3. Capture where they hesitate or abandon the flow.
4. Retest recall after one day and seven days.
5. Ask whether they would return, recommend it, or use a second lesson.
6. Collect fluent-speaker review of accepted answers and audio examples.

## Proof to Capture

- Session completion rate
- Quiz improvement between first and second attempt
- Number of phrases reaching mastery level 2 or higher
- One-day and seven-day recall
- Successful introduction created and spoken
- Learner quotations about clarity and confidence
- Pull requests or issue reports from contributors

## Release Decision

Publish as an open Week 1 beta, not as the world’s best or a complete certified course. Earn stronger claims through learner retention, instructor review, expanding lesson coverage, and repeatable proof.
