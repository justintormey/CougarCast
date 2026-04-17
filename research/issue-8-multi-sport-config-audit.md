# Issue #8 — Multi-Sport Support & Config Screen: Gap Analysis & Implementation Plan

**Date:** 2026-04-17  
**Stage:** Research → Engineering  
**Issue:** #8 — "Let's add multi-sport support and a config screen"

---

## Executive Summary

Issue #2 (merged 2026-04-13) delivered the majority of the multi-sport foundation. The core infrastructure — 7 sport presets, period strip, score reporting, segment editor — is complete and working. What remains is a set of targeted UX gaps in the custom sport editor, two score-reporting enhancements, and the deployment workflow.

**Status: ~75% done. Four discrete gaps remain. All are implementable without architectural changes.**

---

## Methodology

- Read all JS modules: `app.js`, `text-generator.js`, `sequence-builder.js`, `music-manager.js`, `roster.js`, `storage.js`, `audio-manager.js`
- Read `index.html` and `css/style.css`
- Read `history.md` and `project-visions.md`
- Audited current Settings modal, sport config flow, period strip, and score reporting
- Cross-referenced against issue epic requirements

---

## Requirement Audit

| Requirement | Status | Notes |
|---|---|---|
| Multi-sport support (presets) | ✅ Done | 7 sports: lacrosse, field hockey, ice hockey, soccer, basketball, football, baseball |
| Sport configuration screen | ✅ Done | Settings modal → "Sport Configuration" section |
| Period structure editor (preset) | ✅ Done | Read-only preview pills for presets |
| Period structure editor (custom) | ⚠️ Partial | Comma-separated input works; no add/remove UX |
| **Custom action editor** | ❌ Missing | Can define periods for "Custom" sport but cannot edit action buttons |
| Score reporting (manual) | ✅ Done | 📣 button → generates text → loads to audio bar |
| Score reporting (period-end auto-prompt) | ⚠️ Partial | Button exists; no auto-prompt when period is advanced |
| Final vs. mid-game score differentiation | ✅ Done | `isFinal` check routes to `generateFinalScore` vs `generatePeriodScore` |
| UI modernization | ✅ Done | Sneat design system, Inter font, CSS custom properties |
| Music cues (goal horn, timeout, walkup) | ✅ Done | `MusicManager` + `AudioStorage` |
| **Deployment workflow** | ❌ Missing | deployer.py integration not documented; demo site not live |
| Demo at demo.justintormey.com/cougarcast/ | ❌ Missing | Unfinished per history.md |

---

## Gap 1: Custom Sport — No Action Editor

**Problem:** When sport = `custom`, users can define period names (comma-separated) but the action buttons are hardcoded to `[GOAL, ASSIST, PENALTY, TIMEOUT, CUSTOM]`. There is no way to:
- Add sport-specific actions (e.g., "FREE THROW", "CORNER KICK")
- Rename default actions
- Set point values per action
- Change button colors

**Impact:** The "custom" option is half-built — you can describe your periods but your scoreboard actions are locked.

**Current code location:** `app.js` → `SPORT_PRESETS.custom.actions` (hardcoded array). `_renderSegmentEditor()` only handles the segment (period name) editor.

**Recommended fix:**

Extend `_renderSegmentEditor()` to also render an action editor when `sport === 'custom'`. Store custom actions on `gameState.customActions[]`. When `_activeSegments()` checks for custom overrides, add a parallel `_activeActions()` that checks `gameState.customActions` first.

```
// Proposed gameState shape for custom actions:
gameState.customActions = [
  { id: 'goal', label: 'GOAL', color: '#2e7d32', points: 1 },
  { id: 'timeout', label: 'TIMEOUT', color: '#37474f' },
  ...
]
```

**UI approach:** A table-style editor in the Settings modal (similar to roster editor rows), with:
- Text input for label
- Color picker for button color
- Number input for points (0 = non-scoring)
- Delete row button
- "Add Action" button at bottom

**Semver:** MINOR (additive feature, no breaking changes)

---

## Gap 2: Period-End Auto-Prompt for Score Report

**Problem:** After pressing ▶ or ◀ to advance/retreat a period, nothing prompts the operator to announce the score. The 📣 button is always available but passive.

**Impact:** In the middle of a live game, the operator can easily forget to hit 📣 at the end of a period. Real announcers always do a score recap at period transitions.

**Current code location:** `app.js` → `changePeriod(delta)` — saves period and re-renders strip but takes no other action.

**Recommended fix (two options):**

**Option A — Toast/nudge (non-blocking):** After `changePeriod()`, flash a brief "Announce score?" toast with a single tap to load the score into the audio bar. Auto-dismisses in 8 seconds.

**Option B — Auto-load (zero-friction):** After period change, automatically generate the score text and pre-load it into the audio bar (same as clicking 📣 manually). The operator can choose to play or ignore it.

**Recommendation:** Option B. The operator still controls when/whether to play. Zero extra taps. Fits the "low friction during live games" design principle.

**Implementation:** In `changePeriod()`, after `renderPeriodStrip()`, call `this.generateScoreReport()` automatically.

