# QA Report — Issue #15: escHtml data-action attribute in updateActionButtons()
**Date:** 2026-04-18
**Reviewer:** QA Agent
**Fix commit reviewed:** 769424b (fix(security): escape voice name and action.id in app.js innerHTML (#20))
**QA verification commit:** c9f97ad (qa(#14): final pass — all escHtml() sites verified, #20 fixes confirm clean)
**Tests:** 59/59 passing

---

## Summary

**PASS** — The `data-action` attribute injection vulnerability reported in issue #15 is correctly fixed. `escHtml(a.id)` is applied at `app.js:771`, the downstream `dataset.action` read-back is unaffected (browser decodes HTML entities), and all 59 tests pass. No new issues found.

---

## Vulnerability Description (from issue #15)

In `updateActionButtons()`, `a.label` was escaped via `escHtml()` (fixed in issue #11) but `a.id` was left unescaped in the `data-action` attribute:

```js
// BEFORE (vulnerable)
return `<button class="action-btn" data-action="${a.id}" ...>${escHtml(a.label)}</button>`;
```

A custom action ID containing `"` would break out of the attribute string. A crafted payload like:
```
" onmousedown="alert(1)
```
would inject a new event handler attribute, executing JavaScript on mouse click.

**Threat level:** Self-XSS only. The operator sets their own custom action IDs in the Custom sport editor. No cross-user attack surface in the current single-user, static-file deployment.

---

## Fix Verification

**File:** `js/app.js`, line 771

```js
// AFTER (fixed)
return `<button class="action-btn" data-action="${escHtml(a.id)}" ${pts} style="background:${a.color};color:${textColor}">${escHtml(a.label)}</button>`;
```

| Check | Result |
|-------|--------|
| `escHtml(a.id)` applied to `data-action` attribute | ✅ `app.js:771` |
| `escHtml(a.label)` still applied to button text content | ✅ `app.js:771` |
| `escHtml` imported from `./utils.js` (not local def) | ✅ `app.js:12` |
| `style` attribute values (`a.color`, `textColor`) — structured, not free-form | ✅ not applicable |
| `dataset.action` read-back in `sequence-builder.js:77` | ✅ unaffected (browser decodes `&quot;` → `"`) |

---

## Read-back Correctness

`bindActionButtons()` in `sequence-builder.js:77` reads:
```js
const action = btn.dataset.action;
if (action === 'custom') { ... }
```

`HTMLElement.dataset.*` returns the **decoded** value — the browser's DOM parser reverses HTML entity encoding. So `data-action="goal"` → `dataset.action === 'goal'`, and a hypothetically escaped `data-action="foo&amp;bar"` → `dataset.action === 'foo&bar'`. The action ID semantics (comparing against `'custom'`, `'goal'`, etc.) are completely unaffected by the escaping fix.

---

## Style Attribute Assessment

The same template string has unescaped expressions in the `style` attribute:
```js
style="background:${a.color};color:${textColor}"
```

- `a.color` — sourced from `<input type="color">` which always produces a hex color string (`#rrggbb`). Cannot contain injection payload.
- `textColor` — hardcoded to either `'#000'` or `'white'` in `_saveActionsFromEditor()`. Constant, not user-supplied.

Both values are safe without escaping. CSS injection via `style` attributes does not lead to script execution in modern browsers. **No action required.**

---

## Test Coverage

59/59 tests pass. The escaping fix is UI/DOM layer — outside Vitest's Node environment. No regression on text-generator, storage, or roster-manager logic.

---

## Semver Assessment

PATCH — no behavior change for well-formed input. Correct version (0.2.0 unchanged).

---

## Verdict

**PASS.** Issue #15 vulnerability is fully remediated. The fix is minimal (one-word change from `a.id` to `escHtml(a.id)`), correct, and does not break downstream read-back semantics. No follow-up issues required.

---

##VERDICT##
DECISION: PASS
ROUTE: Done
REASON: escHtml(a.id) correctly applied to data-action attribute at app.js:771. dataset.action read-back unaffected. 59/59 tests pass. No critical, high, or medium findings.
##END##
