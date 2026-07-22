# UX V&V Report

## Release

**Tagalog Academy v3.0.1 — Independent V&V Remediation**

## Verdict

The repository is technically ready for deployment as a public beta after the new files are committed to GitHub.

It is not yet ready for authoritative language claims because qualified Tagalog educator review remains pending.

## Scope tested

- Four-week course loading
- Week selector
- Course roadmap
- Vocabulary rendering
- Category grouping
- Adaptive review reveal and rating
- Typed-practice generation
- Quiz structure
- Speaking controls
- Dynamic builder generation
- Mission structure
- Resource rendering
- Local progress fallback
- Desktop layout
- Mobile layout
- Custom-domain preservation
- Offline precache configuration
- Private-link exclusion

## Automated results

| Test | Result |
|---|---:|
| Repository validator | PASS |
| Python content tests | 19/19 PASS |
| JavaScript syntax | PASS |
| Service-worker syntax | PASS |
| Service-worker registration behavior | PASS (Node VM: complete and loading document states) |
| Lesson JSON Schema | 4/4 PASS |
| Manifest hashes | PASS |
| Active lessons | 4 |
| Vocabulary records | 168 |
| Native quiz questions | 40 |
| Builders | 8 |
| Missions | 8 |
| Private/admin links excluded from public repo | PASS |

## Browser interaction exercise

A Chromium interaction harness successfully completed:

- Loaded eight roadmap entries
- Loaded Week 1 by default
- Switched to Week 2
- Rendered 38 Week 2 vocabulary rows
- Revealed and rated an adaptive-review item
- Produced a typed-recall prompt
- Switched to Week 4
- Generated a market-dialogue builder output
- Rendered desktop and mobile screenshots
- Confirmed mobile document width matched the 390-pixel viewport
- Produced no browser console or page errors

The UI harness used an in-memory browser fixture because this execution environment blocks browser navigation to local servers. Separately, the normal local HTTP server returned HTTP 200 with correct content types for the application shell, course data, Week 4 data, manifest, service worker, and Week 1 PDF. Service-worker registration behavior was executed in a Node VM for both already-loaded and still-loading document states. Full offline reload remains a live-domain gate.

## Accessibility checks

- Skip link included
- Semantic headings used
- Tablist roles and keyboard behavior implemented
- Visible focus treatment included
- Buttons meet minimum target height
- Form labels associated with controls
- Live feedback regions included
- Responsive layout avoids horizontal mobile overflow
- Dark mode supported
- Print mode supported

## Remaining real-world gates

- Test microphone permission and playback on iOS Safari, Android Chrome, and desktop Chrome
- Test PWA installation from the live HTTPS domain
- Test full offline reload after first visit
- Test external media links from the live domain
- Complete qualified Tagalog educator review
- Complete a five-learner adult beta
- Verify one-day and seven-day recall

## Product judgment

The course now functions as a reusable learning system rather than a Week 1 worksheet site.

The next highest-value work is not adding cosmetic features. It is:

1. Educator review
2. Learner beta
3. Correction capture
4. Delayed-recall proof
5. Weeks 5–8 source acquisition

## Independent-review remediation

The v3.0.1 patch closes the two beta-blocking findings from the independent review:

- Service-worker registration now handles pages whose `load` event has already fired.
- Speech synthesis caches asynchronously loaded voices and visibly warns when no Filipino voice is installed.

It also adds cache-version release gating, CI-enforced JSON Schema validation, current license branding, standard assimilated number spellings, a dynamic sticky-header scroll offset, and documented spelling conventions.

Remaining human gates: qualified educator review, source-rights confirmation, live-device PWA/microphone/offline testing, and learner beta evidence.
