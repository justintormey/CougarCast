# Changelog

All notable changes to CougarCast are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [0.2.0] — 2026-04-14

### Added
- Local deployment via Half Bakery `deployer.py` — replaces GitHub Actions
- `.local/` directory pattern for PII (rosters) and deploy config (gitignored)
- Game file generator script for creating opponent matchups

### Changed
- Deployment moved from GitHub Actions to Half Bakery local deployer
- Demo URL changed from `/mike2/` to `/cougarcast/`
- CougarCast-Monty repo archived — single repo for all code

---

## [0.1.0] — 2026-04-13

### Added
- Period strip with back/forward navigation chips and score-report button
- Music cues tab: goal horn, timeout music, and per-player walkup songs
- `audio-storage.js` — IndexedDB wrapper for music blob storage (too large for localStorage)
- `music-manager.js` — Music cue UI + playback; all cues routed to right/PA channel via Web Audio
- Auto score reporting: generates period-score text loaded into audio bar for operator-controlled playback
- `generatePeriodScore()` in TextGenerator for half-named period score announcements
- Custom sport segment editor in Settings (overrides preset segment list)
- Vitest test suite — 53 tests across TextGenerator, Storage, and RosterManager modules
- `history.md` project history document

### Fixed
- `periodScore` template index 2 hardcoded "leads" instead of a dynamic verb, producing incorrect "Lions leads 2 to 2" on tied scores (issue #6)
- Two `halftimeScore` participial templates used `{homeVerb}` in a participial context, producing grammatically broken "with the Lions are tied 2 to 2"; replaced with `{homeVerbParticiple}` (issue #6)
- Walkup music now stops on every PLAY press (previously only stopped on goal horn or timeout; issue #5)
- Tied-score announcement templates incorrectly said "leading" or "wins" (issue #4)
- Five moderate CVEs resolved by upgrading Vitest 2 → 3 (issue #3)

### Changed
- Project renamed from AIAnnounceR to CougarCast; all in-code references updated
- Sport configuration (`SPORT_PRESETS`) lives in `app.js` as a plain object (7 sports)
- Music stored in IndexedDB, independent of localStorage game state
- Period is 1-indexed (`gameState.period`); custom segments override preset per sport

### Architecture
- Zero-dependency vanilla ES Modules — no framework, no build step, no bundler
- Stereo channel separation: left = operator preview headphones, right = PA broadcast
- Template pools (3–6 per event) with recency avoidance — no LLM call per play
- Pluggable TTS interface (`tts-provider.js`) with ElevenLabs as the sole current implementation
- All state in `localStorage`; JSON import/export for device-to-device transfer

---

## [0.0.1] — initial

### Added
- Initial open-source release
- Core announcing engine with template-based text generation
- ElevenLabs TTS integration
- Web Audio API stereo panning for preview vs. PA routing
- localStorage persistence with JSON import/export
- Sport presets for 7 sports (lacrosse, basketball, football, soccer, hockey, baseball, softball)

[Unreleased]: https://github.com/justintormey/CougarCast/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/justintormey/CougarCast/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/justintormey/CougarCast/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/justintormey/CougarCast/releases/tag/v0.0.1
