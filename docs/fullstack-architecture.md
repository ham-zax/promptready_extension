# Full-Stack Architecture — PromptReady Extension (MVP)

Author: Winston (Architect)
Inputs: `docs/vire-clean-structure-prd-backlog.md`, `docs/front-end-spec.md`
Version: 0.1 (MVP)

## 1. Overview
PromptReady is a Chrome MV3 extension that captures a user's selection, cleans and structures content, and exports Markdown/JSON with citations. Pro features provide Prompt-Ready Bundles and optional BYOK validation via OpenAI-compatible endpoints (default: OpenRouter) with explicit consent.

## 2. Technology Stack
- Platform: Chrome MV3 (target Chromium stable ~12 months prior to launch)
- Language: TypeScript
- Build: WXT (MV3) with React 18 (React 19 acceptable if supported); TailwindCSS
- MV3 compliance: no inline scripts/styles, strict CSP
- Libraries:
  - Readability.js for article extraction (with custom boilerplate filters)
  - DOMPurify for sanitization
  - Markdown serializer (e.g., remark/stringify) or lightweight custom serializer
  - OpenAI-compatible HTTP client (fetch-based)
- Storage: `chrome.storage.local` (API keys obfuscated; optional AES-GCM via WebCrypto passphrase)

## 3. High-Level Architecture
- Content Script: selection capture → DOM snapshot → cleaner → structurer → postMessage
- Service Worker (background): command orchestration, downloads, settings IO, BYOK calls
- UI: Popup (quick actions) and Settings (modes, templates, BYOK, privacy)
- Pro Modules: Bundles editor; BYOK client; local rate limiter

## 4. Directory Structure (proposed, WXT)
```
extension/
  entrypoints/
    popup.html
    popup.tsx
    options.html
    options.tsx
    background.ts
    content.ts
  ui/
    components/
      ModeToggle.tsx
      SplitButton.tsx
      Toast.tsx
      Inputs.tsx
      StatusStrip.tsx
    modules/
      BundlesEditor.tsx
      ByokPanel.tsx
      TemplatesTable.tsx
      GeneralPanel.tsx
      PrivacyPanel.tsx
  pro/
    byok-client.ts
    rate-limit.ts
  content/
    capture.ts
    clean/
      readability.ts
      boilerplate-filters.ts
    structure/
      markdown.ts
      json.ts
  lib/
    types.ts
    storage.ts
    file-naming.ts
    telemetry.ts
    messaging.ts
  styles/
    tailwind.css
  wxt.config.ts
```

## 5. Data Models (TypeScript)
```ts
// Export JSON Schema (simplified interfaces)
export interface ExportMetadata {
  title: string
  url: string
  capturedAt: string // ISO
  selectionHash?: string
}

export type BlockType = 'heading' | 'paragraph' | 'list' | 'table' | 'code' | 'quote'

export interface ExportBlock {
  type: BlockType
  level?: number
  text?: string
  items?: string[]
  table?: { headers: string[]; rows: string[][] }
  code?: string
  language?: string
}

export interface PromptReadyExport {
  version: '1.0'
  metadata: ExportMetadata
  blocks: ExportBlock[]
}

// Prompt Bundle
export interface PromptBundle {
  version: '1.0'
  bundle: {
    system: string
    task: string
    content: string
    metadata?: Record<string, unknown>
  }
}

// Settings schema (MVP)
export interface Settings {
  mode: 'general' | 'code_docs'
  templates: { bundles: unknown[] }
  byok: {
    provider: 'openrouter'
    apiBase: string // default https://openrouter.ai/api
    apiKey: string
    model: string // dropdown or manual name
  }
  privacy: { telemetryEnabled: boolean }
}
```

