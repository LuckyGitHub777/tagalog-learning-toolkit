# Independent V&V Remediation - Tagalog Academy v3.0.1

## Verdict

All beta-blocking technical findings in the supplied independent v3.0.0 review are closed in this patch. The repository is technically ready for a controlled public beta after deployment checks pass. It must not be described as linguistically authoritative until qualified Tagalog educator review is complete.

## Finding disposition

| Finding | Status | Corrective action |
|---|---|---|
| P1-1 service-worker registration race | Closed | Register immediately when `document.readyState` is `complete`; otherwise attach a one-shot `load` handler. Executable Node VM test covers both states. |
| P1-2 silent non-Filipino TTS fallback | Closed | Cache voices, refresh on `voiceschanged`, prefer `fil`/`tl` voices, and display a global warning plus Speak-panel disclosure when no Filipino voice exists. |
| P2-1 missing cache-bust gate | Closed | Cache key bumped to `tagalog-academy-v3.0.1`; validator and publishing checklist require cache/version alignment. |
| P2-2 decorative lesson schema | Closed | Added `jsonschema` dev requirement, schema validator, CI installation, and CI execution. |
| P2-3 legacy license branding | Closed | Updated MIT copyright holder to Tagalog Academy contributors. |
| P3-1 unsupported workbook-link count | Closed | Removed the numeric claim from the public UX report and qualified the private source inventory. |
| P3-2 Weeks 2-4 printable parity | Deferred | Non-blocking content deliverable placed in the 3.1 roadmap; no broken links exist. |
| P3-3 dead roadmap computation | Closed | Removed redundant progress computation. |
| P3-4 hardcoded scroll offset | Closed | Header height is measured at runtime. |
| P3-5 Week 1 `Nasaan` song sequencing | Closed | Resource is explicitly labeled as a preview of the Week 3 pattern. |

## Language disposition

| Item | Status | Decision |
|---|---|---|
| Numbers 11-19 | Corrected | Display and typed recall now use assimilated forms: `labindalawa`, `labintatlo`, `labinlima`, `labimpito`, `labingwalo`, and `labinsiyam`, while retaining `labing-isa`, `labing-apat`, and `labing-anim`. |
| Stress expression | Improved; educator gate open | Primary display is `Na-stress ako.`; documented accepted variants include `nai-stress ako` and `stressed ako`. |
| `kwarto` / `kuwarto` | Convention documented | Display uses `kwarto`; typed recall accepts `kuwarto`. |
| `dalandan` / `kahel` | Clarified | `Dalandan` is identified as the citrus fruit; `kahel` remains the color term. |

## Reproduced evidence

```bash
python scripts/validate_repo.py
python scripts/validate_schema.py
python -m unittest discover -s tests -v
node --check assets/js/app.js
node --check service-worker.js
node tests/test_app_logic.mjs
python tagalog.py validate
```

Additional verification completed:

- 4 active weeks
- 168 vocabulary records
- 40 quiz questions
- 8 builders
- 8 missions
- Correct HTTP 200 responses and content types on representative local routes
- Desktop and 390-pixel mobile UI interaction exercise with no console or page errors
- No mobile horizontal overflow
- All three regenerated Week 1 PDFs rendered and visually inspected
- Private Zoom and submission-form links absent from public files
- Custom domain remains `tagalog.academy`

## Remaining gates

- Qualified Tagalog educator ruling and correction log
- Source-curriculum rights confirmation
- Live-domain HTTPS, install, offline-reload, and microphone tests on real devices
- External media availability and rights check
- Five-adult learner beta with one-day and seven-day delayed recall
- Printable resource parity for Weeks 2-4
