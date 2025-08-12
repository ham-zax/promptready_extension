# Offline Architecture — PromptReady (Local‑First, MV3)

Author: Winston (Architect)
Version: 1.0 (MVP)

## 1) Purpose & Scope

This document is the single source of truth for PromptReady’s offline‑first architecture. It translates the PRD into a concrete, implementable design that guarantees all core functions work without any server dependency. Network access is optional and only used with explicit user consent for BYOK validation.

In‑scope (MVP):
- Clean, structure, and export selected page content to Markdown/JSON with citations
- Popup UI with mode toggle (Offline | AI Mode)
- Local storage of settings; no cloud backends
- Pro gating via a local flag; BYOK adapter for OpenAI‑compatible endpoints (optional)

Out‑of‑scope (MVP):
- Pipelines, OCR, multi‑page binder, entity extraction, cloud sync, hosted inference

## 2) PRD Alignment Checklist (Offline Guarantees)

- One‑Click Clean Copy: fully local; deterministic heuristics; no network
- Code & Docs Mode: local heuristics for code fences, API tables, stack traces
- Cite‑First Capture: local URL/timestamp/selection hash; never sent to server
- Export MD/JSON: local clipboard and downloads API only
- BYOK: OpenAI‑compatible calls are explicitly consented and rate‑limited; only prompt bundles are sent; never raw page HTML
- Telemetry: default off; counts only; stored locally; no content or URLs
- Permissions: minimal — `activeTab`, `scripting`, `storage`, `downloads`, optional `clipboardWrite`

No architectural element contradicts the PRD’s local‑first requirements.

## 3) High‑Level Architecture (MV3)

Core components:
- Content Script (ephemeral): Captures selection DOM and metadata. Sends to Service Worker.
- Service Worker (background): Orchestrates offline pipeline (clean → structure), manages downloads, storage, telemetry, optional BYOK.
- Popup UI (React via WXT): Triggers capture, shows progress/results, exposes copy/download actions, BYOK settings, Pro toggle.

Key properties of MV3:
- Background is a Service Worker (ephemeral). No long‑lived global state; use `chrome.storage.*` and in‑message payloads.
- All heavy processing runs off the page context (in Service Worker) to keep page responsive.

### 3.1 Directory Expectations (WXT)

```
entrypoints/
  background.ts      # Service Worker orchestration (offline pipeline + BYOK)
  content.ts         # Selection capture + metadata
  popup/
    index.html
    main.tsx
core/
  cleaner.ts         # Deterministic DOM cleaning + rules engine
  structurer.ts      # JSON + Markdown generation
  filters/
    boilerplate-filters.ts
pro/
  byok-client.ts     # OpenAI‑compatible client with consent + safeguards
  rate-limit.ts
lib/
  types.ts           # Shared types (Settings, Export models, messaging)
  storage.ts         # AES‑GCM helpers and storage wrappers
  fileNaming.ts      # <title>__YYYY-MM-DD__hhmm__hash.(md|json)
  telemetry.ts       # Opt‑in, counts‑only events
styles/
  tailwind.css
```

## 4) Data Flow (Offline Pipeline)

1. Popup UI sends `CAPTURE_SELECTION` → Content Script
2. Content Script returns `CAPTURE_COMPLETE { html, url, title, selectionHash }` → Service Worker
3. Service Worker executes cleaner → structurer
4. Service Worker emits `PROCESSING_COMPLETE { exportMd, exportJson }` → Popup UI
5. User selects Copy/Download action; Service Worker handles downloads naming; clipboard via UI with permissions

All steps 1–5 function offline. If BYOK is invoked, it is a separate, explicit action with a dedicated consent flow.

## 5) Messaging Contracts (Typed)

```ts
export type MessageType =
  | 'CAPTURE_SELECTION'    // UI → Content
  | 'CAPTURE_COMPLETE'     // Content → SW
  | 'PROCESSING_COMPLETE'  // SW → UI
  | 'EXPORT_REQUEST'       // UI → SW
  | 'ERROR';               // Any → UI

export interface Message<T extends MessageType, P = unknown> {
  type: T;
  payload?: P;
}

export type CaptureComplete = Message<'CAPTURE_COMPLETE', {
  html: string;
  url: string;
  title: string;
  selectionHash: string;
}>;

export type ProcessingComplete = Message<'PROCESSING_COMPLETE', {
  exportMd: string;
  exportJson: PromptReadyExport;
}>;
```

