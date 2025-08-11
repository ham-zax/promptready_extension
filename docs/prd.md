# PRD — “PromptReady” MVP (2-Week Sprint)

## 0. Final Decisions & Strategic Approach

*   **Phased Approach:** The MVP will be a **BYOK (Bring Your Own Key) Extension**. This allows for a fast, low-risk launch to prove market fit. A full **Usage-Based SaaS Model** (with integrated billing and API keys) is planned for a future phase, contingent on the MVP's success.
*   **BYOK Provider:** Support any **OpenAI-compatible endpoint** with **OpenRouter as the default provider**; allow a **manual base URL** override.
*   **Pro Pricing:** The launch price will be **$3/mo or $29/yr**, with a potential launch promotion.
*   **License UX:** The MVP will use a simple **local license flag** to unlock Pro features, avoiding the complexity of the Chrome Web Store licensing API at launch.

## 1. Goals

*   Deliver fast, reliable clean/structure/export from any webpage selection with citations.
*   Win developers & researchers with a dedicated Code & Docs mode.
*   Monetize at launch with a Pro tier: Prompt-Ready Bundles powered by user's own API keys (BYOK).

## 2. Non-Goals (Postponed for future versions)

*   Pipelines (#8) - *Scheduled for 2-4 weeks post-launch.*
*   OCR/Transcripts (#10, #11)
*   Multi-page binder (#12)
*   Content deduplication (#13)
*   Entity extraction (#14)
*   Hosted AI inference or background scraping.
*   Internationalization (i18n) — deferred post‑MVP (revisit ~2 weeks after launch).

## 3. Personas

*   **Developer:** Cleans API docs, PRs/issues, stack traces, blog posts into prompt-ready MD/JSON.
*   **Researcher/Student:** Structures articles/papers into headings, quotes, and references.

## 4. User Stories (MVP)

*   As a user, I can press a hotkey or click the extension to clean and structure selected content into Markdown/JSON.
*   As a dev, I can accurately preserve code blocks, tables, and stack traces.
*   As a researcher, I can export content with the canonical URL, timestamp, and quotes preserved.
*   As a Pro user, I can export content as a role-primed prompt bundle (system + task + content) using my own API key for optional formatting/validation.

## 5. Core Features

*   **One-Click Clean Copy (#1):** Selection → clean → structure → export (MD/JSON).
*   **Code & Docs Mode (#3):** Preserves code fences, API tables, stack traces; uses heuristics per site class.
*   **Cite-First Capture (#9):** Includes canonical URL, timestamp, selection hash; preserves quoted snippets.
*   **Pro at Launch:**
    *   **Prompt-Ready Bundles (#18):** Exportable kits with system, task, and content blocks.
    *   **BYOK Adapter (#22):** Allows users to provide their own API key to optionally refine/validate output.

## 6. Requirements

### Functional

*   Triggered by hotkey and toolbar action.
    *   Default hotkey: **Ctrl/Cmd+Shift+P** (for "Prompt"). Less likely to conflict than K. User‑configurable post‑MVP.
*   Deterministic cleaner (Readability.js + DOM heuristics + boilerplate filters).
*   Structurer creates H1–H3, lists, tables, code fences, and blockquotes.
*   Export options: copy to clipboard, save as `.md`, download as `.json`.
    *   File naming convention: `<title>__YYYY-MM-DD__hhmm__hash.(md|json)` (e.g., `My-Article__2024-07-25__1430__a1b2c3d4.md`). Unsafe characters sanitized.
*   Modes: General and Code & Docs (toggle in popup/settings).
*   Citations: URL, timestamp, optional quoted-lines block, selection hash.
*   Pro: Bundles editor (choose system/task template), BYOK settings (OpenAI-compatible first).

#### Settings schema (MVP)

Stored in `chrome.storage.local`.

```json
{
  "mode": "general" | "code_docs",
  "templates": { "bundles": [] },
  "byok": {
    "provider": "openrouter",
    "apiBase": "https://openrouter.ai/api",
    "apiKey": "",
    "model": "" // dropdown list with manual override supported
  },
  "privacy": { "telemetryEnabled": false }
}
```

### Non-Functional

*   **Platform:** Chrome MV3 with minimal permissions: `activeTab`, `storage`, `scripting`.
*   **Browser support target:** Chromium stable released ~12 months prior to launch (pin exact minimum version during release prep).
*   **Privacy:** Local-first, no server storage, explicit user action for any network call (BYOK only).
*   **Performance:** Process a typical article in <300ms; long documents <1.5s on a mid-tier laptop.
*   **Accessibility:** Keyboard-first navigation, ARIA labels for popup/settings.
*   **Quality:** ≥85% of exports require “no manual fix needed” on a test set of 30 diverse pages.

## 7. Lean Backlog

### Epic: Extension Core (MV3)

*   **EXT-1:** MV3 scaffold (manifest, service worker, content script, popup shell).
*   **EXT-2:** Settings page (modes, templates list, BYOK key field).

### Epic: Clean & Structure (#1)

*   **CLS-1:** Selection capture and DOM snapshot.
*   **CLS-2:** Rule-based cleaner (Readability + boilerplate filters).
*   **CLS-3:** Structurer to Markdown.
*   **CLS-4:** JSON export model.

### Epic: Code & Docs Mode (#3)

*   **DEV-1:** Code fence preservation with language inference.
*   **DEV-2:** API tables normalization.
*   **DEV-3:** Stack trace formatter.

### Epic: Cite-First Capture (#9)

*   **CIT-1:** Canonical URL + timestamp capture.
*   **CIT-2:** Selection hash and quote preservation.
*   **CIT-3:** Citation footer in exports.

### Epic: Export

*   **EXP-1:** Copy to clipboard (MD/JSON).
*   **EXP-2:** Save `.md` and `.json` via downloads API.

### Epic: Pro: Prompt-Ready Bundles (#18) + BYOK (#22)

*   **PRO-1:** Bundles editor UI (system/task/content).
*   **PRO-2:** Bundle export (MD and JSON with roles).
*   **PRO-3:** BYOK settings and storage (obfuscated local storage).
*   **PRO-4:** BYOK formatter/validator call with explicit user consent UI, visible network activity indicator, per-minute local rate limit, and graceful fallback to local (non-AI-refined) output on error.
*   **PRO-5:** Pro feature gating (local flag, no server).

### Epic: QA, Compliance, and Release

*   **QA-1:** Test matrix of 30 pages (news, docs, GitHub, MDN, ArXiv, etc.).
*   **QA-2:** Accessibility audit on popup/settings.
*   **REL-1:** Chrome Web Store listing assets (icons, screenshots, GIFs, copy).
*   **LEG-1:** Privacy policy and permissions rationale document.

## 8. 2-Week Sprint Plan (MVP)

*   **Week 1:** EXT-1, EXT-2, CLS-1, CLS-2, CLS-3, EXP-1, DEV-1, CIT-1.
*   **Week 2:** DEV-2, DEV-3, CIT-2, CIT-3, EXP-2, PRO-1 through PRO-5, QA-1, QA-2, REL-1, LEG-1.

---

## 9. Success Metrics (90 Days)

- Adoption: 1,000 installs; 35% activation (first clean within 24h).
- Engagement: median 3 cleans/user/week; 25% W4 retention.
- Monetization: 6–8% Pro conversion; ≥40% BYOK attach among Pro.
- Quality: ≥85% “no manual fix needed” on a curated 30‑page test set.

## 10. Release Criteria

- QA pass on 30‑page matrix; p95 processing <1.5s; ≥85% zero‑fix exports.
- Accessibility: keyboard navigation and ARIA on popup/settings.
- MV3 compliance; minimal permissions rationale documented.
- Privacy policy and listing assets (icons, screenshots, GIFs, copy) complete.

## 11. Architecture & Permissions

- Content script: selection/DOM capture → cleaner → structurer → message to UI.
- Service worker: orchestrates commands, downloads, settings.
- UI: popup (quick actions, mode), settings (templates, BYOK), Pro bundles editor.
- Storage: `chrome.storage.local` (API keys obfuscated; optional passphrase for at‑rest encryption).
- BYOK: OpenAI‑compatible client; explicit user consent per call; retries/backoff; local rate limit.
- Permissions: `activeTab`, `storage`, `scripting`, `downloads`, optional `clipboardWrite`.

## 12. Analytics & Telemetry

- Default off; post‑install opt‑in.
- If enabled: event counts only (clean, export, pro‑bundle used). No content captured.

## 13. Risks & Mitigations

- Variable DOM structures → site‑class heuristics + fallbacks.
- Extension review friction → minimal permissions + transparent BYOK UX.
- BYOK confusion → explicit “using your key” consent and visible network indicator.
- Performance variance → fast rule‑based default; defer heavy transforms.

## 14. Machine‑Readable Specs (for future AI agents)

### 14.1 Export JSON Schema (simplified)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "PromptReadyExport",
  "type": "object",
  "required": ["version", "metadata", "blocks"],
  "properties": {
    "version": {"type": "string", "const": "1.0"},
    "metadata": {
      "type": "object",
      "required": ["title", "url", "capturedAt"],
      "properties": {
        "title": {"type": "string"},
        "url": {"type": "string", "format": "uri"},
        "capturedAt": {"type": "string", "format": "date-time"},
        "selectionHash": {"type": "string"}
      }
    },
    "blocks": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["type"],
        "properties": {
          "type": {"type": "string", "enum": ["heading", "paragraph", "list", "table", "code", "quote"]},
          "level": {"type": "integer", "minimum": 1, "maximum": 3},
          "text": {"type": "string"},
          "items": {"type": "array", "items": {"type": "string"}},
          "table": {
            "type": "object",
            "properties": {
              "headers": {"type": "array", "items": {"type": "string"}},
              "rows": {"type": "array", "items": {"type": "array", "items": {"type": "string"}}}
            }
          },
          "code": {"type": "string"},
          "language": {"type": "string"}
        }
      }
    }
  }
}
```

### 14.2 Prompt Bundle Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "PromptReadyBundle",
  "type": "object",
  "required": ["version", "bundle"],
  "properties": {
    "version": {"type": "string", "const": "1.0"},
    "bundle": {
      "type": "object",
      "required": ["system", "task", "content"],
      "properties": {
        "system": {"type": "string"},
        "task": {"type": "string"},
        "content": {"type": "string"},
        "metadata": {"type": "object"}
      }
    }
  }
}
```

### 14.3 Pipeline Schema (post‑launch reference)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "PromptReadyPipeline",
  "type": "object",
  "required": ["version", "name", "steps"],
  "properties": {
    "version": {"type": "string", "const": "1.0"},
    "name": {"type": "string"},
    "sitePreset": {"type": "string"},
    "steps": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["type", "id"],
        "properties": {
          "id": {"type": "string"},
          "type": {"type": "string", "enum": ["clean", "structure", "transform", "export"]},
          "config": {"type": "object"},
          "inputs": {"type": "array", "items": {"type": "string"}},
          "outputs": {"type": "array", "items": {"type": "string"}},
          "enabled": {"type": "boolean", "default": true}
        }
      }
    }
  }
}
```

## 15. Glossary & Concept Definitions

- Pipeline: A user‑defined, ordered sequence of steps that process captured content from the page. Typical stages: clean (remove noise), structure (normalize to blocks), transform (optional AI or rules‑based rewrites), export (MD/JSON or Bundle). Pipelines are deterministic by default; optional AI steps require explicit consent and may use BYOK.
- Bundle: A prompt‑ready export kit consisting of system, task, and content blocks, designed for direct use with LLM chat tools.
- BYOK: Bring Your Own Key; user supplies their cloud AI API key. Calls are only made on explicit action.
- Selection Hash: A stable hash computed from the selected DOM content to allow deduplication and citation integrity.

## 16. Test Page Matrix (initial)

- News/blog: The Verge, Medium, personal blog.
- Docs: MDN, React docs, Node.js docs, library README on GitHub.
- Research: arXiv abstract page, PubMed article page.
- Dev: GitHub issues/PRs, StackOverflow question with code.
- Tables: API reference pages with parameter tables.
- Edge cases: paywalled teaser pages (no bypass), infinite scroll articles, code‑heavy tutorials.

## 17. API Contracts (BYOK)

- Endpoint: OpenAI‑compatible (e.g., `POST /v1/chat/completions`). Default provider: **OpenRouter** with manual `apiBase` override supported.
- Request (example):

```json
{
  "model": "<selected-model-or-manual-name>",
  "messages": [
    {"role": "system", "content": "You are a formatter that ensures JSON validity and preserves code fences."},
    {"role": "user", "content": "<bundle content here>"}
  ],
  "temperature": 0
}
```

- Constraints:
  - Send only bundle content, never raw page HTML.
  - Temperature 0; max tokens bounded; client‑side rate limit.
  - Model selection via dropdown seeded with known OpenRouter models, with manual name entry supported.
  - On failure/timeouts, fall back to local, non‑refined bundle.

