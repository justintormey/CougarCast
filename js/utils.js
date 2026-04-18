/**
 * Shared utility functions for CougarCast.
 *
 * escHtml() is the canonical HTML-escaping function used across all modules.
 * Import from here rather than defining locally in each module.
 *
 * & must be replaced first to avoid double-encoding subsequent replacements.
 * Covers the five characters that matter in HTML/attribute contexts:
 *   &  <  >  "  '
 */
export function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
