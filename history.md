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

### Immediate Next Steps (from open issues)
- Live demo at `demo.justintormey.com/cougarcast/` — no GitHub Pages or deploy script set up yet; deployment is manual via Half Bakery deployer + CloudFront config in `.local/`
- ~~Add `escHtml()` utility~~ — done in issue #11; app.js sites escaped; 3 sibling-module sites remain (see issue #14)
- ~~`music-manager.js` walkup innerHTML sites escaped~~ — done in issue #17; `js/utils.js` created with exported `escHtml()`; player name, jersey number, home/away team mascot/name all wrapped
- Export `escHtml()` to shared `utils.js` (✓ created by #17) and patch remaining unescaped innerHTML sites in `roster.js` (player display), `sequence-builder.js` (chip labels), `announcements.js` (item titles) — issue #14; `app.js` can also switch to importing from `utils.js` instead of its local copy
- ~~Add `textColor` input to custom action editor rows~~ — done in issue #12; "Dark text" checkbox added to all action editor rows (both existing and newly-added); `_saveActionsFromEditor()` writes `textColor: '#000'` or `'white'`; existing rows pre-populate checked state from saved `textColor`
- Panner node cleanup (low priority): store `_atmospherePanner`, `_activePanner`, `_previewPanner` references and call `.disconnect()` in `stopAtmosphere()`, `stopMusic()`, and `_previewBlob()` teardown paths — accumulates orphaned nodes in the Web Audio graph over many start/stop cycles; bounded by session duration, no data loss (QA finding L2 from issue #10)

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

### 2026-04-18 — Issue #17: Expand escHtml() coverage to music-manager.js

**Work:** Created shared `js/utils.js` exporting `escHtml()`. Applied it to the 4 unescaped innerHTML sites in `music-manager.js` walkup section: player first/last name, jersey number display, home team mascot/name, away team mascot/name.

**Files changed:**
- `js/utils.js` — New file; exports `escHtml()` as the canonical shared HTML-escaping utility (identical implementation to the local function in `app.js`).
- `js/music-manager.js` — Added `import { escHtml } from './utils.js'`; wrapped `#${p.number}`, `${name}`, `${home?.mascot||home?.name||'Home'}`, `${away?.mascot||away?.name||'Away'}` in `escHtml()` calls inside `_renderWalkupSection()`.
- `history.md` — Marked issue #17 complete in Unfinished Work; updated issue #14 note to reflect utils.js now exists.

**Architecture:**
- `utils.js` is the foundation for the broader issue #14 migration. `app.js` still defines `escHtml` locally — issue #14 should switch it to `import { escHtml } from './utils.js'` and patch `roster.js`, `sequence-builder.js`, `announcements.js`.
- `data-number` attribute in walkup rows and `data-cue`/`data-player`/`id` attributes built from `p.number` are used only as DOM keys (bound back via `dataset.player`) so remain unescaped; the actual visible text and team name headers are the user-facing XSS surface.

**Status:** PATCH — no behavior change for well-formed input. 59/59 tests pass.

---

### 2026-04-18 — Issue #12: textColor field in custom action editor

**Work:** Added "Dark text" checkbox to each row in the custom action editor so operators can create dark-text buttons (e.g., yellow button + black text), matching how preset actions like YELLOW CARD already work.

**Files changed:**
- `js/app.js` — Added `<label class="action-dark-text-label">` with checkbox to `_buildActionEditorHtml()` row template (pre-populates `checked` from saved `textColor`); same checkbox added to the "add new row" inline template in `_bindActionEditorEvents()`; `_saveActionsFromEditor()` now captures `textColor: row.querySelector('.action-text-dark-input')?.checked ? '#000' : 'white'`.
- `css/style.css` — Added `.action-dark-text-label` styles (flex, 12px font, secondary text color, whitespace nowrap).
- `CHANGELOG.md` — Documented feature in [Unreleased] Added section.
- `history.md` — Marked issue #12 complete in Unfinished Work; added this session log entry.

**Architecture:**
- Option A (checkbox) from the issue — covers 95% of real-world need (light vs. dark text on colored background). No free-form color picker overhead.
- The existing `input` event listener in `_bindActionEditorEvents()` fires on checkbox `change` too, so live preview in `updateActionButtons()` works without any extra wiring.
- `textColor` in `customActions[]` persists automatically through the existing `saveGame()` call — no new persistence code.

**Status:** 59/59 tests pass. MINOR — additive UI field, no breaking changes.

---

### 2026-04-18 — Issue #9: Auto period-end score announcement

**Work:** Added `autoAnnouncePeriodEnd` feature — when an operator presses the ▶ next-period button, CougarCast now automatically generates a natural-language score summary and sends it directly to ElevenLabs TTS for PA broadcast, in addition to loading the text into the audio bar.

**Files changed:**
- `js/app.js` — Added `_autoPlayPeriodScore(text)` async method; wired it into `changePeriod()` when `gameState.autoAnnouncePeriodEnd` is true; added migration for the new field (defaults to `true`); wired `populateSettings()` and `saveSettings()` to persist the toggle.
- `index.html` — Added "Auto-announce score when period ends" checkbox toggle to the Sport Configuration settings group.
- `CHANGELOG.md` — Documented the feature in [Unreleased] Added section.

**Architecture:**
- `_autoPlayPeriodScore()` is **fire-and-forget async** — it does not block the synchronous period advance or audio-bar update. The period chip advances immediately; audio plays when TTS responds.
- **Progressive degradation**: silently no-ops if API key or voice aren't configured; logs a `console.warn` on TTS failure. Text is always in the audio bar as a fallback for manual ▶ PLAY.
- `gameState.autoAnnouncePeriodEnd` is persisted to localStorage alongside score and period — games run for hours, and this setting survives page reloads.
- Score state (`homeScore`, `awayScore`, `period`) was already fully persisted via `onGameStateChanged()` → `storage.saveGame()` on every change. No new persistence work needed.

**Status:** 59/59 tests pass. MINOR — additive feature, no breaking changes.

---

### 2026-04-18 — Issue #10: Docs — CHANGELOG and history sync

**Work:** Documented atmosphere loop feature completion (the final piece of issue #10). Updated CHANGELOG.md [Unreleased] with the atmosphere loop entry. Updated Unfinished Work in history.md with two QA-derived actionable items: expand issue #14 scope to include music-manager.js walkup innerHTML sites (QA M1), and panner node disconnect cleanup (QA L2, low priority). Music cues system (all four layers: goal horn, timeout, walkup, atmosphere) is fully complete as of commit 7ea6f98.

**Files changed:**
- `CHANGELOG.md` — Added atmosphere loop entry to [Unreleased] Added section
- `history.md` — Expanded issue #14 action item with music-manager.js sites; added panner node cleanup item

**Architecture note:** The atmosphere track runs on a completely independent audio graph from the event-triggered cue track (`_activeAudio` vs. `_atmosphereAudio`). `stopMusic()` — called via `onPlayFired` on every ▶ PLAY press — is intentionally isolated to the cue track. Atmosphere survives through all game events and is only killed by "Stop All Music" or the dedicated "■ Stop" toggle on the Atmosphere card.

**QA findings from commit 91765bb (non-blocking, routed to existing issues):**
- M1: Unescaped player name/number/team name in `music-manager.js` walkup section innerHTML (self-XSS; same class as issue #14 — expand its scope)
- L2: Atmosphere panner node not stored/disconnected in `stopAtmosphere()` — orphaned nodes accumulate over long sessions; low practical risk given bounded session duration

**Status:** Issue #10 fully complete. 59/59 tests pass.

---

### 2026-04-17 — Issue #10: Atmosphere / ambient crowd loop

**Work:** Added atmosphere audio loop to the music cues system — the fourth and final PA layer alongside goal horn, timeout, and walkup.

**Files changed:**
- `js/audio-storage.js` — Added `atmosphere: () => 'atmosphere'` to `CUE_KEYS`.
- `js/music-manager.js` — Added separate `_atmosphereAudio/_atmosphereUrl/_atmosphereSource/_atmosphereGain/_atmosphereVolume` track (independent of `_activeAudio` cue track). Added `playAtmosphere()`, `stopAtmosphere()`, `_renderAtmosphereCard()`, `_bindAtmosphereCard()`, `_updateAtmosphereCard()` methods. Updated `_bindStopButton()` to stop both cue and atmosphere; `_updateStopButton()` now reflects either track being active.
- `css/style.css` — Added `.atmosphere-volume-row`, `.atmosphere-vol-label`, `.atmosphere-vol-slider`, `.atmosphere-vol-value`, `.music-btn.play-atm`, `.music-btn.stop-atm` styles.
- `index.html` — CSS cache-bust v12→v13.

**Architecture:**
- Atmosphere runs on a **separate audio graph** from the event-triggered cue track. `stopMusic()` (called on `onPlayFired`) only kills the cue track — atmosphere keeps looping. `stopAtmosphere()` is a dedicated tear-down path.
- Both tracks share the same Web Audio context → `StereoPannerNode(pan=+1)` for consistent PA-channel routing.
- Volume control via `GainNode` wired to a range slider. Volume updates `gain.value` live while playing without stopping/restarting.
- The "Stop All Music" kill switch calls both `stopMusic()` + `stopAtmosphere()`.
- 59/59 tests pass (no new test targets — atmosphere is UI/audio-hardware layer with no testable pure logic).

### 2026-04-17 — Issue #11: Add escHtml() utility (QA M1)

**Work:** Added `escHtml()` utility and applied it to all user-data innerHTML injection sites.

**Files changed:**
- `js/app.js` — Added `escHtml()` after imports; applied to: period chip innerHTML (`renderPeriodStrip`), action button innerHTML (`updateActionButtons`), roster `<input value=...>` fields (number, firstName, lastName, pronounce), segment editor `<input value=...>`, action editor label/id `<input value=...>`. Replaced all ad-hoc `.replace(/"/g, '&quot;')` calls with `escHtml()`.

**Architecture:** Single utility function at module top level — no external dependency, no build step. Consistent `&amp;` → `&lt;` → `&gt;` → `&quot;` → `&#39;` ordering ensures `&` never double-encodes.

**QA findings (commit 1e1ee8b):** 3 low-severity unescaped innerHTML sites in sibling modules not in issue scope — `roster.js` player display path, `sequence-builder.js` chip labels, `announcements.js` item titles. All self-XSS only. Filed as issue #14 (export `escHtml()` to shared `utils.js` and patch all three).

**Status:** PATCH — no behavior change for well-formed input. 59/59 tests pass.

---

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
