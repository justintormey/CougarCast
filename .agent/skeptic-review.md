# Skeptic Review — Issue #10 (Music Cues System — Atmosphere Loop)
**Date:** 2026-04-17  
**Stage:** Research output verification  
**Commit reviewed:** 42e5da0

---

## Verification Results

### Claim 1: "Goal horn, timeout, walkup already ship — atmosphere is the only gap" — CONFIRMED

Direct code audit:
- `MusicManager.playGoalHorn()` at `js/music-manager.js:35` — confirmed exists
- `MusicManager.playTimeout()` at `js/music-manager.js:41` — confirmed exists
- `MusicManager.playWalkup(team, number)` at `js/music-manager.js:47` — confirmed exists
- `CUE_KEYS` in `js/audio-storage.js` has `goalHorn`, `timeout`, `walkup` — no `atmosphere` key
- No `_atmosphereAudio`, `startAtmosphere`, `stopAtmosphere`, `_playAtmosphereBlob` anywhere in codebase

**Atmosphere is not implemented. Research claim is accurate.**

### Claim 2: "A second independent audio track is required because _playBlob() calls stopMusic() first" — CONFIRMED

`js/music-manager.js:70-71`:
```js
async _playBlob(blob, loop = false) {
  this.stopMusic();
```
And `stopMusic()` at lines 53-57 kills `_activeAudio`. Every event-triggered cue goes through `_playBlob()`. Any atmosphere loop placed in `_activeAudio` would be killed on every goal, timeout, and walkup — unusable.

**Architecture requirement (separate `_atmosphereAudio`) is correctly derived.**

### Claim 3: "Stop All Music button only calls stopMusic() — needs stopAtmosphere() added" — CONFIRMED

`js/music-manager.js:320`:
```js
newBtn.addEventListener('click', () => this.stopMusic());
```
Only one call. Research correctly flags this needs `stopAtmosphere()` added alongside.

### Claim 4: "Atmosphere should route to right (PA) channel via StereoPanner at reduced gain" — CONFIRMED AGAINST PATTERN

Existing PA cues (`_playBlob`):
```js
const gain = ctx.createGain();
gain.gain.value = 1.0;
const panner = ctx.createStereoPanner();
panner.pan.value = 1; // right = PA channel
```
Research spec matches exactly, with `gain.gain.value = 0.4` (reduced for background level) and `panner.pan.value = 1`.

### Claim 5: "MediaElementSource quirk — must create fresh Audio on every start" — CONFIRMED AGAINST PATTERN

`_playBlob()` at lines 73-88 creates `new Audio(url)` every call after `stopMusic()`. Research correctly calls this out as a required pattern for atmosphere too (can't reuse the same `<Audio>` element after a `ctx.createMediaElementSource()` call).

### Claim 6: "Files Engineering will touch: audio-storage.js, music-manager.js, css/style.css" — VERIFIED ACCURATE

No other files need changes. `app.js`, `sequence-builder.js`, `index.html` are not affected (music tab renders dynamically from `MusicManager.render()`). Storage pattern (IndexedDB via AudioStorage) requires only a new key string — no schema migration.

---

## Research Quality Assessment

Research is solid and engineering-ready:
- All four existing cues verified against actual code (not assumptions)
- Single remaining gap correctly identified with technical justification
- Architecture spec matches established Web Audio patterns already in the codebase
- Risk flags (MediaElementSource quirk, iOS autoplay, concurrent nodes) are real and relevant
- Implementation code samples directly mirror existing `_playBlob()` pattern
- Interaction matrix is correct — `stopMusic()` must NOT kill atmosphere; only the toggle and "Stop All" should

No hallucinations. No scope inflation. No missing gaps.

---

## Verdict: APPROVE — Route to Engineering

---

# Skeptic Review — Issue #8 (Multi-sport + Config Screen)
**Date:** 2026-04-17  
**Stage:** Research output verification  
**Commit reviewed:** eba6352

---

## Verification Results

### Claim 1: "Segment editor renders individual rows with add/remove" — CONFIRMED
`_renderSegmentEditor()` at `js/app.js:374-406` renders `.segment-edit-row` divs with `segment-name-input` and `segment-remove-btn`. Not a comma-separated input. V2 research correctly overwrote the stale V1 claim.

### Claim 2: "changePeriod() auto-loads score on advance" — CONFIRMED
`js/app.js:206-217`: `changePeriod()` calls `this.generateScoreReport()` at line 216 on forward advance.

### Claim 3: "Segment editor works for ALL sports, not just custom" — CONFIRMED
`_renderSegmentEditor()` has no sport-conditional gating on the editor rows. The `isCustomSport` flag is used only for the reset button visibility.

### Claim 4: "sport-badge and renderSportBadge() exist" — CONFIRMED
`index.html:21`: `<span id="sport-badge" ...>Lacrosse</span>`
`js/app.js:630`: `renderSportBadge()` method present, called at line 641.

### Claim 5: "updateActionButtons() has no _activeActions() — hardcoded to preset" — CONFIRMED
`js/app.js:616-628`: Uses `SPORT_PRESETS[sport]` directly. No `customActions` field, no `_activeActions()` method. grep confirms zero occurrences of either.

### Claim 6: "customActions doesn't exist in gameState" — CONFIRMED
Zero occurrences of `customActions` in entire codebase.

---

## Research Quality Assessment

The V2 analysis is solid:
- Corrected 4 false claims from prior research with exact code citations
- Identified the single remaining gap (custom action editor) correctly
- Provided engineering-ready implementation spec mirroring existing `_activeSegments()` pattern
- Listed exact files, line numbers, risk flags (merge conflicts, action ID semantics)
- Provided code for all 5 implementation steps

No hallucinations detected. No scope inflation. The "92% complete" framing is accurate.

---

## Verdict: APPROVE — Route to Engineering
