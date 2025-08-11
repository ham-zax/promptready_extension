### Goal
- Deliver robust capture → clean → structure → copy for MV3 using an offscreen document.
- Use Readability-first extraction in general mode; keep conservative rules for code_docs.
- Reduce site UI noise (Reddit/GitHub) and keep copy reliable via offscreen clipboard.

### High-level approach
- Always run DOM work in the offscreen document (we already do for SW-limited contexts).
- For general mode: Readability → our sanitizer → structurer.
- For code_docs mode: current rules-based cleaner → structurer.
- Keep clipboard writes in offscreen; no auto-copy.

### Done
- package.json: Added `@mozilla/readability`.
- entrypoints/offscreen/main.ts:
  - Added URL normalization (base tag + absolutized links/images).
  - General mode: Readability on cloned Document; fallback to our cleaner.
  - Code_docs mode: current `ContentCleaner` retained.
  - Sends `OFFSCREEN_PROCESSED` with Markdown + JSON + metadata.
  - Clipboard handler `OFFSCREEN_COPY` returns `{ success, method }` and logs.
- entrypoints/background.ts:
  - Ensures offscreen lifecycle with reasons `['CLIPBOARD','DOM_PARSER']`.
  - Delegates processing when SW lacks `DOMParser`.
  - Handles `EXPORT_REQUEST` and sends `OFFSCREEN_COPY`.
  - Auto-copy removed to avoid double copy.
  - Fixed literal path typing for `/offscreen.html`.
- content/capture.ts:
  - Added DOM prep (ensure base/title, MathJax→LaTeX hints, mark hidden nodes).
  - Improved selection capture (multi-range) and URL fixing.
- core/filters/boilerplate-filters.ts:
  - Added Reddit/GitHub-specific cleanup; unwrap GitHub README, remove Reddit sidebars/ads/comments.
- lib/types.ts:
  - Added `OFFSCREEN_PROCESS`, `OFFSCREEN_PROCESSED`, `OFFSCREEN_COPY` contracts.

### Next up
1) Readability everywhere (optional): Always delegate processing to offscreen (even when SW `DOMParser` exists) for consistency.
2) Turndown output (optional feature flag):
   - Add Turndown + GFM with your `customTurndown` rules as an alternate renderer.
   - Allow choosing between Structurer Markdown vs Turndown in settings.
3) Metadata enrichment:
   - Port key fields from MarkDownload `metadata.js` (canonical URL, keywords, meta tags, math map).
   - Use in citation footer and filename generation.
4) Filters hardening:
   - Iterate Reddit/GitHub selectors with more samples; add site packs (Medium, Dev.to, MDN, Wikipedia, news).
5) UX polish:
   - Only show toast on `EXPORT_COMPLETE`; add inline copy status in popup.
6) QA matrix:
   - Test: MDN, Wikipedia, Medium, Dev.to, GitHub README, Reddit, news.
   - Verify copy success and cleanliness; ensure code_docs preserves code/tables.

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
- We’re following MV3 Offscreen + WXT guidance for offscreen lifecycle and messaging [[memory:5880181]].