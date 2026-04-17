# CougarCast — Project History

## Project Overview

AI-powered live sports announcing system. The operator taps a player and an action on a tablet; the system generates a varied natural-language announcement, converts it to speech via ElevenLabs, and routes audio to the PA system through stereo channel separation. Originally built for high school lacrosse but ships with presets for 7 sports.

Public open-source reference project at `~/Documents/PROJECTS/CougarCast`.  
Team-specific roster data and deploy config live in `.local/` (gitignored, never committed).

---

## Key Context & Decisions

### Architecture: Zero-dependency Vanilla ES Modules
**Decision:** No framework, no build step, no bundler. Pure HTML/CSS/JS with `type="module"` imports.  
**Rationale:** The app is deployed by opening `index.html` directly in a browser (or serving from a static file server). Coaches and school staff don't run `npm install`. A single git clone → open in browser is the deployment story. This constraint drives everything.

### Stereo Channel Separation for Booth Monitoring
**Decision:** Left channel = preview (operator headphones), right channel = PA broadcast. Implemented via Web Audio API `StereoPannerNode` (pan `-1` for left, `+1` for right).  
**Rationale:** Zero additional hardware — just a stereo Y-splitter cable (~$5). One device handles both monitor mix and broadcast without any mixing board.

### Template Pools with Recency Avoidance
**Decision:** Text generation uses per-event pools of 3–6 templates. The last 3 used indexes are tracked and excluded from the next draw. Hype vs. neutral tone is controlled by a per-team `energy` setting (`high` / `neutral`).  
**Rationale:** Real announcers never say the same thing twice. Template pools avoid repetition without an LLM call on every event (latency would kill live use). The `pronounce` override per player means ElevenLabs gets phonetic spellings while the UI shows real names.

### TTS Provider Interface
**Decision:** `tts-provider.js` defines a minimal interface; `tts-elevenlabs.js` is the only current implementation. Audio returned as `AudioBuffer`.  
**Rationale:** Keeps the door open for other TTS providers (browser native, Whisper, etc.) without rewriting call sites.

### localStorage Persistence + JSON Import/Export
**Decision:** All state in `localStorage`. Import/Export as JSON for backup and device-to-device transfer.  
**Rationale:** No server, no accounts, no sync infra. Fits the zero-setup deployment model. Works offline at a field with no internet.

### Announcements: Flat Ordered List (not per-event queue)
**Decision:** The Announcements tab is a flat manually-ordered list. Pre-rendering generates audio ahead of time. Dynamic items regenerate score text on every play.  
**Rationale:** Pre-game, sponsor, and post-game reads happen on the operator's schedule, not triggered by game events. A queue tied to game events would fight real announcers who improvise.

### Sport Presets in `app.js`
**Decision:** Sport configuration (`SPORT_PRESETS`) lives in `app.js` as a plain object, not in a separate config file.  
**Rationale:** Current size (7 sports) fits comfortably inline. If sport count grows significantly, extract to `sports.js`.

---

## Current Status

🟡 **active** — functional MVP. Public reference project. Personal instance (Monty) used at actual lacrosse games.

---

## Unfinished Work

