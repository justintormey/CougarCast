# QA Report — Issue #11: Add escHtml() utility
**Date:** 2026-04-17  
**Commit reviewed:** 58e551a  
**Reviewer:** QA Agent  
**Verdict:** PASS (with low-severity follow-up items)

---

## Scope

Issue #11 required:
1. Add `escHtml()` utility function to `app.js`
2. Apply to all user-supplied strings in innerHTML templates, specifically:
   - `renderPeriodStrip()` — `seg` in period chip innerHTML
   - `updateActionButtons()` — `a.label` in action button innerHTML
   - `renderRosterEdit()` — player name/number fields in `value=` attributes

---

## Implementation Review

### escHtml() function — CORRECT

```js
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

- `&` replaced first: prevents double-encoding (e.g., `&lt;` → `&amp;lt;`)
- All five required characters covered: `& < > " '`
- `String(s)` coercion handles null/undefined safely
- Placement: immediately after imports, before any use — correct

### Call sites verified

| Site | File | Line | Applied? |
|------|------|------|----------|
| `renderPeriodStrip` — chip button innerHTML | app.js | ~299 | ✅ `escHtml(seg)` |
| `updateActionButtons` — action button innerHTML | app.js | ~740 | ✅ `escHtml(a.label)` |
| `renderRosterEdit` — `number` value attr | app.js | ~615 | ✅ `escHtml(p.number)` |
| `renderRosterEdit` — `firstName` value attr | app.js | ~616 | ✅ `escHtml(p.firstName)` |
| `renderRosterEdit` — `lastName` value attr | app.js | ~617 | ✅ `escHtml(p.lastName)` |
| `renderRosterEdit` — `pronounce` value attr | app.js | ~619 | ✅ `escHtml(p.pronounce \|\| '')` |
| `_renderSegmentEditor` — seg `value=` attr | app.js | ~410 | ✅ upgraded from `.replace(/"/g,'&quot;')` |
| `_buildActionEditorHtml` — label `value=` attr | app.js | ~436 | ✅ upgraded from `.replace(/"/g,'&quot;')` |
| `_buildActionEditorHtml` — id `value=` attr | app.js | ~437 | ✅ upgraded from `.replace(/"/g,'&quot;')` |

All issue-specified sites are covered. Old ad-hoc `.replace(/"/g, '&quot;')` calls properly consolidated.

### Test suite

**59/59 tests pass.** No regressions.

---

## Findings

### LOW-1: `roster.js` renderRoster() — player names unescaped in innerHTML

