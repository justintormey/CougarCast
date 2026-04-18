# QA Report — Issue #14 (Final): escHtml() shared utils.js + all innerHTML patches

**Date:** 2026-04-18  
**Commits reviewed:**
- `afa5974` — feat: complete escHtml() migration to utils.js (#18 engineering)
- `6627cb0` — fix(xss): escape player name/number/team in music-manager.js (#17)
- `769424b` — fix(security): escape voice name and action.id in app.js (#20)
**Test result:** 59/59 PASS  

---

## Verdict: PASS

All issue #14 deliverables are correct and complete. The two Low findings from the prior QA pass (commit `afa5974`) have been resolved in commit `769424b`. No new findings.

---

## Scope Checklist

| Item | Status |
|------|--------|
| `js/utils.js` exports canonical `escHtml()` | ✅ |
| `app.js` local `escHtml()` removed; `import` from utils.js | ✅ |
| `roster.js` player name + year escaped | ✅ |
| `sequence-builder.js` chip.label escaped | ✅ |
| `announcements.js` item.title escaped | ✅ |
| `music-manager.js` walkup player name/number/team escaped | ✅ |
| `app.js` voice picker `v.name` / `v.voice_id` escaped | ✅ (fixed in #20) |
| `app.js` action button `data-action="${a.id}"` escaped | ✅ (fixed in #20) |

---

## Implementation Audit

### utils.js
- `String(s)` coercion handles `null`/`undefined` without throwing ✅
- Replacement order: `&` first — prevents double-encoding ✅
- Covers all five HTML-significant chars: `& < > " '` ✅
- Single export, no module retains a local copy ✅

### Unescaped-by-design attributes (correct calls)
`data-team`, `data-index`, `data-number`, `data-period`, `data-cue`, `data-id` (announcement), `data-points` — all carry structured identifiers (integers, enum strings, `Date.now()` timestamps), never free-form user text. Never rendered as visible HTML. Intentionally not escaped per architecture notes. ✅

### Residual low-risk surface (informational, non-blocking)

**`a.color` in style attribute** (`app.js` L771, `sequence-builder.js` L153)

```js
// app.js
style="background:${a.color};color:${textColor}"

// sequence-builder.js
const style = chip.color ? `style="background:${chip.color}"` : '';
```

`a.color` flows from `<input type="color">` (enforces hex format), or from hardcoded SPORT_PRESETS. In normal use, only valid hex color strings reach these sites. Exploitation requires direct localStorage manipulation (self-XSS, same origin). `textColor` is always `'#000'` or `'white'` (hardcoded in `_saveActionsFromEditor`).

**Severity:** Low (informational). Not blocking. No change recommended — color picker constraint is the appropriate mitigation at the input layer.

---

## Semver Gate

PATCH — correct on all three commits. Purely defensive changes; no behavior change for well-formed input, no new features, no API surface changes.

---

## Summary

Issue #14 is fully shipped and clean. `escHtml()` is the single canonical utility, imported across all five modules that render user-controlled strings into innerHTML. No unescaped user-data injection sites remain in any current module. Test suite green.