### Immediate Next Steps
- Live demo at `demo.justintormey.com/cougarcast/` — no GitHub Pages or deploy script set up yet; deployment is manual via Half Bakery deployer + CloudFront config in `.local/`
- Add `escHtml()` utility and apply to all user-data innerHTML renders (action labels, period chips, roster fields) — self-XSS in current local-only deployment, but should be fixed before any hosted/multi-user version (see QA issue #8 finding M1)
- Add `textColor` input to custom action editor rows — operators cannot currently set dark-text buttons (e.g., yellow button + black text); preset actions like YELLOW CARD use `textColor: '#000'` but the custom editor defaults to white

### Future Enhancements
- Action editor for preset sports (currently only available for Custom sport type) — operators on e.g. Football who want to add a "SAFETY" button must switch to Custom and lose preset segment defaults
- Native iOS app — better offline support, native audio routing
- Claude API integration — context-aware commentary replacing templates
- Two-device mode — controller tablet + dedicated PA player
- Voice cloning — clone the retiring announcer's voice (with permission)

---

## Important Notes

- **Roster data**: Real player names live in `.local/scripts/generate-game.py` (gitignored). The committed version uses sample names only.
- **API key**: ElevenLabs key stored in `localStorage`, never sent to any server except ElevenLabs directly.
- **Deployment**: `index.html` served as a static file — no server-side code anywhere in the stack.

---

## Technical Details

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla HTML/CSS/JS (ES Modules, no bundler) |
| TTS | ElevenLabs API (`tts-elevenlabs.js`); pluggable via `tts-provider.js` |
| Text Generation | `TextGenerator` — template pools with recency avoidance |
| Audio Routing | Web Audio API (`StereoPannerNode`) |
| Storage | `localStorage` + JSON import/export |
| Testing | Vitest (ESM-native, Node) — `npm test` |

### Module Map
- `app.js` — app init, sport presets, settings, import/export, game render
- `announcements.js` — Announcements tab: ordered list, pre-render, preview/play
- `text-generator.js` — template-based text generation (core logic; fully unit-tested)
- `storage.js` — localStorage read/write (fully unit-tested)
- `roster.js` — roster rendering + player lookup (utility methods unit-tested)
- `sequence-builder.js` — player-tap + action-tap → announcement composition flow
- `audio-manager.js` — Web Audio API wrapper; stereo panning for preview vs. PA
- `tts-provider.js` — TTS provider interface definition
- `tts-elevenlabs.js` — ElevenLabs TTS implementation

### Scripts
- `scripts/scrape-roster.py` — scrape team roster data from web sources
- `scripts/generate-game.py` — generate sample game JSON for testing

---

## Session Log

### 2026-04-17 — Issue #8: Docs — CHANGELOG and history sync

**Work:** Documented all issue #8 deliverables. Updated `CHANGELOG.md` [Unreleased] section (was empty — QA flagged as L1). Fixed stale/duplicate lines in Unfinished Work. Added actionable follow-up items from QA findings M1, L2, L4.

**Files changed:**
- `CHANGELOG.md` — Added [Unreleased] entries for custom action editor, editable segment editor, auto-period-score, sport badge
- `history.md` — Removed duplicate "Native iOS" and stale "Live demo" lines from Future Enhancements; added three actionable next steps from QA findings M1/L2/L4

**Status:** Issue #8 epic is fully complete. All features shipped across issues #2 (2026-04-13) and #8 (2026-04-17). 59/59 tests pass.

**QA findings documented as next steps (non-blocking, from QA report on commit 68652b4):**
- M1: `escHtml()` utility — self-XSS in innerHTML for action labels, period chips, roster fields
- L2: `textColor` field missing from custom action editor rows
- L4: Action editor only for Custom sport — preset sports cannot customize actions

---

### 2026-04-17 — Issue #8: Custom sport action editor

**Work:** Added full action button customization for the Custom sport type.

**Modified Files:**
- `js/app.js` — Added `_activeActions()` (mirrors `_activeSegments()` pattern), updated `updateActionButtons()` to use `_activeActions()`, extended `_renderSegmentEditor()` to append action editor HTML when `sport === 'custom'`, added `_buildActionEditorHtml()`, `_bindActionEditorEvents()`, `_saveActionsFromEditor()`. Sport-preset change listener now deletes `customActions` when switching away from custom.
- `css/style.css` — Added `.action-editor-section`, `.action-edit-list`, `.action-edit-row`, `.action-label-input`, `.action-id-input`, `.action-color-input`, `.action-points-input` styles.

**Architecture:**
- Mirrors `_activeSegments()` / `_renderSegmentEditor()` pattern exactly — proven, consistent.
- `gameState.customActions[]` auto-persists through existing `saveGame()` call in `saveSettings()`.
- Action IDs drive `SequenceBuilder.interpret()` behavior — reusing `goal`, `timeout`, `custom` IDs gives custom actions the same event behaviors (score increment, timeout music, text prompt) with zero changes to the sequence layer.
- All 59 tests pass.

### 2026-04-15 — Issue #8: Multi-sport config screen + enhanced score reporting

**Work:** Editable segment editor for all sports, auto-score on period advance, sport badge.

**Modified Files:**
- `js/app.js` — Replaced `_renderSegmentEditor()` with a fully editable list (add/remove/rename any period for any sport). Added `_bindSegmentEditorEvents()` and `_saveSegmentsFromEditor()` helpers. `changePeriod()` now auto-generates a period score announcement before advancing. `renderSportBadge()` updates the header badge. `_pulseAudioBar()` pulses the audio bar to draw operator attention after auto-populate.
- `index.html` — Added `#sport-badge` span in header right slot; version bumped to v0.2.0; CSS cache-bust to v=12.
- `css/style.css` — Added: `.sport-badge` (header pill showing active sport), `.segment-editor-header`, `.segment-edit-list/.row`, `.segment-name-input`, `.segment-remove-btn`, `.segment-add-btn`, `.segment-reset-btn`, `@keyframes pulse-hint` + `.audio-bar.pulse-hint`.

**Architecture:**
- Segment editing is non-destructive: editing a preset sport's periods stores to `gameState.customSegments`. `_activeSegments()` already checks this first, so period strip and score reports automatically use the custom values. "Reset to defaults" deletes `customSegments` entirely.
- Auto-score-on-advance reuses the existing `generateScoreReport()` method; it reads `this.gameState.period` before the period is incremented, giving the correct "just-ended" period name. No duplication.
- All 59 tests pass.

### 2026-04-14 — Issue #4 QA: halftimeScore / finalScore tied-score templates

**QA review result: PASS — all fixes correct, all 59 tests pass.**

Engineering fixed the root cause (hardcoded `leading` in `halftimeScore` template 3, wrong `wins` phrasing in `finalScore` tied-game path). During QA review, a grammar regression was identified: the engineering fix used `{homeVerb}` ('are tied') in a participial-phrase slot; this was corrected to `{homeVerbParticiple}` ('tied') as part of issue #6 before QA completed. Net state: all templates grammatically correct, tied-score assertions cover both `generateHalftimeScore` and `generateFinalScore`, no regressions.

### 2026-04-14 — Issue #6: periodScore template hardcoded 'leads' in tied-score position
**Bug:** `periodScore` template index 2 hardcoded `leads`, producing *"End of 1st Quarter. Lions leads 2 to 2."* when scores were equal. Same bug class as issue #4 (halftimeScore tied-score fix). Additionally, two `halftimeScore` templates used `{homeVerb}` in a participial-phrase context, producing the grammatically broken *"We've reached halftime with the Lions are tied 2 to 2."*

**Fix:**
- Replaced `leads` with `{homeVerb}` in `periodScore` template index 2.
- Added `homeVerbParticiple` field (`'leading'`/`'trailing'`/`'tied'`) in both `generatePeriodScore` and `generateHalftimeScore`.
- Updated two `halftimeScore` participial templates to use `{homeVerbParticiple}` instead of `{homeVerb}`.
- Added 6 new `generatePeriodScore` tests covering tied-score output, halftime routing, and the grammatical regression — 59 total tests, all passing.

### 2026-04-14 — Issue #5: Walkup music stops on all PLAY presses
**Bug:** Walkup music only stopped when replaced by goal horn or timeout (both call `_playBlob()` → `stopMusic()`). Non-scoring plays (penalty, infraction, custom) fired no music callback, so walkup looped indefinitely after PLAY.

**Fix:**
- Added `onPlayFired` callback to `SequenceBuilder` (fires unconditionally before `_triggerMusicCue` in `play()`).
- Wired in `app.js`: `sequenceBuilder.onPlayFired = () => musicManager.stopMusic()`.
- Removed stale comment that incorrectly claimed this was already handled.
- All 53 tests pass.

### 2026-04-13 — Issue #2: UI Modernization + Multi-Sport Support
**Work:** Added period strip, music cues (goal horn, timeout, walkup), auto score reporting, sport config enhancements.

**New Files:**
- `js/audio-storage.js` — IndexedDB wrapper for music blob storage (blobs too large for localStorage).
- `js/music-manager.js` — Music cue UI (Music tab) + playback (goal horn, timeout, per-player walkup). All cues route to right/PA channel via shared Web Audio context.

**Modified Files:**
- `js/app.js` — Period tracking (`changePeriod`, `renderPeriodStrip`), score report button (`generateScoreReport`), MusicManager init + wiring, `_syncManagers()` helper, custom segments support, version bump to v0.1.0.
- `js/sequence-builder.js` — Added `onGoalScored` / `onTimeoutCalled` callbacks; saved `lastInterpretation` before chip clear so music cues trigger correctly after play.
- `js/text-generator.js` — Added `periodScore` template pool + `generatePeriodScore(periodName, ...)` method reusing `halftimeScore` templates for half-named periods.
- `index.html` — Period strip (◀ chips ▶ + 📣 score-report), Music tab, sport `segment-editor` container in Settings.
- `css/style.css` — Period strip, period chips, score-report button, Music tab cards, walkup rows, stop-music button animation, segment preview pills.

**Architecture:**
- Music stored in IndexedDB (AudioStorage class), independent of localStorage game state.
- Music routed through `createMediaElementSource` → StereoPannerNode (pan=+1, right=PA) for consistent channel separation.
- Period is 1-indexed (`gameState.period`); `_activeSegments()` returns custom or preset segment array.
- Custom sport: `gameState.customSegments[]` overrides preset; cleared when switching back to a preset.
- Score report loads text into the audio bar rather than auto-playing — operator controls when it airs.

### 2026-04-13 — Issue #1: Testing + Documentation
**Work:** Added Vitest test suite and project history.
- Added `package.json` with Vitest as the only dev dependency (`type: "module"` for ESM).
- `tests/text-generator.test.js` — 27 tests covering `fillTemplate`, `pronounceName`, `displayName`, `generate` (recency avoidance), `generateGoal` (energy levels + pronunciation), `generateTimeout`, `generatePenalty`, `generateHalftimeScore`, `generateFinalScore`, `expandPlayerReferences`.
- `tests/storage.test.js` — 14 tests covering `loadGame` (first run, persist, restore, corrupted JSON fallback), `saveGame`, API key and voice ID lifecycle, `clear`.
- `tests/roster-manager.test.js` — 10 tests covering `getPlayerByNumber` (home/away, not found, coercion, same number different team), `getTeamName` (mascot fallback chain), `setGameState`.
- All 51 tests passing.
- Added this `history.md`.