**File:** `js/roster.js` L22–24
**Code:**
```js
const name = `#${p.number} ${p.firstName} ${p.lastName}`;
return `<div class="player-row" ...>
  <span class="player-name">${name}</span>
  <span class="player-pos">${p.year || ''}</span>
</div>`;
```
**Finding:** Player number, first name, last name, and year are injected into innerHTML without escaping. These are user-supplied via the roster editor (which now correctly escapes `value=` attributes, but this display path in `roster.js` is a separate code path). `escHtml()` is not accessible here — it is defined but not exported from `app.js`.
**Severity:** Low (self-XSS only, single-user static app)
**Blocks ship:** No

---

### LOW-2: `sequence-builder.js` renderChips() — chip labels unescaped in innerHTML

**File:** `js/sequence-builder.js` L152
**Code:**
```js
return `<span class="chip ${chip.cssClass}" data-index="${i}" ${style}>${chip.label}</span>`;
```
**Finding:** `chip.label` contains player names (from `addPlayerChip`), team names (from `addTeamChip`), and custom action labels (from `addActionChip`) — all user-supplied. No escaping applied.
**Severity:** Low
**Blocks ship:** No

---

### LOW-3: `announcements.js` renderAnnouncements() — item title unescaped in innerHTML

**File:** `js/announcements.js` L81
**Code:**
```js
<span class="announcement-title">${item.title}</span>
```
**Finding:** `item.title` is typed by the operator in the Announcements modal UI and stored in `gameState.announcements[]`. Rendered without escaping.
**Severity:** Low
**Blocks ship:** No

---

### LOW-4: CHANGELOG [Unreleased] missing security fix entry

**File:** `CHANGELOG.md`
**Finding:** The `[Unreleased]` block does not document the `escHtml()` security hardening from this commit. The history.md and commit message capture it, but CHANGELOG is the user-facing release document.
**Severity:** Low (docs gap)
**Blocks ship:** No

---

### INFO: escHtml() is module-private, not exported

`escHtml()` is a plain function in `app.js`, not exported. This was sufficient for the issue scope, but findings LOW-1/2/3 above arise because sibling modules (`roster.js`, `sequence-builder.js`, `announcements.js`) cannot access it. A shared `utils.js` with `export function escHtml(...)` would make the fix available project-wide.

---

## Semver Assessment

Confirmed PATCH. No behavior change for well-formed input. No API changes. Version correctly stays at 0.2.0.

---

## Summary

| Check | Result |
|-------|--------|
| escHtml() implementation correct | ✅ |
| All issue-specified call sites covered | ✅ |
| Old .replace() calls consolidated | ✅ |
| 59/59 tests pass | ✅ |
| No regressions | ✅ |
| Semver: PATCH | ✅ |
| Remaining unescaped innerHTML sites | ⚠️ 3 files (LOW) |
| CHANGELOG updated | ⚠️ missing entry (LOW) |

**Verdict: PASS.** Core deliverable is correct and complete. Three sibling-module innerHTML sites remain unescaped — all low severity given the single-user threat model, none were in the explicit issue scope. Recommend follow-up issue to export `escHtml()` from a shared `utils.js` and patch the remaining three sites.

---

# QA Report — Issue #8: Custom Sport Action Editor
**Date:** 2026-04-17
**Commit reviewed:** bac8931
**Reviewer:** QA Agent
**Verdict:** PASS

---

## Summary of What Was Implemented

Engineering implemented the custom sport action button editor, the single remaining gap identified in issue #8. The feature allows operators using the "Custom" sport type to add, remove, rename, recolor, and assign point values to action buttons directly from the Settings modal.

**Files changed (bac8931):**
- `js/app.js` — 5 new methods: `_activeActions()`, `_buildActionEditorHtml()`, `_bindActionEditorEvents()`, `_saveActionsFromEditor()`; `updateActionButtons()` updated to use `_activeActions()`; sport-change listener deletes `customActions` on switch away from custom
- `css/style.css` — 8 new rule sets: `.action-editor-section`, `.action-edit-list`, `.action-edit-row`, `.action-label-input`, `.action-id-input`, `.action-color-input`, `.action-points-input`, plus focus states
- `history.md` — Session log updated

The implementation mirrors the existing `_activeSegments()` / `_renderSegmentEditor()` pattern exactly, as specified in the research document.

---

## Findings

### CRITICAL — None

### HIGH — None

### MEDIUM

**M1: Action label rendered into innerHTML without HTML escaping (app.js:726)**

`updateActionButtons()` injects `a.label` directly between button tags:
```js
return `<button ... >${a.label}</button>`;
```
A custom action label containing `<img src=x onerror=alert(1)>` would execute script when rendered. The same pre-existing pattern exists for period chip labels at line 284 (`>${seg}</button>`) and roster player data in `renderRosterEdit()`.

**Severity context:** This app is a single-user local tool with no server, no authentication, no cross-user data sharing. All data lives in the operator's own localStorage. This is self-XSS — a user would have to intentionally craft a malicious label to attack themselves. There is no attack surface in practice. The finding is rated MEDIUM rather than LOW only because the pattern is worth addressing consistently before any multi-user or hosted deployment.

**Recommendation:** Create a utility function `escHtml(s)` that replaces `&`, `<`, `>`, `"`, `'` and apply it to all user-supplied strings in innerHTML templates. The segment editor already escapes `"` with `.replace(/"/g, '&quot;')` on input `value=` attributes (lines 396, 422, 423) — extend this consistently.

**Blocking this PR:** No. The threat model for the current deployment (local static file, single operator, no shared state) does not make this exploitable.

---

### LOW

**L1: No CHANGELOG entry for the new feature**

`CHANGELOG.md` has an empty `[Unreleased]` section. The custom action editor feature was not added to it. Per the project's established CHANGELOG practice (issues #7 and #1 both added entries), this should be documented.

**L2: `textColor` field not captured by action editor (app.js:418-426)**

`_buildActionEditorHtml()` renders label, id, color, and points inputs per action row but omits `textColor`. When `updateActionButtons()` renders the button, it reads `a.textColor || 'white'`, which will always fall back to white for custom actions. This means operators cannot set dark-text buttons (e.g., a yellow button that needs black text). Pre-existing actions like `YELLOW CARD` use `textColor: '#000'` — the custom editor cannot replicate this.

**Recommendation:** Add an `<input type="checkbox" class="action-text-dark-input">` or a second `<input type="color" class="action-text-color-input">` and capture it in `_saveActionsFromEditor()`.

**L3: `customActions` can never be set to an empty array (app.js:551-552)**

```js
if (actions.length) this.gameState.customActions = actions;
```
If the operator deletes all action rows down to one (the minimum enforced by the guard at line 521: `length > 1`), then deletes the last one via a bug or direct edit, `customActions` is never reset to `[]`. It would retain stale data. In practice, the minimum-one-row guard prevents reaching zero, so this is defense-in-depth only.

**L4: Action editor only appears for Custom sport; preset sports cannot customize actions**

The segment editor renders for all sports (any sport can override periods). The action editor is gated to `sport === 'custom'` (line 401). This is consistent with the research spec and the scope of issue #8. However, operators using e.g. Football who want to add a "SAFETY" button (2 points) must switch to Custom and lose the Football segment defaults. Noted as a future enhancement, not a bug.

---

## Correctness Assessment

| Requirement from Research Spec | Implementation | Status |
|---|---|---|
| `_activeActions()` mirrors `_activeSegments()` pattern | Implemented at lines 556-560; identical fallback chain | PASS |
| `updateActionButtons()` routes through `_activeActions()` | Line 723 — uses `this._activeActions()` | PASS |
| Action editor rendered only for `sport === 'custom'` | Line 401 conditional | PASS |
| Editor rows: label, id, color, points, remove | Lines 420-427 in `_buildActionEditorHtml()` | PASS |
| Live-save on input + sync action bar | `_bindActionEditorEvents()` lines 530-533 | PASS |
| Min 1 action row enforced | Line 521: `length > 1` guard before remove | PASS |
| Reset restores default custom preset actions | Lines 535-540 | PASS |
| Clear `customActions` on sport switch away from custom | Line 344-346 | PASS |
| Action ID semantics documented in UI hint | Lines 441-444 | PASS |
| New action row defaults to `id: 'custom'` | Line 509 | PASS |
| All 59 tests pass | Verified via `npm test` | PASS |

---

## Security Assessment

| Vector | Risk | Notes |
|---|---|---|
| XSS via action label in innerHTML | Self-XSS only | Single-user local app; no cross-user exposure |
| XSS via action id in data-attribute | Quoted, low risk | `data-action="${a.id}"` — breaking out requires a `"` in the value |
| CSS injection via action color in style attr | Benign in modern browsers | No script execution via style attribute today |
| ElevenLabs API key exposure | Pre-existing design | Key stored in localStorage, sent only to ElevenLabs directly — no server intermediary |
| Import JSON with malicious content | Pre-existing risk | `importData()` does `JSON.parse()` then renders directly — same self-XSS class |

No new attack surfaces introduced by this commit.

---

## Code Quality Assessment

**Positive:**
- Implementation precisely mirrors the `_activeSegments()` / `_renderSegmentEditor()` pattern as specified — no novel patterns introduced
- Live-sync on input (both `_saveActionsFromEditor()` and `updateActionButtons()` called on input events) gives immediate operator feedback
- Guard against removing the last action row is correct and consistent with segment editor behavior
- CSS reuses existing variables (`--primary`, `--border`, `--bg-card`, `--radius-sm`) — no hardcoded values

**Neutral:**
- The action editor reuses `.segment-remove-btn` CSS class for the remove buttons (adds `.action-remove-btn` for event delegation but inherits the style). This is acceptable but slightly confusing — `.segment-remove-btn` is not a generic class name.

---

## Semver Assessment

The commit message uses `feat(#8):` and the feature is additive (new UI controls for an existing sport type, no breaking API changes). Version `v0.2.0` is still current in `index.html` (line 19). A version bump is **not required** — no prior release was tagged for the issue #8 additions (the existing v0.2.0 tag predates this issue's Engineering work entirely). This is appropriate: the feature will be bundled into the next minor release.

No issues with the existing v0.2.0 version in `index.html`.

---

## Follow-up Issues to Create

| Issue | Priority | Severity |
|---|---|---|
| Add `escHtml()` utility and apply to all user-data innerHTML renders (action labels, period chips, roster fields) | P2 | Medium — future-proofing before any hosted deployment |
| Add `textColor` input to custom action editor rows | P3 | Low — usability gap |
| Add `[Unreleased]` CHANGELOG entry for custom action editor | P3 | Low — documentation gap |

---

##VERDICT##
DECISION: PASS
ROUTE: Docs
REASON: All 5 implementation steps from the research spec are correctly implemented and tested. 59/59 tests pass. No regressions. No critical or high severity findings. Medium finding (innerHTML XSS) is pre-existing pattern, self-XSS only in the current threat model, and non-blocking. Feature works as specified.
ISSUES_CREATED: none (filed as recommendations above)
##END##

##SUMMARY##
DONE: QA review of bac8931 — custom sport action editor for issue #8. All requirements met, 59 tests pass, no critical/high findings. 1 medium (self-XSS in innerHTML, pre-existing pattern), 3 low findings (CHANGELOG gap, missing textColor field, minor array edge case).
FILES: .agent/qa-report.md
COMMITS: (pending)
FOLLOWUP: escHtml utility, textColor input field, CHANGELOG entry
##END##
