<!-- Previous content for issue #8 preserved below the issue #10 section -->

---

# Research: Issue #10 — Music Cues System (Atmosphere Loop Gap Analysis)

**Date:** 2026-04-17  
**Stage:** Research → Engineering  
**Semver:** MINOR (additive — new audio track + UI card, no breaking changes)  
**Issue:** justintormey/CougarCast #10

---

## Executive Summary

Three of the four music cues described in issue #10 already ship. The **only missing piece is the atmosphere/crowd ambient loop**. Engineering scope is: add `_atmosphereAudio` as a second independent audio track in `MusicManager`, add a new UI card on the Music tab, and wire a "Start Crowd / Stop Crowd" toggle distinct from the existing stop-all behavior.

---

## Current State Audit

| Cue | Trigger | Status | Code Location |
|-----|---------|--------|---------------|
| Goal horn | `onGoalScored` callback → `SequenceBuilder._triggerMusicCue()` | ✅ Shipped (#2) | `MusicManager.playGoalHorn()` |
| Timeout music | `onTimeoutCalled` callback → `SequenceBuilder._triggerMusicCue()` | ✅ Shipped (#2) | `MusicManager.playTimeout()` |
| Walkup music | Player tap → `rosterManager.onPlayerSelect` hook in `app.js` | ✅ Shipped (#2, fixed #5) | `MusicManager.playWalkup(team, number)` |
| Atmosphere loop | Manual start/stop by operator | ❌ **Not implemented** | — |

---

## Gap: Atmosphere / Crowd Ambient Loop

### What it is
A continuous looping audio track (crowd noise, pre-game music, stadium ambience) that:
- Runs independently of the three event-triggered cues
- Plays on the PA (right) channel at a reduced volume (background level)
- Persists through goal horns, walkup songs, and TTS announcements
- Is manually started and stopped by the operator (not auto-triggered)
- Is completely optional — no impact if no file is uploaded

### Why the current single-track model won't work
`MusicManager` has one `_activeAudio` slot. Every call to `_playBlob()` calls `stopMusic()` first, killing whatever was playing. An atmosphere loop killed every time a player taps would be unusable.

Atmosphere requires a **second, independent audio instance** that:
1. Lives in `_atmosphereAudio` (separate from `_activeAudio`)
2. Is not stopped by `stopMusic()` (called on every ▶ PLAY press via `onPlayFired`)
3. Has its own `stopAtmosphere()` method
4. Is included in "Stop All" (the global ■ Stop All Music button)

---

## Architecture Design

### Data Model

Add one new IndexedDB key to `audio-storage.js`:
```js
export const CUE_KEYS = {
  goalHorn:   () => 'goal-horn',
  timeout:    () => 'timeout',
  walkup:     (team, number) => `walkup-${team}-${number}`,
  atmosphere: () => 'atmosphere',          // NEW
};
```

No changes to `AudioStorage` class — the key naming is all that's needed.

### MusicManager State Additions

```js
// NEW — separate atmosphere track state
this._atmosphereAudio  = null;
this._atmosphereUrl    = null;
this._atmosphereSource = null;
this._atmosphereVolume = 0.4;   // default 40% — background level
```

### New Methods

```js
// Start atmosphere loop (loops until stopAtmosphere())
async startAtmosphere() {
  const blob = await this.audioStorage.load(CUE_KEYS.atmosphere());
  if (!blob) return;
  await this._playAtmosphereBlob(blob);
}

// Stop atmosphere loop only (does NOT kill goal horn / walkup / timeout)
stopAtmosphere() {
  if (this._atmosphereAudio) {
    this._atmosphereAudio.pause();
    this._atmosphereAudio = null;
  }
  if (this._atmosphereUrl) {
    URL.revokeObjectURL(this._atmosphereUrl);
    this._atmosphereUrl = null;
  }
  if (this._atmosphereSource) {
    try { this._atmosphereSource.disconnect(); } catch { /* gone */ }
    this._atmosphereSource = null;
  }
  this._updateAtmosphereButton();
}

// Internal: play blob on right (PA) channel at atmosphere volume, looping forever
async _playAtmosphereBlob(blob) {
  this.stopAtmosphere();

  const ctx = this.audioManager.getContext();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.loop = true;

  const source = ctx.createMediaElementSource(audio);
  const gain   = ctx.createGain();
  gain.gain.value = this._atmosphereVolume;
  const panner = ctx.createStereoPanner();
  panner.pan.value = 1;  // right = PA

  source.connect(gain);
  gain.connect(panner);
  panner.connect(ctx.destination);

  this._atmosphereAudio  = audio;
  this._atmosphereUrl    = url;
  this._atmosphereSource = source;

  try {
    await audio.play();
    this._updateAtmosphereButton();
  } catch (err) {
    this.stopAtmosphere();
  }
}
```

### `stopMusic()` modification

**Do NOT change `stopMusic()`**. It is called on every ▶ PLAY press via the `onPlayFired` hook and should continue to kill walkup/goal horn/timeout. Atmosphere persists through game events intentionally.

Update only the **"Stop All Music" button handler** to call both:
```js
newBtn.addEventListener('click', () => {
  this.stopMusic();
  this.stopAtmosphere();
});
```

### Volume Control

Add a simple volume slider on the atmosphere card. Store the value in `this._atmosphereVolume` (session only — no persistence needed). When the slider changes:
```js
slider.addEventListener('input', (e) => {
  this._atmosphereVolume = parseFloat(e.target.value);
  // Update gain in real-time if track is currently playing
  if (this._atmosphereGain) {
    this._atmosphereGain.gain.value = this._atmosphereVolume;
  }
});
```

To support real-time volume updates, store the `gain` node reference:
```js
this._atmosphereGain = gain;  // add to _playAtmosphereBlob after creating gain node
```

---

## UI Design

### New card in `MusicManager.render()`

Insert between "Timeout Music" and the "■ Stop All Music" button:

```html
<div class="music-card" id="card-atmosphere">
  <div class="music-card-header">
    <span class="music-card-icon">🏟️</span>
    <div class="music-card-meta">
      <div class="music-card-title">Crowd / Atmosphere</div>
      <div class="music-card-sub">Loops continuously on PA — start/stop manually</div>
    </div>
    <span class="music-status-badge [loaded|empty]">[Loaded|No file]</span>
  </div>
  <div class="music-card-actions">
    <button class="music-btn upload" data-cue="atmosphere">⬆ Upload</button>
    <button class="music-btn preview" data-cue="atmosphere" [disabled]>▶ Preview</button>
    <button class="music-btn clear danger" data-cue="atmosphere" [disabled]>✕ Clear</button>
  </div>
  <!-- Start/stop toggle — only shown when file is loaded -->
  <div class="atmosphere-controls" [hidden if no file]>
    <button class="atmosphere-toggle-btn [active if playing]" id="atmosphere-toggle-btn">
      [▶ Start Crowd | ■ Stop Crowd]
    </button>
    <div class="atmosphere-volume-row">
      <label>Volume</label>
      <input type="range" id="atmosphere-volume" min="0" max="1" step="0.05" value="0.4">
      <span id="atmosphere-volume-pct">40%</span>
    </div>
  </div>
  <input type="file" class="music-file-input" id="file-atmosphere" accept="audio/*" style="display:none">
</div>
```

### Toggle button behavior

```
State: no file loaded   → "Start Crowd" (disabled)
State: file loaded, not playing → "▶ Start Crowd" (enabled)
State: file loaded, playing → "■ Stop Crowd" (active/highlighted)
```

The toggle button:
- Is NOT the global stop button — it only affects atmosphere
- Must survive `render()` re-renders: rebind after each render call (same pattern as `_bindStopButton()`)

### `_updateAtmosphereButton()` helper

Called by `startAtmosphere()`, `stopAtmosphere()`, and after blob plays:
```js
_updateAtmosphereButton() {
  const btn = document.getElementById('atmosphere-toggle-btn');
  if (!btn) return;
  const isPlaying = !!this._atmosphereAudio;
  btn.textContent = isPlaying ? '■ Stop Crowd' : '▶ Start Crowd';
  btn.classList.toggle('active', isPlaying);
}
```

---

## Interaction Matrix

| Event | Effect on atmosphere | Rationale |
|-------|---------------------|-----------|
| ▶ PLAY pressed | No effect | Atmosphere is background — persists through announcements |
| Goal → goal horn plays | No effect | Both tracks play simultaneously (stadium experience) |
| Player tapped → walkup plays | No effect | Walkup overlays atmosphere |
| TIMEOUT → timeout music plays | No effect | Timeout music overlays crowd ambience |
| "■ Stop All Music" button | `stopMusic()` + `stopAtmosphere()` | Operator emergency stop |
| "■ Stop Crowd" toggle | `stopAtmosphere()` only | Operator intentionally ends ambience |
| `stopMusic()` called programmatically | No effect on atmosphere | Walkup/goal horn/timeout stop; crowd continues |

---

## `.local/` Config Note

Issue text says "Config lives in `.local/` gitignored structure." In practice, this refers to the pattern already in use: audio files are stored in **IndexedDB** (browser-local, never committed, team-specific). The new atmosphere file follows the same pattern — no changes to `.local/` directory structure or git ignore rules required.

---

## Files Engineering Will Touch

| File | Change |
|------|--------|
| `js/audio-storage.js` | Add `atmosphere: () => 'atmosphere'` to `CUE_KEYS` |
| `js/music-manager.js` | Add `_atmosphereAudio/Url/Source/Gain/Volume` state; add `startAtmosphere()`, `stopAtmosphere()`, `_playAtmosphereBlob()`, `_updateAtmosphereButton()`; add atmosphere card to `render()`; update stop-all button to also call `stopAtmosphere()` |
| `css/style.css` | Add `.atmosphere-controls`, `.atmosphere-toggle-btn`, `.atmosphere-toggle-btn.active`, `.atmosphere-volume-row` styles |
| `history.md` | Update after Engineering ships |

**No changes needed:** `app.js`, `sequence-builder.js`, `index.html` (music tab is dynamic), test files.

---

## Risk Flags

### Web Audio + MediaElementSource quirk
Each call to `ctx.createMediaElementSource(audio)` binds the `<Audio>` element to the context permanently. Calling it again on the same element after stop/restart throws a `DOMException`. The `_playAtmosphereBlob()` method must create a fresh `new Audio(url)` on every start (same pattern already used in `_playBlob()` — this is correct).

### Multiple AudioContext instances
`audioManager.getContext()` returns the same singleton context (or resumes a suspended one). Both `_activeAudio` and `_atmosphereAudio` route through the same context — this is intentional and correct.

### iOS Safari autoplay
On iOS, audio requires a user gesture to begin. Both tracks must be started from a button click event (not programmatically). The atmosphere "▶ Start Crowd" button satisfies this. No async gaps between click and `audio.play()`.

### Concurrent MediaElement sources + StereoPanner
Web Audio supports multiple concurrent `MediaElementSource` nodes routed through independent `StereoPanner` nodes to the same destination. This is standard and well-supported in all target browsers (Chrome, Safari, Firefox on tablet).

---

## Semver Classification

**MINOR** — additive feature, no API or behavior changes to existing cues.

---

## Priority

**P1** — Atmosphere is the only feature gap in issue #10. The other three cues are already shipped.

---
---

# Research: Issue #8 — Multi-Sport Config + Action Editor (Archived)
<!-- NOTE: This section was written for issue #8 and is kept for historical context only. -->
<!-- Issue #8 is CLOSED. All work is complete as of 2026-04-17. -->

# ~~SUPERSEDED~~ See updated analysis below

---

# Research: Issue #8 — Accurate Gap Analysis (Updated 2026-04-17)

**Date:** 2026-04-17  
**Stage:** Research → Engineering  
**Semver:** MINOR (additive features, no breaking changes)

---

## Methodology

Full read of codebase (`app.js`, `index.html`, `css/style.css`, `history.md`), GitHub issue comments, and QA rejection history. Prior agent attempts failed by submitting zero commits; this analysis establishes the ground truth for Engineering.

---

## Current State vs. Issue Intent

The QA skeptic was correct: most of issue #8's stated features shipped in issue #2 (2026-04-13). The core multi-sport plumbing is done. However, the **UX is incomplete** — the config screen is buried in a general Settings modal and has meaningful gaps.

| Feature | Status | Gap |
|---------|--------|-----|
| 7 sport presets | ✅ Shipped (#2) | none |
| Period strip UI | ✅ Shipped (#2) | none |
| Score report button | ✅ Shipped (#2) | none |
| Sport selector in Settings | ✅ Shipped (#2) | Buried in generic Settings modal |
| Custom segments editor | ✅ Shipped (#2, text-input only) | Poor UX — comma-separated string |
| Preset segment editing | ❌ Not possible | Must switch to "Custom" to tweak a preset |
| Action button customization | ❌ Not possible | Hardcoded per preset, no user edits |
| Deployment workflow | ❌ Not shipped | Listed as future work in history.md |

---

## Findings

### Finding 1: The "Config Screen" UX Gap

The sport config is a 3-row block inside the general Settings modal. For pre-game setup (which is the primary use case), the operator must scroll through API keys, voice selection, and team rosters to reach sport configuration. The intended "config screen" should be a distinct pre-game setup flow or a clearly separated section.

**Recommendation:** Add a collapsible "Game Setup" section at the top of the Settings modal (before API key), OR add a "New Game" wizard that fires on first load or explicit reset. The former is lower effort and consistent with the existing architecture.

### Finding 2: Custom Segments Editor Is Primitive

`_renderSegmentEditor()` for `sport === 'custom'` renders a single `<input type="text">` taking comma-separated values like `"Q1, Q2, Q3, Q4, OT"`. This is not discoverable and error-prone.

For preset sports, segments are shown as read-only pills — no user can intuit that to change them they must switch sport to "Custom."

**Recommendation:** Improve the segment editor for **all** sports:
- Preset mode: show "Customize" toggle that forks to a per-game custom override (without permanently switching sport type)
- Custom mode: replace text input with an add/remove list (one row per segment)

Implementation note: `gameState.customSegments` already supports per-game overrides. The infrastructure is there; only the UI needs improvement.

### Finding 3: No Action Button Customization

Actions are hardcoded per sport preset. The `custom` sport type has a fixed default set. There's no mechanism to add/remove/rename action buttons for a given game.

**Recommendation (lower priority):** Add action customization to the custom sport type. This is a MINOR feature that requires `gameState.customActions[]` and a small editor in Settings. Defer to a follow-on issue if Engineering scope is already large.

### Finding 4: Deployment Workflow

The README references `demo.justintormey.com/cougarcast/` but no deployment tooling exists. The `.local/` directory (gitignored) is for team-specific config but no deploy script ships in the public repo.

**Recommendation:** Add `scripts/deploy.sh` — a simple rsync/scp script with a placeholder server path, and a `scripts/serve-local.sh` using Python's `http.server`. Also add a GitHub Pages workflow (`.github/workflows/deploy.yml`) that auto-deploys `main` to Pages — this satisfies the demo URL requirement with zero infra cost.

**Constraint:** Must remain static-file-only. No build step. GitHub Pages native supports this.

### Finding 5: Settings Modal Scroll UX

With 6+ sections (API, voice, sport, home team, away team, rosters), the modal scrolls significantly on tablet. Rosters with 20+ players become unwieldy.

**Recommendation:** Add collapsible `<details>` sections for Rosters and Data Import/Export — less critical for day-of-game use. This is pure HTML/CSS, no JS needed beyond the native `<details>` element.

---

## Priority-Ordered Recommendations for Engineering

| Priority | Change | Semver | Effort |
|----------|--------|--------|--------|
| P1 | Improve segment editor: add/remove list UI (all sports) | MINOR | Medium |
| P2 | GitHub Pages deploy workflow (`.github/workflows/deploy.yml`) | MINOR | Low |
| P3 | Add `scripts/serve-local.sh` for local dev | PATCH | Low |
| P4 | Settings modal: collapse Rosters/Data sections with `<details>` | PATCH | Low |
| P5 | Action button customization for custom sport | MINOR | High — defer |

---

## Segment Editor Spec (P1)

Current: `<input type="text" id="custom-segments" value="Q1, Q2, Q3, Q4, OT">`

Proposed:
```html
<div id="segment-editor-list">
  <!-- one row per segment -->
  <div class="segment-row">
    <input type="text" class="segment-name-input" value="Q1">
    <button class="segment-remove-btn">×</button>
  </div>
  ...
</div>
<button id="add-segment-btn">+ Add Period</button>
```

Logic in `_renderSegmentEditor()`:
- For custom sport: render editable list, read back on save
- For preset sport: show read-only pills + "Customize for this game" toggle that switches to editable list while keeping `gameState.sport` as the preset (not 'custom')

State: `gameState.customSegments` holds any override; preset-sport segments are loaded from `SPORT_PRESETS[sport].segments` when customSegments is absent.

---

## GitHub Pages Deploy Spec (P2)

File: `.github/workflows/deploy.yml`

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - id: deployment
        uses: actions/deploy-pages@v4
```

This requires enabling GitHub Pages in repo settings (source: GitHub Actions). Zero build step — uploads the whole repo as static files. The `?v=11` cache-buster in `style.css` link already handles cache invalidation.

---

## What Is NOT Needed

- Dedicated "sport config screen" as a separate route/page — the Settings modal pattern is correct for a single-page app; it just needs better organization
- Server-side anything — the static file constraint must hold
- Test additions for UI-only changes — existing 59 tests cover the core logic; new tests only needed if JS logic changes (segment editor save/read)

---

## Files Engineering Will Touch

- `index.html` — segment editor DOM, optional `<details>` collapse, GitHub Pages meta
- `js/app.js` — `_renderSegmentEditor()` rewrite, new save logic for per-game segment overrides on preset sports
- `css/style.css` — segment editor rows, add/remove button styles
- `.github/workflows/deploy.yml` — new file
- `scripts/serve-local.sh` — new file (trivial)
- `history.md` — update after Engineering ships

---

## Risk Flags

- **Merge conflict history**: 8+ merge conflicts on `agent/8` branch. Engineering must work on a clean branch from current `main` (`3e3ab60`). The worktree at `/Users/justintormey/.half-bakery/worktrees/CougarCast-8/` should be clean — verify with `git status` before committing.
- **Segment editor state**: When a preset sport is "customized for this game," the save logic must NOT change `gameState.sport` to `'custom'` — it must keep the original sport key and set `gameState.customSegments`. The existing `_activeSegments()` already handles this correctly; just wire the new UI to it.

---

---

# CURRENT ACCURATE ANALYSIS — 2026-04-17 (Supersedes above)

## Executive Summary

Issue #8 is **~92% complete**. Prior research docs (both versions) contained stale findings — they described gaps that are now implemented. After full code audit against `main` HEAD (`fb708ef`), exactly **one functional gap** remains: the "Custom" sport has no action editor. Everything else in the issue epic is shipped.

---

## What the Prior Research Got Wrong

| Prior Claim | Actual Code State |
|---|---|
| "Custom segments = comma-separated text input (poor UX)" | FALSE. `_renderSegmentEditor()` renders individual named rows with add/remove/rename controls |
| "No period-end auto-load score" | FALSE. `changePeriod()` calls `generateScoreReport()` + `_pulseAudioBar()` on forward advance |
| "Segment editor only for Custom sport" | FALSE. Editor renders for ALL sports — edits override `gameState.customSegments` |
| "No sport badge" | FALSE. `#sport-badge` in header, `renderSportBadge()` on every `renderGame()` |

---

## True Requirement Audit (2026-04-17)

| Requirement | Status | Code Location |
|---|---|---|
| 7 sport presets | ✅ Done | `SPORT_PRESETS` in `app.js` L13-122 |
| Sport configuration screen (Settings modal) | ✅ Done | Settings modal → Sport Configuration section |
| Period strip with ◀▶ navigation | ✅ Done | `renderPeriodStrip()`, `setupPeriodControls()` |
| Editable segment editor (individual rows, add/remove) | ✅ Done | `_renderSegmentEditor()` L374-406 |
| Auto-load score on period advance | ✅ Done | `changePeriod()` L215-218 |
| Manual score report (📣 button) | ✅ Done | `#score-report-btn` → `generateScoreReport()` |
| Final vs. mid-game score differentiation | ✅ Done | `isFinal` check in `generateScoreReport()` |
| Sport badge in header | ✅ Done | `#sport-badge` + `renderSportBadge()` |
| UI modernization (period strip, music tab, score bar) | ✅ Done | Issue #2 |
| Music cues (goal horn, timeout, walkup) | ✅ Done | `MusicManager`, `AudioStorage` |
| **Custom sport action editor** | ❌ **MISSING** | `updateActionButtons()` reads hardcoded preset only |
| Deployment documentation / demo site | ❌ Missing (low priority) | No docs; CloudFront ID exists in `.local/` |

---

## The One Remaining Gap: Custom Sport Action Editor

### Problem

When `sport === 'custom'`, the action bar is locked to 5 hardcoded buttons defined in `SPORT_PRESETS.custom.actions`. Users can define period names via the segment editor but cannot change what action buttons appear. There is no way to:
- Rename action buttons (e.g., "FREE THROW" instead of "GOAL")
- Add sport-specific buttons (e.g., "CORNER KICK", "STRIKE")
- Set point values per action
- Change button colors

The segment editor gives full period customization. The action editor is completely absent.

### Root Cause in Code

`updateActionButtons()` (`app.js` L616-628):
```js
updateActionButtons() {
  const sport = this.gameState.sport || 'lacrosse';
  const preset = SPORT_PRESETS[sport] || SPORT_PRESETS.lacrosse;  // ← always uses preset
  const actionBar = document.querySelector('.action-bar');
  actionBar.innerHTML = preset.actions.map(a => { /* ... */ }).join('');
  this.sequenceBuilder.bindActionButtons();
}
```

No `_activeActions()` method exists. `gameState.customActions` does not exist.

### Recommended Implementation

**Pattern:** Mirror `_activeSegments()` / `_renderSegmentEditor()` exactly — the pattern is proven and already tested in use.

#### Step 1: Add `_activeActions()` to `app.js`
```js
_activeActions() {
  const sport = this.gameState.sport || 'lacrosse';
  if (this.gameState.customActions?.length) return this.gameState.customActions;
  return SPORT_PRESETS[sport]?.actions || SPORT_PRESETS.lacrosse.actions;
}
```

#### Step 2: Update `updateActionButtons()` to use `_activeActions()`
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

#### Step 3: Extend `_renderSegmentEditor()` to show action editor when `sport === 'custom'`

Append an action editor section after the segment rows. Each action row:
- Text input for `label`
- Color `<input type="color">` for `color`
- Number input for `points` (0 = non-scoring action)
- Delete row button
- "Add Action" button at bottom

State shape for `gameState.customActions[]`:
```js
[
  { id: 'goal',    label: 'GOAL',    color: '#2e7d32', points: 1 },
  { id: 'timeout', label: 'TIMEOUT', color: '#37474f', points: 0 },
  ...
]
```

⚠️ **Key ID semantics** (document in UI hint): Actions with `id` starting with `goal` (`goal`, `goal1`, `goal2`, `goal3`) trigger score increment in `SequenceBuilder`. Actions with `id: 'timeout'` trigger timeout music cue. The `CUSTOM` action (`id: 'custom'`) triggers a text input prompt. These behaviors are wired in `SequenceBuilder.interpret()` and work automatically if custom actions reuse these IDs.

#### Step 4: Add `_bindActionEditorEvents()` and `_saveActionsFromEditor()`

Follow the exact pattern of `_bindSegmentEditorEvents()` / `_saveSegmentsFromEditor()`:
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

#### Step 5: Clear `customActions` on sport switch away from `'custom'`

In the `#sport-preset` change listener (`setupSettings()` around L339-344), add:
```js
if (sport !== 'custom') {
  delete this.gameState.customActions;
}
```

---

## Files to Change

| File | Change |
|---|---|
| `js/app.js` | Add `_activeActions()`, update `updateActionButtons()`, extend `_renderSegmentEditor()` for action editor, add `_bindActionEditorEvents()` + `_saveActionsFromEditor()`, clear `customActions` on sport switch |
| `css/style.css` | Action editor row styles (~8-12 new rules, reuse `.player-edit-row` pattern) |
| `index.html` | No changes — action editor renders into existing `#segment-editor` container |
| `js/storage.js` | No changes — `customActions` auto-survives round-trip via `saveGame(gameState)` |

**Tests:** No changes needed — the core `TextGenerator` and `Storage` logic is unaffected. `App` class is not unit-tested. Existing 59 tests should pass unchanged.

**Estimated effort:** Medium — 3-4 hours.

---

## Secondary: Deployment Documentation (Low Priority)

The `.local/deploy.json` (gitignored) in the production instance contains:
```json
{"aws_profile": "default", "cloudfront_id": "E1R27W2LA6BBEH"}
```

The deployer.py is in `~/Documents/PROJECTS/half-bakery/scripts/`. The demo site `demo.justintormey.com/cougarcast/` is not live.

**Recommendation:** Add `docs/deploy.md` with the S3 + CloudFront deployment pattern and a `.local/deploy-config.example.json` template. Actual DNS + S3 setup is manual/infrastructure work outside this repo.

Alternatively, consider a GitHub Pages deploy action (`.github/workflows/deploy.yml`) for a zero-infra demo — the site is pure static HTML/CSS/JS with no build step, so GitHub Pages works natively.

**Semver:** PATCH

---

## Architecture Notes (No Changes Required to Core)

- `_activeSegments()` already handles custom override pattern — `_activeActions()` is identical
- `SequenceBuilder.interpret()` is sport-agnostic by action ID — custom actions reusing standard IDs work automatically
- `gameState` is stored as-is via `localStorage` — new `customActions` field requires zero storage.js changes
- Zero-dependency constraint holds — all changes are vanilla ES modules

---

## Warning for Engineering Agent

**Eight prior merge attempts on `agent/8` failed.** The branch is currently at `main` HEAD (`fb708ef`). Engineering must:
1. Work on `agent/8` branch only — do NOT commit to `main`
2. Verify `git status` is clean before starting
3. Let the dispatcher handle the merge after QA approval