## 6) Data Models

### 6.1 Settings (chrome.storage.local)

```json
{
  "mode": "offline" | "ai",
  "templates": { "bundles": [] },
  "byok": {
    "provider": "openrouter",
    "apiBase": "https://openrouter.ai/api",
    "apiKey": "",         // encrypted-at-rest
    "model": ""
  },
  "privacy": { "telemetryEnabled": false },
  "isPro": false            // local flag only
}
```

### 6.2 Export JSON (simplified)

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

## 7) Offline Processing Details

### 7.1 Cleaner
- Deterministic pass using `filters/boilerplate-filters.ts` (rules engine)
- Apply DOMPurify for sanitization
- Article isolation with Readability where applicable

### 7.2 Structurer
- Convert cleaned DOM to `PromptReadyExport` blocks
- Generate Markdown respecting code fences, lists, tables, quotes

### 7.3 Selection Hash
- Compute a stable hash from the selected DOM fragment (e.g., SHA‑256 of normalized HTML)
- Stored only in export metadata; never transmitted by default

## 8) Permissions & Manifest (WXT)

Minimal set for offline MVP:
- `activeTab`, `scripting`, `storage`, `downloads`, optional `clipboardWrite`

Notes:
- Avoid broad host permissions until needed. Use `activeTab` + `scripting.executeScript` on user action.
- Side panel is optional; popup is primary UI for MVP.

## 9) Security & Privacy (Offline Guarantees)

API keys at rest:
- Encrypt BYOK `apiKey` before saving in `chrome.storage.local` using WebCrypto AES‑GCM.
- Derive key from user‑provided passphrase via PBKDF2 (sufficient iterations + salt in storage). Store passphrase only in `chrome.storage.session`.

Consent & data boundaries:
- Show explicit consent modal before any BYOK call. Display “Using your key” indicator.
- BYOK requests send only prompt bundles. Never send raw page HTML or exports.

Telemetry (opt‑in):
- Counts‑only events (`clean`, `export`, `bundle_use`).
- Stored locally. No URLs, no content. Default off.

## 10) Performance & Resilience

- Target: typical article <300ms; long documents <1.5s in SW
- Use chunked processing and `setTimeout` yielding for very large DOMs
- Service Worker lifecycle: ensure idempotent re‑entry of steps; persist in‑flight mode/state in message payloads if needed

## 11) Pro Gating (Local)

- Local `isPro` flag stored in `chrome.storage.local`
- UI gates Bundles editor and BYOK settings behind `isPro`
- No store/remote license in MVP

## 12) BYOK Client (Optional, Explicit)

Endpoint contract (OpenAI‑compatible): `POST /v1/chat/completions`, `temperature: 0`

Safeguards:
- Consent per call; visible activity badge
- Local rate limit (e.g., 10/min, jittered backoff on retry)
- 12s timeout; graceful fallback to local output on failure

## 13) Export Operations (Offline)

- File naming: `<title>__YYYY-MM-DD__hhmm__hash.(md|json)` with sanitized title
- Copy to clipboard (MD/JSON) via UI; downloads through SW

## 14) Accessibility & UX (Popup)

- Keyboard‑first navigation; focus management; ESC closes menus/modals
- ARIA labels; `aria-live` for status/toasts
- High contrast; visible focus rings

## 15) Open Risks & Mitigations

- DOM variance: cover with rules engine + Readability fallback → manual test matrix
- MV3 SW lifecycle surprises: keep steps idempotent; avoid assuming in‑memory state
- User confusion about BYOK: explicit consent UI and clear copy

## 16) Implementation Notes (WXT)

- Prefer WXT alias mapping in `wxt.config.ts`; keep TS path mapping minimal (see `docs/wxt_notes.md`)
- Tailwind via `@tailwindcss/vite` with `assets/tailwind.css` imported in popup UI

## 17) Acceptance Criteria (Architecture)

- All core features run offline with no network access
- No user content is sent over network unless BYOK is explicitly invoked
- Minimal permissions manifest passes store review; privacy policy matches behavior
- Processing performance meets targets on test matrix

---

This offline architecture is fully aligned with the PRD and current code scaffolding. The team can implement modules incrementally without introducing any server dependency.


