# Research: Issue #8 — Multi-Sport Config Screen & Deployment

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
