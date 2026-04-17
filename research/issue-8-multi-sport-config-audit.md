# Issue #8 — Multi-Sport Support & Config Screen: Gap Analysis
**Last Updated:** 2026-04-17 (v2 — corrects stale v1 findings after full code audit)
**Issue:** #8 — "Let's add multi-sport support and a config screen"
**Branch:** agent/8

---

## Executive Summary

Issue #8 is **~92% complete**. The multi-sport foundation, period strip, editable segment editor, auto-score on period advance, sport badge, and score reporting are all shipped in `main`. 

**One functional gap remains:** the "Custom" sport type has no action editor. Users can define custom period names but the action buttons are hardcoded and cannot be changed.

Deployment documentation is also missing but is low priority (infrastructure, not functionality).

---

## Methodology

- Full read of `js/app.js` (710 lines), `index.html`, `css/style.css`
- Read `history.md` session logs (issues #1–8)
- Cross-referenced v1 of this document against actual `main` HEAD (`fb708ef`)
- Verified each prior-claimed gap against current implementation

---

## Corrections from v1 of This Document

The first version of this research (written before the issue #8 session-log work landed in main) described four gaps. Two of those are now implemented:

| Prior v1 Claim | Actual Code State |
|---|---|
| "Segment editor = comma-separated input (poor UX)" | **WRONG** — `_renderSegmentEditor()` renders individual rows with add/remove/rename per `app.js` L374-406 |
| "No auto-load score on period advance" | **WRONG** — `changePeriod()` calls `generateScoreReport()` + `_pulseAudioBar()` on forward advance at `app.js` L215-218 |
| "No custom action editor" | **Still correct** — `updateActionButtons()` reads hardcoded preset only |
| "No deployment workflow" | **Still correct** — no docs, no deploy script in repo |

---

## True Requirement Audit

| Requirement | Status | Code Location |
|---|---|---|
| 7 sport presets | ✅ Done | `SPORT_PRESETS` in `app.js` L13-122 |
| Sport configuration screen (Settings modal) | ✅ Done | Settings → Sport Configuration section |
| Period strip with ◀▶ navigation + chip tap | ✅ Done | `renderPeriodStrip()`, `setupPeriodControls()` |
| Editable segment editor (individual rows, add/remove/rename) | ✅ Done | `_renderSegmentEditor()` L374-406 |
| Auto-load score report on period advance | ✅ Done | `changePeriod()` L215-218 |
| Manual score report button (📣) | ✅ Done | `#score-report-btn` → `generateScoreReport()` |
| Final vs. mid-game score differentiation | ✅ Done | `isFinal` check in `generateScoreReport()` L247 |
| Sport badge in header | ✅ Done | `#sport-badge` + `renderSportBadge()` L630-637 |
| UI modernization | ✅ Done | Period strip, music tab, score bar (issue #2) |
| Music cues (goal horn, timeout, walkup) | ✅ Done | `MusicManager` + `AudioStorage` |
| **Custom sport action editor** | ❌ **Missing** | `updateActionButtons()` reads hardcoded preset only |
| Deployment documentation / demo site | ❌ Missing (low priority) | No docs; `.local/deploy.json` exists but gitignored |

---

## Gap 1: Custom Sport — No Action Editor (MUST SHIP)

### Problem

When `sport === 'custom'`, action buttons are locked to 5 hardcoded defaults: `[GOAL, ASSIST, PENALTY, TIMEOUT, CUSTOM]`. Users can define custom period names via the segment editor but **cannot** change what action buttons appear.

There is no way to:
- Rename buttons (e.g., "FREE THROW" instead of "GOAL")
- Add sport-specific actions (e.g., "CORNER KICK", "OFFSIDE")
- Set point values per action
- Change button colors

The `_renderSegmentEditor()` gives full period customization. An action editor does not exist.

### Root Cause

`updateActionButtons()` in `app.js` (L616-628) always reads from `SPORT_PRESETS[sport].actions`:

```js
updateActionButtons() {
  const sport = this.gameState.sport || 'lacrosse';
  const preset = SPORT_PRESETS[sport] || SPORT_PRESETS.lacrosse;  // hardcoded — no customActions check
  const actionBar = document.querySelector('.action-bar');
  actionBar.innerHTML = preset.actions.map(a => { /* ... */ }).join('');
  this.sequenceBuilder.bindActionButtons();
}
```

No `_activeActions()` method exists. `gameState.customActions` is not a field.

### Implementation Spec

**Pattern:** Mirror `_activeSegments()` / `_renderSegmentEditor()` exactly — this pattern is proven, tested, and working.

#### 1. Add `_activeActions()` to `app.js`

```js
_activeActions() {
  const sport = this.gameState.sport || 'lacrosse';
  if (this.gameState.customActions?.length) return this.gameState.customActions;
  return SPORT_PRESETS[sport]?.actions || SPORT_PRESETS.lacrosse.actions;
}
```

#### 2. Update `updateActionButtons()` to call `_activeActions()`

```js
updateActionButtons() {
  const actionBar = document.querySelector('.action-bar');
  actionBar.innerHTML = this._activeActions().map(a => {
    const textColor = a.textColor || 'white';
    const pts = a.points ? `data-points="${a.points}"` : '';
    return `<button class="action-btn" data-action="${a.id}" ${pts} style="background:${a.color};color:${textColor}">${a.label}</button>`;
  }).join('');
  this.sequenceBuilder.bindActionButtons();
}
```

#### 3. Extend `_renderSegmentEditor()` — add action editor section when `sport === 'custom'`

Append after the segment rows. Each action row needs:
- Text input for `label`
- `<input type="color">` for `color`
- Number input for `points` (0 = non-scoring)
- Delete row button
- "Add Action" button at bottom

`gameState.customActions[]` shape (mirrors existing `SPORT_PRESETS.*.actions`):
```js
[
  { id: 'goal',    label: 'GOAL',    color: '#2e7d32', points: 1 },
  { id: 'timeout', label: 'TIMEOUT', color: '#37474f', points: 0 },
  { id: 'custom',  label: 'CUSTOM',  color: '#616161', points: 0 },
]
```

**⚠️ ID semantics to document in UI hint:**
- `id: 'goal'` / `'goal1'` / `'goal2'` / `'goal3'` → triggers score increment + goal horn (wired in `SequenceBuilder.interpret()`)
- `id: 'timeout'` → triggers timeout music cue
- `id: 'custom'` → triggers custom text input prompt
- These IDs work automatically when reused in custom actions — a benefit, not a gotcha

#### 4. Add `_bindActionEditorEvents()` and `_saveActionsFromEditor()`

Follow `_bindSegmentEditorEvents()` / `_saveSegmentsFromEditor()` exactly:

```js
_saveActionsFromEditor() {
  const list = document.getElementById('action-edit-list');
  if (!list) return;
  const actions = Array.from(list.querySelectorAll('.action-edit-row')).map(row => ({
    id: row.querySelector('.action-id-input').value.trim() || 'custom',
    label: row.querySelector('.action-label-input').value.trim() || 'ACTION',
    color: row.querySelector('.action-color-input').value || '#616161',
    points: parseInt(row.querySelector('.action-points-input').value) || 0,
  })).filter(a => a.label);
  if (actions.length) this.gameState.customActions = actions;
}
```

#### 5. Clear `customActions` on sport switch away from `'custom'`

In the `#sport-preset` change listener (`setupSettings()` ~L339):
```js
if (sport !== 'custom') {
  delete this.gameState.customActions;
}
```

### Files to Change

| File | Change |
|---|---|
| `js/app.js` | `_activeActions()`, update `updateActionButtons()`, extend `_renderSegmentEditor()` for actions, `_bindActionEditorEvents()`, `_saveActionsFromEditor()`, clear `customActions` on sport switch |
| `css/style.css` | Action editor row styles (~8-12 new CSS rules — reuse `.player-edit-row` pattern) |
| `index.html` | **No changes needed** — action editor renders into existing `#segment-editor` container |
| `js/storage.js` | **No changes needed** — `customActions` auto-survives via `saveGame(gameState)` |

**Tests:** Existing 59 tests should pass unchanged (no changes to `text-generator.js` or `storage.js` logic). App class is not unit-tested directly.

**Estimated effort:** Medium — 3-4 hours.
**Semver:** MINOR (additive feature, no breaking changes)

---

## Gap 2: Deployment Documentation (LOW PRIORITY)

**Context:** `.local/deploy.json` (gitignored) in the production instance contains CloudFront distribution ID. The deployer.py is part of the Half Bakery infrastructure. The demo site `demo.justintormey.com/cougarcast/` is not live.

**Recommendation:** 
1. Add `docs/deploy.md` — general S3 static deploy pattern with placeholder values
2. Add `.local/deploy-config.example.json` — template showing structure (safe to commit, no real values)
3. Actual DNS + S3 setup is infrastructure work outside this repo — separate task or manual

**Semver:** PATCH

---

## Architecture Notes

No architectural changes required:

- **`_activeSegments()` pattern is proven** — `_activeActions()` is a direct copy of the same paradigm
- **`SequenceBuilder.interpret()` is sport-agnostic** — it keys on action IDs; custom actions reusing standard IDs work automatically
- **Zero-dependency constraint holds** — all changes are vanilla ES modules, no new imports
- **localStorage capacity** — `gameState.customActions` is a new array field; well within the 5-10MB limit

---

## Priority Order for Engineering

| Priority | Item | Effort | Impact |
|---|---|---|---|
| P1 | Custom sport action editor | Medium (3-4h) | High — completes the "Custom" sport feature |
| P2 | Deployment docs | Low (30min) | Medium — enables Justin to self-deploy |

**Everything else in the issue epic is already done.**

---

## Critical Warning: Branch History

**Eight+ prior merge conflicts on `agent/8`.** The branch is at `main` HEAD (`fb708ef`). Engineering must:
1. Work only on `agent/8` — never commit to `main` directly
2. Verify `git status` is clean before starting
3. Let the dispatcher handle the merge after QA passes
