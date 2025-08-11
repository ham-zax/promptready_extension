### Goal
- Add Readability-first extraction in the offscreen doc for general mode; keep our structurer and current conservative pipeline for code_docs. Reduce clutter (Reddit/GitHub) and keep copy robust via offscreen.

### High-level approach
- Always run DOM work in the offscreen document (we already do for SW-limited contexts).
- For general mode: Readability → our sanitizer → structurer.
- For code_docs mode: current rules-based cleaner → structurer.
- Keep clipboard writes in offscreen; no auto-copy.

### Changes by file
- package.json
  - Add dependency: @mozilla/readability.
- entrypoints/offscreen/main.ts
  - Preprocess HTML: ensure base URL; absolutize links/images.
  - If mode === 'general': use Readability on a cloned Document; fallback to current cleaner if Readability returns null.
  - If mode === 'code_docs': use current `ContentCleaner` as-is.
  - Return `OFFSCREEN_PROCESSED` with `exportMd`, `exportJson`, `metadata`.
  - For `OFFSCREEN_COPY`: log and respond `{ success, method }`.
- entrypoints/background.ts
  - Ensure offscreen doc reasons: ['CLIPBOARD','DOM_PARSER'] (done).
  - Delegate processing with `OFFSCREEN_PROCESS` (already doing when DOMParser is undefined; optional: always delegate to standardize).
  - Keep copy path: on EXPORT_REQUEST with action=copy, send `OFFSCREEN_COPY`.
  - Remove auto-copy after processing (done).
- core/filters/boilerplate-filters.ts
  - Keep added Reddit/GitHub selectors; refine iteratively from field feedback.
- lib/types.ts
  - Already includes `OFFSCREEN_PROCESS`, `OFFSCREEN_PROCESSED`, `OFFSCREEN_COPY`.

### Implementation steps
1) Add @mozilla/readability.
2) Offscreen preprocessing helpers:
   - addBaseTagIfMissing(document, url)
   - absolutizeLinksAndImages(root, baseUrl)
3) Offscreen processing:
   - Parse HTML → clone → Readability.parse() → content || fallback to current cleaner.
   - Run our sanitize/structurer to get Markdown + blocks + footer.
4) Clipboard:
   - Keep `OFFSCREEN_COPY` handler with clipboard API first, `execCommand` fallback, sendResponse with result.
5) Background:
   - Keep ensureOffscreenDocument; send export requests as today.
6) Popup:
   - Keep delegating copy/download to background; no direct copy attempts.

### Edge cases
- CSP-heavy pages: content script capture already works; offscreen operates on provided HTML, so fine.
- Sites without clear article structure: fallback to our cleaner.
- Selection vs full-page: existing capture flow preserved.
- Duplicated copy: suppressed by removing auto-copy (done).

### Testing
- Pages: MDN/Wikipedia (Readability strong), Medium/Dev.to (code blocks), GitHub README, Reddit post, news site.
- Verify:
  - `OFFSCREEN_PROCESSED` arrives; Markdown looks clean.
  - On Copy, background logs `OFFSCREEN_COPY response: { success: true }`.
  - Paste matches expected content; no toast text.
- Regression: code_docs mode preserves code blocks/tables.

### Acceptance criteria
- Copy works reliably on at least the above sites.
- General mode output is cleaner vs prior (less UI/noise).
- Code_docs mode preserves technical formatting.
- No duplicate copy actions; `EXPORT_COMPLETE` toast shown only after successful copy.

Notes
- We’re following MV3 Offscreen and WXT guidance for offscreen lifecycle and messaging [[memory:5880181]].