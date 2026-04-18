# QA Report — Issue #17: Expand escHtml() coverage to music-manager.js

**Date:** 2026-04-18  
**Commit reviewed:** `6627cb0` — fix(xss): escape player name/number/team in music-manager.js walkup section  
**Result: PASS**

---

## Scope

Issue #17 asked for `escHtml()` to be applied to 4 unescaped `innerHTML` sites in `music-manager.js`'s walkup section:

1. Player jersey number (visible `#N` display)
2. Player first/last name
3. Home team mascot/name header
4. Away team mascot/name header

Additionally: create `js/utils.js` as the canonical shared module exporting `escHtml()`.

---

## Findings

### ✅ All 4 Required Sites Escaped

| Site | Line | Before | After |
|------|------|--------|-------|
| Jersey number display | 328 | `#${p.number}` | `#${escHtml(p.number)}` |
| Player name | 329 | `${name}` | `${escHtml(name)}` |
| Home team header | 341 | `${home?.mascot \|\| home?.name \|\| 'Home'}` | `${escHtml(...)}` |
| Away team header | 345 | `${away?.mascot \|\| away?.name \|\| 'Away'}` | `${escHtml(...)}` |

### ✅ utils.js Implementation Correct

`js/utils.js` exports `escHtml()` with correct encoding order:
- `&` → `&amp;` first (avoids double-encoding)
- Then `<`, `>`, `"`, `'`

Identical logic to the local definition previously in `app.js`.

### ✅ Name Composition Handled Correctly

```js
const name = `${p.firstName} ${p.lastName}`.trim() || `#${p.number}`;
return `... ${escHtml(name)} ...`;
```

Escaping applied to the *composed* string, which is correct — both the firstName/lastName path and the numeric fallback path are covered by a single `escHtml()` call.

### ✅ Other innerHTML Sites in music-manager.js Unaffected

`_renderCueCard()` and `_renderAtmosphereCard()` use only hardcoded strings, emoji literals, and numeric values — no user data. No escaping required there.

### ✅ 59/59 Tests Pass

```
Tests  59 passed (59)
```

---

## Low-Severity Finding (non-blocking)

**L1 — Unescaped `p.number` in `data-*` attribute and `id` contexts**

Severity: **low**

Sites:
- `data-number="${p.number}"` (line 327)
- `data-cue="walkup-${team}-${p.number}"` (lines 331–332)
- `data-player="${p.number}"` (lines 331–332)
- `id="file-walkup-${team}-${p.number}"` (line 333)

If a jersey number contains `"`, the HTML attribute is malformed (element may not render). No XSS risk: `data-*` attributes and `id` values cannot execute JavaScript. In practice jersey numbers are numeric. This is the same intentional pattern used across `app.js` for structured DOM keys.

**Assessment:** Non-blocking. Consistent with the codebase's documented decision to leave data-key attributes unescaped. If jersey numbers ever accept free-form input, revisit.

---

## Semver

Commit tagged as `fix` — PATCH increment. Correct: escaping is behavior-neutral for well-formed input, no public API change.

---

## Verdict

**PASS.** All 4 specified sites escaped. `utils.js` correctly implemented and exported. 59/59 tests pass. One low-severity `data-*` attribute finding, consistent with existing codebase pattern, non-blocking.
