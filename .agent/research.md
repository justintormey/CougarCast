# Issue #9 — Score Reporting & Automatic Period/Quarter Announcements

## Assignment
Add automatic score announcement generation: when a period ends, generate a natural-language score summary and send it to ElevenLabs TTS. Configurable. Score state persists across reloads.

## Findings

### Pre-existing state (what already worked)
| Feature | Status before this issue |
|---|---|
| Score state (homeScore, awayScore) persisted to localStorage | Done — onGameStateChanged() calls storage.saveGame() on every score change |
| Period state (period) persisted to localStorage | Done — changePeriod() calls storage.saveGame() |
| Score text generated at period end | Done — changePeriod() called generateScoreReport() which used TextGenerator.generatePeriodScore() |
| Score text loaded into audio bar | Done — but operator had to manually press PLAY |

### Gap addressed by this issue
Text was generated and displayed, but **not automatically sent to TTS for PA broadcast**. The operator had to press PLAY after each period advance.

## Implementation

### Key design decisions

**Fire-and-forget async**: `_autoPlayPeriodScore()` is called without await in `changePeriod()`. Period advances synchronously; audio plays when TTS responds (~500ms-2s latency). No UI blocking.

**Progressive degradation**:
- No API key: silently skips TTS, text still loads in audio bar
- No voice selected: same behavior
- TTS failure (network, quota): console.warn, text remains in audio bar for manual retry

**Configurable toggle**: `gameState.autoAnnouncePeriodEnd` (boolean, default true) controls the behavior. Persisted to localStorage. Toggle lives in Sport Configuration settings group (per issue spec).

**Existing behavior preserved**: generateScoreReport() still loads text into the audio bar AND switches to the game tab. Manual score-report button still works identically.

### Semver classification: MINOR (additive, no breaking changes)

### Files changed
- js/app.js: _autoPlayPeriodScore() method, migration, settings wiring
- index.html: Auto-announce toggle in Sport Configuration section
- CHANGELOG.md + history.md: Documented

### Tests
59/59 pass. No new unit tests needed — auto-announce is UI/TTS-layer with no testable pure logic.
