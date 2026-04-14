# CougarCast — Project History

## Project Overview

AI-powered live sports announcing system. The operator taps a player and an action on a tablet; the system generates a varied natural-language announcement, converts it to speech via ElevenLabs, and routes audio to the PA system through stereo channel separation. Originally built for high school lacrosse but ships with presets for 7 sports.

Public open-source reference project at `~/Documents/PROJECTS/CougarCast`.  
Personal team-specific instance: `~/Documents/PROJECTS/CougarCast-Monty` (CougarCast, with real roster data — keep out of public repo).

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
- Live demo at `demo.justintormey.com/cougarcast/`

### Future Enhancements
- Native iOS app — better offline support, native audio routing
- Native iOS app — better offline support, native audio routing
- Claude API integration — context-aware commentary replacing templates
- Two-device mode — controller tablet + dedicated PA player
- Voice cloning — clone the retiring announcer's voice (with permission)
- Live demo at `demo.justintormey.com/cougarcast/`

---

## Important Notes

- **Roster data**: Never commit `CougarCast-Monty` roster data (real players, minors) to the public repo.
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
