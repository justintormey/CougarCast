# QA Report — Issue #14: Export escHtml() to shared utils.js

**Date:** 2026-04-18  
**Branch/Commit reviewed:** afa5974 (feat: complete escHtml() migration — import from utils.js across all modules)  
**Test result:** 59/59 PASS

---

## Verdict: PASS

The issue-14 scope is fully implemented and correct. All three originally-identified innerHTML injection sites are patched. The local `escHtml()` definition has been removed from `app.js` in favor of the shared import.

---

## Scope Review

Issue #14 required:
1. Export `escHtml()` from a shared `utils.js` ✅ (done in #17; `js/utils.js` exists)
2. Patch `roster.js` player name/year injection ✅
3. Patch `sequence-builder.js` chip.label injection ✅
4. Patch `announcements.js` item.title injection ✅
5. Remove local `escHtml()` from `app.js` and import from utils.js ✅

---

## Implementation Quality

### utils.js (canonical escHtml source)
- `&` replaced before `<`, `>`, `"`, `'` — correct ordering, prevents double-encoding
- Covers all five HTML-significant chars
- `String(s)` coercion handles `null`/`undefined` inputs gracefully
- Single canonical export — no module retains a local copy

### roster.js
- `renderRoster()` L24: player name `#${p.number} ${p.firstName} ${p.lastName}` → `escHtml()`  ✅
- `renderRoster()` L27: `p.year` → `escHtml(p.year || '')` ✅
- `data-team`, `data-index`, `data-number` attributes intentionally not escaped — values are structured identifiers, correct call

### sequence-builder.js
- `renderChips()` L154: `chip.label` → `escHtml(chip.label)` ✅
- `chip.color` in `style="background:${chip.color}"` — sourced from `<input type="color">` which enforces hex format; no escaping required

### announcements.js
- `render()` L83: `item.title` → `escHtml(item.title)` ✅
- `data-id` attributes use `custom-${Date.now()}` format — no user-supplied content

### app.js
- Local `escHtml()` function removed ✅
- `import { escHtml } from './utils.js'` added ✅
- All previously-patched sites (period chips, segment editor inputs, action editor inputs, roster editor inputs, action buttons) remain escaped

---

## Adjacent Findings (out of scope for #14, informational)

### Low: Voice name unescaped in ElevenLabs voice picker (app.js L728)
```js
select.innerHTML = voices.map(v =>
  `<option value="${v.voice_id}" ...>${v.name}</option>`
).join('');
```
`v.name` comes from the ElevenLabs REST API — not from user localStorage. Exploitable only if ElevenLabs is compromised or MITM'd (requires network attack against the API; the app has no CSP). Self-XSS threat model does not apply here.  
**Severity:** Low (external API data, no user-controlled path). Not blocking.

### Low: `a.id` unescaped in `data-action` attribute (app.js L771)
```js
`<button class="action-btn" data-action="${a.id}" ...>`
```
`a.id` is user-editable via the custom action editor. A value containing `"` would break the attribute boundary. However, the attribute is only read back via `btn.dataset.action` (browser-parsed, safe) and never rendered as visible HTML.  
**Severity:** Low (attribute injection, no script execution path; DOM breakage only if user crafts a `"` in their own action ID). Not blocking.

---

## Semver Gate

PATCH tag — correct. The change is purely defensive: no behavior change for well-formed input, no new user-visible features, no API breaks.

---

## Summary

Core issue #14 deliverables are complete, correct, and well-structured. Two low-severity adjacent findings noted for awareness but are non-blocking and pre-existed issue #14's scope.
