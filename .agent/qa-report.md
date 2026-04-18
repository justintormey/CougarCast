# QA Report — Issue #10: Music Cues System (Atmosphere Loop)

**Date:** 2026-04-18
**Reviewer:** QA Agent
**Commit reviewed:** 7ea6f98
**Branch:** agent/CougarCast-10
**Tests:** 59/59 passing

---

## Summary

**PASS** — The atmosphere loop feature is correctly implemented and completes the four-layer PA music cues system (goal horn, timeout music, walkup songs, atmosphere loop). Architecture is sound, audio routing is correct, the kill switch covers both tracks, and no new critical or high-severity issues were found. Two medium-severity issues and two low-severity issues are noted below.

---

## Feature Completeness Checklist

| Requirement (from issue #10) | Status | Notes |
|------------------------------|--------|-------|
| Goal horn on score event | PASS | Shipped in #2; untouched, still wired in `app.js:176` |
| Walkup music from roster tap | PASS | Shipped in #2/#5; untouched, still wired in `app.js:181` |
| Timeout music | PASS | Shipped in #2; untouched, still wired in `app.js:177` |
| Atmosphere/ambient loop | PASS | Implemented in this commit; `playAtmosphere()` / `stopAtmosphere()` |
| Audio routes to PA (right) channel | PASS | `panner.pan.value = 1` at `music-manager.js:112` and `music-manager.js:146` |
| Config/audio lives in `.local/` (gitignored) | PASS | Audio files stored in IndexedDB (browser-local, never committed); `.gitignore` has `.local/` and `.agent/` |
| Independent atmosphere track (does not stop on PLAY) | PASS | `stopMusic()` only clears `_activeAudio`; atmosphere uses separate `_atmosphereAudio` |
| Stop All Music kills both tracks | PASS | `_bindStopButton()` calls both `stopMusic()` and `stopAtmosphere()` |
| Volume control for atmosphere | PASS | Range slider, live gain update via `_atmosphereGain.gain.value` |

---

## Audio Routing Verification

All four cue types route to the correct channel:

- **Goal horn / timeout / walkup** (`_playBlob`): `panner.pan.value = 1` (right = PA) — `music-manager.js:146`
- **Atmosphere** (`playAtmosphere`): `panner.pan.value = 1` (right = PA) — `music-manager.js:112`
- **Preview** (`_previewBlob`): `panner.pan.value = -1` (left = headphone) — `music-manager.js:186`

TTS announcements route via `AudioManager.play()` which uses `pan = 1` (right/PA). Consistent with all music cues.

---

## Security Review

### M1 — Unescaped player name in walkup section innerHTML [MEDIUM]

**Location:** `music-manager.js:324, 328`

```js
const name = `${p.firstName} ${p.lastName}`.trim() || `#${p.number}`;
// ...
<span class="walkup-name">${name}</span>
```

Player `firstName` and `lastName` are injected directly into innerHTML without escaping. A player name containing `<script>` or other HTML would execute in the Music tab. This is self-XSS (operator sets roster data themselves in Settings), consistent with the three known unescaped sites tracked under issue #14. This is a new unescaped site introduced by this commit that was not in scope for issue #11.

**Also at lines 340/344:**
```js
<div class="walkup-team-header home">${home?.mascot || home?.name || 'Home'}</div>
```
Team mascot/name injected without escaping.

**Severity:** MEDIUM (self-XSS only; operator controls their own data; same class as issue #14 findings)
**Recommendation:** Export `escHtml()` to a shared `utils.js` (planned in issue #14) and import in `music-manager.js`. Also add `p.number` escaping.

### L1 — Player number injected into data attributes without sanitization [LOW]

**Location:** `music-manager.js:326, 327, 330, 331`

```js
<div class="walkup-row" data-team="${team}" data-number="${p.number}">
<span class="walkup-number ${team}">#${p.number}</span>
```

`p.number` (jersey number) is injected into HTML attributes and text content without escaping. In practice, roster numbers are always digits set by the operator. Low practical risk but inconsistent with escaping policy. Same mitigation as M1.

---

## Code Quality Review

### L2 — Atmosphere panner node is not stored; disconnect chain is incomplete [LOW]

**Location:** `music-manager.js:97-131`

```js
const panner = ctx.createStereoPanner();
// ...
source.connect(gain);
gain.connect(panner);
panner.connect(ctx.destination);

this._atmosphereAudio = audio;
this._atmosphereUrl = url;
this._atmosphereSource = source;
this._atmosphereGain = gain;
// panner is NOT stored
```

`stopAtmosphere()` calls `this._atmosphereSource.disconnect()` but the `gain → panner → destination` subgraph is not explicitly torn down. In the Web Audio spec, disconnecting a source from downstream does not disconnect downstream nodes from each other. The `panner.connect(ctx.destination)` link persists until AudioContext is closed. Over many start/stop cycles in a long session, this accumulates nodes in the graph.

Note: the same pre-existing pattern exists in `_playBlob()`. This commit does not worsen the situation but does replicate the gap.

**Severity:** LOW (AudioContext GC handles this eventually; operator sessions are bounded in duration)
**Recommendation:** Store `_atmospherePanner` and call `_atmospherePanner.disconnect()` in `stopAtmosphere()`. Apply same fix to `_playBlob()` and `_previewBlob()` as a separate cleanup pass.

### L3 — No user feedback when autoplay is blocked [LOW]

**Location:** `music-manager.js:123-130`

```js
try {
  await audio.play();
  this._updateStopButton();
  this._updateAtmosphereCard();
} catch (err) {
  // Autoplay blocked — Web Audio context may need resuming
  this.stopAtmosphere();
}
```

If the browser blocks autoplay (e.g., iOS before first user gesture), `playAtmosphere()` silently fails. The same silent-failure pattern exists in `_playBlob()` (pre-existing). For atmosphere this is more noticeable because the operator manually presses Play and sees nothing happen with no indication of why.

**Severity:** LOW (consistent with pre-existing pattern; operator will retry after interacting with the page)
**Recommendation:** Surface a brief status message or toast when catch fires. Lower priority — same gap exists throughout the cue track.

---

## Architecture Assessment

The implementation correctly follows the research spec and the established `_playBlob()` pattern:

1. **Two independent audio graphs** — `_activeAudio` (cue track) and `_atmosphereAudio` (atmosphere) share the same `AudioContext` but are independent node chains. Correct.
2. **`stopMusic()` isolation** — `onPlayFired` callback stops only `_activeAudio`. Atmosphere is untouched. Verified.
3. **Stop All kill switch** — `_bindStopButton()` calls both `stopMusic()` and `stopAtmosphere()`. Verified.
4. **Fresh `new Audio(url)` on every `playAtmosphere()` call** — `stopAtmosphere()` is called first to tear down the old instance before creating a new one. Avoids `MediaElementSource` reuse quirk. Correct.
5. **Gain node for live volume control** — `_atmosphereGain.gain.value = vol` updated directly during playback without stop/restart. Correct.
6. **PA channel routing** — `panner.pan.value = 1` throughout. Consistent with all other cues.
7. **In-place button update** — `_updateAtmosphereCard()` swaps `.play-atm` / `.stop-atm` class without a full re-render. Avoids re-binding all event listeners on every play/stop. Correct pattern.

---

## Test Coverage

59/59 tests pass (unchanged from prior QA). The atmosphere track is a UI/audio-hardware layer with no pure logic to unit test (IndexedDB, Web Audio API, and DOM manipulation are all outside Vitest's Node environment). Consistent with the existing `MusicManager` coverage decision. No new testable pure logic was added.

---

## Config Structure

Audio blobs are stored in IndexedDB (`ainnouncr_audio` DB, `cues` store). Browser-local and never committed to git. `.gitignore` correctly excludes `.local/` for deploy config and roster PII. Config structure requirement is met.

---

## Verdict

**PASS.** The atmosphere loop is correctly implemented, correctly isolated from the cue track, correctly routed to the PA (right) channel, and the Stop All kill switch covers both tracks. The medium finding (M1, unescaped innerHTML for player/team names) is consistent in severity with the three sites tracked in issue #14 and should be folded into that work. No blockers.

### Follow-up Recommended

1. **Expand issue #14 scope**: Add `music-manager.js` unescaped player name, player number, and team name sites to the `escHtml()` / `utils.js` migration.
2. **Panner node cleanup** (low priority): Store and disconnect panner in `stopAtmosphere()`, `stopMusic()`, and `_previewBlob()` teardown paths.

---

##SUMMARY##
DONE: QA review of 7ea6f98 — atmosphere loop for issue #10. All four music cues complete. 59 tests pass. No critical/high findings. 1 medium (unescaped innerHTML for player/team names in walkup section, same class as issue #14), 3 low findings (player number attribute, panner node cleanup, silent autoplay failure).
FILES: .agent/qa-report.md
COMMITS: (pending)
FOLLOWUP: Expand issue #14 to include music-manager.js unescaped sites | Panner disconnect cleanup (low priority)
##END##

---

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