## 6. Messaging Contracts
```ts
// Message types between content ↔ background ↔ UI
export type MessageType =
  | 'CAPTURE_REQUEST'
  | 'CAPTURED'
  | 'CLEANED'
  | 'STRUCTURED'
  | 'CLEAN_EXPORT_REQUEST'
  | 'EXPORT_REQUEST'
  | 'EXPORT_DONE'
  | 'ERROR'

export interface Message<T extends MessageType, P = unknown> {
  type: T
  payload?: P
}

// Examples
export type CaptureRequest = Message<'CAPTURE_REQUEST'>
export type Captured = Message<'CAPTURED', { html: string; url: string; title: string }>
export type Cleaned = Message<'CLEANED', { html: string }>
export type Structured = Message<'STRUCTURED', { exportMd?: string; exportJson?: PromptReadyExport }>
export type ExportRequest = Message<'EXPORT_REQUEST', { kind: 'md' | 'json'; fileName: string; content: string }>
export type ExportDone = Message<'EXPORT_DONE', { fileName: string }>
export type ErrorMsg = Message<'ERROR', { code: string; message: string }>
```

## 7. Core Modules
- capture.ts: Grabs current selection, computes selectionHash, collects title/url
- readability.ts + boilerplate-filters.ts: Extracts main content and removes boilerplate
- markdown.ts/json.ts: Convert DOM fragments into blocks/MD with code fence and table handling; language inference for code
- file-naming.ts: Implements `<title>__YYYY-MM-DD__hhmm__hash.(md|json)` with sanitization
- byok-client.ts: OpenAI-compatible client with default OpenRouter; supports manual apiBase and model
- rate-limit.ts: Token bucket (e.g., 10/min) for BYOK calls
- storage.ts: Typed wrapper over `chrome.storage.local`
- telemetry.ts: Minimal event logging (opt-in)

## 8. Security & Privacy
- CSP-compliant bundling; no inline scripts; avoid eval
- DOMPurify sanitize before serialization
- Obfuscate API key at rest; optional AES-GCM with user passphrase (never persisted)
- Explicit consent modal before any BYOK network call; visible network indicator
- Minimal permissions: `activeTab`, `storage`, `scripting`, `downloads`, optional `clipboardWrite`

## 9. Performance
- Main-thread budget ≤100ms per transform chunk; yield via `requestIdleCallback` or microtasks for large documents
- p95 <1.5s for long docs on mid-tier laptop; typical pages <300ms
- Lazy-load heavy libraries (e.g., Readability) when popup action is invoked

## 10. API Contracts (BYOK)
- Endpoint: `POST /v1/chat/completions` (OpenAI-compatible)
- Request:
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
- Timeouts: 12s; Retries: 2 with 250/500ms jittered backoff
- Local rate limit: 10/min; show spinner + "Using your key" badge during call
- Failure fallback: local (non-AI-refined) output

## 11. Analytics & Telemetry (opt-in)
- Events: `clean`, `export`, `bundle_use`
- Storage: counts only; no content captured
- Consent: toggle in Settings with clear copy

## 12. Testing Strategy
- Unit: DOM cleaners, structurer, file naming, storage, byok client
- Integration: end-to-end messaging; clipboard and downloads APIs
- Performance harness: curated 30-page matrix with p95 calculations
- Accessibility: keyboard navigation, focus management, ARIA labels

## 13. Build & Release
- Manifest (MV3) with permissions and action popup
- Service worker registered and message channels tested
- Icons, screenshots, listing copy prepared per store guidelines
- Min Chromium version pinned during release prep (≈12 months back)

## 14. Traceability
- Map user stories → acceptance criteria (UX spec) → tests and release criteria

## 15. Constants & Configuration
```ts
export const DEFAULT_HOTKEY = 'CtrlOrCmd+Shift+P'
export const DEFAULT_API_BASE = 'https://openrouter.ai/api'
export const DEFAULT_RATE_LIMIT_PER_MIN = 10
export const BYOK_TIMEOUT_MS = 12_000
export const RETRY_DELAYS_MS = [250, 500]
```

## 16. Risks & Mitigations
- Variable DOM structures → site-class heuristics + safe fallbacks
- Clipboard/download permission failures → user guidance and fallbacks
- CSP/injection risks → sanitize and isolate, strict CSP
