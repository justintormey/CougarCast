# Skeptic Review — Issue #18: Complete escHtml() migration to utils.js

**Date:** 2026-04-18  
**Engineering commit:** afa5974 (`feat: complete escHtml() migration — import from utils.js across all modules`)  
**QA commit:** 72936b7 (`qa(#18): pass — escHtml() migration to utils.js verified complete`)  
**Reviewer:** Skeptic  

---

## Verification

### Git diff audit

Commit `afa5974` changed 5 files, 31 insertions, 19 deletions:
- `history.md` — updated Unfinished Work, added session log ✓
- `js/app.js` — removed local `escHtml()` function; added `import { escHtml } from './utils.js'` ✓
- `js/roster.js` — added import; wrapped player name and year in `escHtml()` ✓
- `js/sequence-builder.js` — added import; wrapped `chip.label` in `escHtml()` ✓
- `js/announcements.js` — added import; wrapped `item.title` in `escHtml()` ✓

### Single canonical source — VERIFIED

`grep -rn "function escHtml" js/` → **one hit: `js/utils.js:11`**. No module defines it locally.

### All 4 issue requirements met — VERIFIED

| Requirement | Status |
|-------------|--------|
| Remove local `escHtml` from `app.js`; replace with import | ✓ Done — line 12 |
| `roster.js`: escape player name/year in `renderRoster()` | ✓ Done — lines 24, 27 |
| `sequence-builder.js`: escape `chip.label` in `renderChips()` | ✓ Done — line 154 |
| `announcements.js`: escape `item.title` in `render()` | ✓ Done — line 83 |

### Remaining innerHTML blocks — VERIFIED SAFE

All other `innerHTML` assignments independently audited:
- Static HTML strings (no user data) — safe ✓
- Empty-row templates (new row creation) — no user data interpolated ✓
- `app.js` sites (`seg`, `a.label`, `a.id`, player fields, voice names) — all wrapped in `escHtml()` ✓
- `music-manager.js` walkup sites — covered in issue #17, all use `escHtml()` ✓

### Test suite — VERIFIED

```
Tests  59 passed (59)
Files  3 passed (3)
```

Ran independently: confirmed 59/59 pass.

---

## Findings

None beyond what QA flagged: `chip.color`/`a.color` in `style` attributes is a self-XSS-only risk from localStorage, consistent with established project threat model. Not blocking.

---

## Decision

Engineering work is complete and correct. QA verified. Independent skeptic re-verification confirms all claims. Ship it.

##VERDICT##
DECISION: APPROVE
ROUTE: Done
REASON: All 4 issue requirements implemented and independently verified — single canonical escHtml in utils.js, all targeted modules migrated, no local definitions remaining, 59/59 tests pass.
ISSUES_CREATED: none
##END##
