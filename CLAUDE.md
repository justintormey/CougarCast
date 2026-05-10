# CougarCast — Claude Code Brief

**The AI sports announcer that never gets nervous.**

AI-powered live sports announcing system for high school sports. Operator taps a player and action on a tablet; system generates varied natural-language announcements, converts to speech via ElevenLabs TTS, and routes to PA system using stereo channel separation. Originally built for lacrosse, ships with presets for 7 sports.

---

## Product Vision

- **Core use case**: Coach or parent operator with tablet → announces live games without hiring an announcer
- **Audio routing**: Stereo channel separation (left = booth headphones, right = PA broadcast) with one stereo Y-splitter cable
- **Zero friction deployment**: Open `index.html` in a browser. No `npm install`, no build step, no server
- **Team-specific data**: Rosters and deploy config live in `.local/` (gitignored); never committed
- **Game files**: Generated locally via `scripts/generate-game.py`, deployed to S3 via Half Bakery deployer

---

## Tech Stack

- **Frontend**: Vanilla ES Modules (no framework, no bundler)
- **Storage**: `localStorage` only + JSON import/export for backup
- **TTS**: ElevenLabs API (pluggable via `js/tts-provider.js` interface)
- **Audio routing**: Web Audio API (`StereoPannerNode` for stereo channel split)
- **Test runner**: Vitest (see `tests/`)

---

## Project Structure

```
index.html                          # Entry point; served directly
css/style.css                       # All styles (responsive, dark mode)

js/app.js                           # Main app logic, sport presets (SPORT_PRESETS object)
js/announcements.js                 # Announcements tab: flat list, pre-rendering, dynamic scores
js/roster.js                        # Roster editor: teams, players, "Say as..." overrides
js/sequence-builder.js              # Player + Action builder for live announcements
js/audio-manager.js                 # Handles preview (left) / play (right) routing
js/music-manager.js                 # Goal horn, timeout music, walkup songs via IndexedDB
js/audio-storage.js                 # IndexedDB for large audio files (music cues)
js/text-generator.js                # Template pools with recency avoidance, hype vs. neutral
js/storage.js                       # localStorage wrapper, game state persistence
js/tts-provider.js                  # Abstract TTS interface (enables provider swap)
js/tts-elevenlabs.js                # ElevenLabs API client, voice refresh, audio generation
js/utils.js                         # escHtml() and other shared utilities

scripts/generate-game.py            # CLI: generates local game JSON files for testing
tests/                              # Vitest suite (roster-manager, storage, text-generator)
research/                           # Issue audits (e.g., multi-sport config)
```

---

## Current Status

🟡 **active** — Functional MVP. Personal instance used at actual high school lacrosse games. Public reference project.

### Recent Work

- HTML escaping in player name / jersey / team references (issues #11, #14, #17)
- `utils.js` created with exported `escHtml()` utility
- Music manager walkup song routing to Right channel (PA broadcast)

### Blockers / Unfinished

- **Live demo deploy**: `demo.justintormey.com/cougarcast/` not yet wired. Manual S3 + CloudFront via `.local/` config
- **HTML escaping remaining**: 3 sibling-module sites still need `escHtml()` wrapping (see history.md)

---

## Key Decisions & Architecture Notes

### Zero-Dependency Vanilla ES Modules

**Why**: Deployed by opening `index.html` directly. Coaches and school staff don't run `npm install`. Single git clone → open in browser is the deployment story.

**Impact**: No hot reload, no dev server by default. For development, use any static server (e.g., `python3 -m http.server`). Tests run via Vitest; main app has no build step.

### Stereo Channel Separation for Booth Monitoring

**How**: Web Audio API `StereoPannerNode`. Preview button pans left (`-1`), Play button pans right (`+1`). Single device, one stereo Y-splitter cable.

**Files**: `js/audio-manager.js` handles routing. Music cues also pan right. See `audio-manager.js` for stereo context setup.

### Template Pools with Recency Avoidance

**How**: `js/text-generator.js` maintains per-event template pools (3–6 variants each). Tracks last 3 used indexes; excludes them from next draw. Per-team `energy` flag (`high` / `neutral`) controls hype vs. steady tone.

**Why**: Real announcers never repeat. Avoids LLM latency on live events. Player `pronounce` override sends phonetic spelling to ElevenLabs while UI shows real name.

### TTS Provider Interface

**File**: `js/tts-provider.js` defines the minimal interface. `js/tts-elevenlabs.js` is the only current impl. Returns `AudioBuffer`.

**Why**: Future extensibility (browser native, Whisper, etc.) without rewriting call sites.

### Sport Presets in app.js

**Structure**: `SPORT_PRESETS` object in `js/app.js` maps sport name to segments (Q1–Q4, etc.) and actions (Goal, Assist, Card, Timeout, etc.).

**Add a sport**: Edit `SPORT_PRESETS`, add entry with `segments` and `actions` arrays. No external config file needed (current scale: 7 sports, fits inline).

### Announcements: Flat List + Pre-Rendering

**Design**: Announcements tab is a manually-ordered flat list. Pre-rendering generates audio for all items on each refresh. Dynamic items (score reports) regenerate text on every play.

**Why**: Pre-game, sponsor, post-game reads happen on operator's schedule, not game-triggered. Operator decides when to play; real announcers improvise.

### localStorage Only + JSON Export

**Why**: No server, no accounts, no sync infra. Works offline at fields with no internet. JSON export enables backup and device-to-device transfer.

---

## Agent Notes & Pitfalls

### Deployment is S3 + Manual

The live demo (`demo.justintormey.com`) is a S3 bucket + CloudFront distribution. Deploy config lives in `.local/` (gitignored). Half Bakery's `deployer.py` handles the sync. To deploy changes: use the deployer script or sync manually via AWS CLI.

### Test Infrastructure

Tests live in `tests/` and run via Vitest. Coverage includes roster state, storage persistence, and text-generator logic. No UI tests (they're hard without a full test browser). Verify UI changes manually in a real browser before claiming done.

### localStorage Key Namespace

All keys live under a single namespace (see `js/storage.js`). Understand the key structure before adding new state. Migrations happen via version checks in `storage.js`.

### ElevenLabs API Key

Users paste their own key into Settings. App stores it in `localStorage` only (no server). API calls happen client-side. Rate limits and cost tracking are the user's responsibility.

### HTML Escaping

All dynamic text (player names, team names, custom announcements) must be escaped via `escHtml()` before rendering as innerHTML. Check `js/utils.js` and ensure new features wrap user input.

### Audio Routing Edge Cases

Web Audio context requires user interaction to start (security policy). Preview/Play buttons both call `audio-manager.js` setup which handles context creation on first user tap. Understand the context lifecycle before modifying audio playback.

### Stereo Panning Compatibility

Stereo panning works on all browsers with Web Audio support. Test on both iOS Safari and Android Chrome; headphone jack detection is not automatic (user must physically split the cable).

---

## How to Start

1. Open `index.html` in a browser (or `python3 -m http.server 8000` for live reload)
2. Read `history.md` for recent decisions and blockers
3. Check `tests/` to understand state shape before modifying storage
4. Review `SPORT_PRESETS` in `js/app.js` if adding new sports