# QA Report — Issue #18: Complete escHtml() migration to utils.js

**Date:** 2026-04-18  
**Reviewed commit:** afa5974 (`feat: complete escHtml() migration — import from utils.js across all modules`)  
**Reviewer:** QA agent  
**Result: PASS**

---

## Scope

Issue #18 tasked engineering with:
1. Remove local `escHtml()` from `app.js`; replace with `import { escHtml } from './utils.js'`
2. Add `import { escHtml } from './utils.js'` to `roster.js`, `sequence-builder.js`, `announcements.js`
3. Apply `escHtml()` to all remaining unescaped innerHTML user-data sites in those three modules

---

## Verification Results

### 1. Single canonical escHtml source — PASS

`js/utils.js` exports one `escHtml()` function. Grep confirms it is the **only** definition in the entire `js/` tree. No module defines it locally.

Implementation correctness:
- `&` replaced first — prevents double-encoding on subsequent replacements ✓
- Covers all five HTML-sensitive characters: `& < > " '` ✓
- `String(s)` coercion handles non-string inputs (numbers, null) gracefully ✓

### 2. app.js — local definition removed, import added — PASS

- Line 12: `import { escHtml } from './utils.js';` present ✓
- No local `escHtml` function definition anywhere in `app.js` ✓

### 3. roster.js — PASS

```js
import { escHtml } from './utils.js';          // line 3 ✓
const name = escHtml(`#${p.number} ${p.firstName} ${p.lastName}`);  // line 24 ✓
<span class="player-pos">${escHtml(p.year || '')}</span>             // line 27 ✓
```

Deliberately unescaped `data-*` attributes:
- `data-team="${team}"` — always literal `'home'` or `'away'` ✓
- `data-index="${i}"` — integer from Array.map index ✓
- `data-number="${p.number}"` — DOM key only, never rendered as HTML ✓

### 4. sequence-builder.js — PASS

```js
import { escHtml } from './utils.js';   // line 3 ✓
`<span class="chip ${chip.cssClass}" data-index="${i}" ${style}>${escHtml(chip.label)}</span>`  // line 154 ✓
```

- `chip.color` in `style="background:${chip.color}"` — from `btn.style.background` (preset hardcoded hex) or `null`. Self-XSS via localStorage only; accepted threat model. Low.
- `chip.cssClass` — code literals only, no user input ✓
- `data-index="${i}"` — integer ✓

### 5. announcements.js — PASS

```js
import { escHtml } from './utils.js';   // line 3 ✓
<span class="announcement-title">${escHtml(item.title)}</span>   // line 83 ✓
```

Other interpolations verified safe:
- `statusText` — always one of 4 hardcoded literals (`'EDITED'/'AUTO'/'READY'/'PENDING'`) ✓
- `item.id` in `data-id` — programmatically generated as `custom-${Date.now()}`; DOM key only ✓
- `data-index="${index}"` — integer ✓
- Boolean guards for `disabled` attribute ✓

### 6. app.js remaining innerHTML sites — PASS (previously verified in #11, #15, #20)

| Site | Escaping |
|------|----------|
| Period chip `seg` | `escHtml(seg)` ✓ |
| Segment editor row `seg` | `escHtml(seg)` ✓ |
| Action editor `a.label`, `a.id` | `escHtml(...)` ✓ |
| Roster edit inputs (number, firstName, lastName, pronounce) | `escHtml(...)` ✓ |
| Voice select `v.name`, `v.voice_id` | `escHtml(...)` ✓ |
| Action button `a.label`, `a.id` | `escHtml(...)` ✓ |

`a.color`/`textColor` in `style` attribute — color picker hex values or `'white'`/`'#000'`; unescaped but structured. Self-XSS via localStorage only.

---

## Semver Gate

Commit tagged as PATCH. Changes are pure security hardening with no new behavior and no breaking changes. **PATCH is correct.**

---

## Test Results

```
Tests  59 passed (59)
Files  3 passed (3)
```

---

## Findings

| Severity | Finding |
|----------|---------|
| Low | `chip.color`/`a.color` in `style` attributes unescaped — self-XSS via localStorage only; hardcoded or color-picker-constrained values in all real call paths; consistent with established project threat model. Not actionable. |

**No blocking findings.**

---

## Verdict

**PASS.** Migration is complete and correct. `utils.js` is now the single canonical `escHtml` source across all modules. All 59 tests pass.