**Semver:** MINOR

---

## Gap 3: Deployment Workflow

**Problem:** Per `history.md`, the deploy path is: "Deployed to S3 via Half Bakery `deployer.py`." But:
- `deployer.py` is not documented in this repo
- The demo URL (`demo.justintormey.com/cougarcast/`) is not live
- There is no `.local/` deployment config in the committed repo (correctly gitignored)

**Impact:** Justin cannot deploy without reconstructing the workflow from memory.

**Current state:** The project is a pure static site — `index.html` + `js/` + `css/`. No build step. Any S3/CloudFront setup works.

**Recommended fix:**

1. Add `docs/deploy.md` (committed, safe to public) documenting the general S3 static deploy pattern with placeholder bucket/distribution values.
2. Add `.local/deploy-config.example.json` (a committed template showing expected structure, without real values) so the gitignored `.local/deploy-config.json` has a reference shape.
3. If the `deployer.py` script is in the half-bakery infra, document the call signature here.

**Note:** The actual demo site setup (S3 bucket creation, CloudFront, DNS) is infrastructure work outside this repo. Should be a separate half-bakery task or done manually.

**Semver:** PATCH (docs/config only, no code changes)

---

## Gap 4: Segment Editor UX Polish

**Problem:** The custom segment editor is a single `<input type="text">` with comma-separated values (e.g., `"Q1, Q2, Q3, Q4, OT"`). This is functional but fragile — easy to introduce syntax errors, hard to reorder, hard to add/remove individual items.

**Impact:** Low — the input works fine for technical users. But it's inconsistent with the more polished roster editor (individual rows with add/remove buttons).

**Recommended fix:** Replace the comma-separated input with a list-style editor matching the roster editor pattern:
- Each segment as its own row with a text input
- Delete button per row
- "Add Segment" button at bottom
- Drag-to-reorder is nice-to-have but not required for v1

**Semver:** MINOR (UX improvement, no data model change — still stored as `customSegments[]`)

---

## Architecture Notes (No Changes Required)

The existing architecture handles multi-sport cleanly:

- **`_activeSegments()`** already checks `gameState.customSegments` before falling back to preset. A parallel `_activeActions()` follows the same pattern.
- **`SequenceBuilder.interpret()`** is sport-agnostic — it keys on action IDs (`goal*`, `timeout`, infraction types). Custom actions using these IDs will work automatically.
- **`SPORT_PRESETS` in `app.js`** — history.md notes this could move to `sports.js` if it grows. At 7 presets + custom, it's still fine inline. No extraction needed for this issue.
- **Zero-dependency constraint** — all recommendations above are implementable in vanilla ES modules. No new dependencies.

---

## Priority Order for Engineering

| Priority | Gap | Effort | Impact |
|---|---|---|---|
| 1 | Custom sport action editor (Gap 1) | Medium (~4-6h) | High — completes the "custom" sport promise |
| 2 | Period-end auto-load score (Gap 2) | Low (~30min) | High — live game UX win |
| 3 | Segment editor UX polish (Gap 4) | Low-medium (~2h) | Medium — polish |
| 4 | Deployment docs (Gap 3) | Low (~1h) | Medium — unblocks demo site |

---

## Files to Change (Engineering Phase)

| File | Change |
|---|---|
| `js/app.js` | Add `_activeActions()`, extend `_renderSegmentEditor()` for action editor, call `generateScoreReport()` from `changePeriod()`, handle `gameState.customActions` in `saveSettings()` and `updateActionButtons()` |
| `index.html` | No structural changes required — action editor renders into existing `#segment-editor` container |
| `css/style.css` | Action editor row styles (reuse `.player-edit-row` pattern), minor tweaks |
| `js/storage.js` | Verify `customActions` survives round-trip (likely automatic since it's just stored on gameState) |
| `docs/deploy.md` | New file — deployment documentation |

**Tests to add/update:**
- No changes to `text-generator.js` or `storage.js` logic, so existing 59 tests should pass unchanged
- Add a test for `_activeActions()` in `app.js` (currently untested, since App is not exported) — low priority

---

## Risks & Flags

- **`createMediaElementSource` one-time limit**: Web Audio API limits: each `<audio>` element can only be connected to an `AudioContext` once. This is already handled in `MusicManager` but worth noting for any new audio features.
- **Custom action IDs**: If a custom action uses `id: 'goal'` (the default), it will trigger score increment and goal horn. This is correct behavior but should be called out in the UI.
- **LocalStorage size**: `gameState` is growing (customSegments, customActions). Still well within the 5-10MB limit, but worth monitoring.

---

## Recommendation

**Ship Gaps 1+2 together as a single engineering issue.** Gap 2 is 30 minutes of work — no reason to wait. Gap 1 is the real meat of issue #8 and completes the "custom sport" feature.

**Gap 3 (deployment)** is a separate concern — either document it manually or create a separate infra issue.

**Gap 4 (segment editor polish)** is a nice-to-have that can be bundled with Gap 1 since the same Settings modal section is being reworked.
