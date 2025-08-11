# Full-Stack Architecture — PromptReady Extension (MVP)

**Author:** Winston (Architect)
**Version:** 1.0 (Final for MVP Development)

## 1. Overview
PromptReady is a Chrome MV3 extension that captures a user's selection, cleans and structures content, and exports Markdown/JSON with citations. Pro features provide Prompt-Ready Bundles and optional BYOK validation via OpenAI-compatible endpoints (default: OpenRouter) with explicit consent.

## 2. Technology Stack
- Platform: Chrome MV3 (target Chromium stable ~12 months prior to launch)
- Language: TypeScript
- Build: WXT (MV3) with React 18; TailwindCSS
- Libraries:
  - Readability.js for article extraction
  - DOMPurify for sanitization
  - Markdown serializer (e.g., remark/stringify)
  - OpenAI-compatible HTTP client (fetch-based)
- Storage: `chrome.storage.local` with AES-GCM via WebCrypto for sensitive data.

## 3. High-Level Architecture
- **[REVISED FLOW]** The architecture follows a robust, performant pipeline:
  1.  **Content Script:** Captures the DOM snapshot and sends it to the Service Worker. Its only job is fast, lightweight data extraction.
  2.  **Service Worker (background):** The core processing hub. It receives the raw DOM, orchestrates the entire `cleaner → structurer` pipeline, handles downloads, settings I/O, and all BYOK API calls.
  3.  **UI (Side Panel / Popup):** Displays the final processed content received from the Service Worker and handles user interactions.

## 4. Directory Structure (WXT)
- **[REVISED STRUCTURE]** The `clean` and `structure` logic has been moved from `content` to a new `core` directory to reflect that this processing now happens in the Service Worker.
```
extension/
  entrypoints/
    popup.html
    popup.tsx
    options.html
    options.tsx
    background.ts  # Service Worker
    content.ts     # Content Script
  core/
    cleaner.ts     # Orchestrates cleaning
    structurer.ts  # Orchestrates structuring
    filters/
      boilerplate-filters.ts # The Rules Engine
  ui/
    components/
      # ... UI components
    modules/
      # ... UI modules
  pro/
    byok-client.ts
    rate-limit.ts
  content/
    capture.ts     # Logic for capturing DOM from the page
  lib/
    types.ts
    storage.ts
    # ... other libraries
  styles/
    tailwind.css
  wxt.config.ts
```

## 5. Data Models (TypeScript)
- **[NOTE]** Added types for the new Rules Engine (`FilterRule`, `FilterAction`).
```ts
// Settings, Export, and Bundle interfaces remain as specified in the PRD.
export interface Settings { /* ... */ }
export interface PromptReadyExport { /* ... */ }
export interface PromptBundle { /* ... */ }

// Rules Engine Types for the Cleaner
export enum FilterAction {
  REMOVE = 'remove',
  UNWRAP = 'unwrap',
}

export interface FilterRule {
  description: string;
  selector: string;
  action: FilterAction;
}
```

## 6. Messaging Contracts
- **[REVISED CONTRACTS]** Simplified to reflect the new processing flow.
```ts
export type MessageType =
  | 'CAPTURE_SELECTION' // UI -> Content Script
  | 'CAPTURE_COMPLETE'  // Content Script -> Service Worker
  | 'PROCESSING_COMPLETE' // Service Worker -> UI
  | 'EXPORT_REQUEST'    // UI -> Service Worker
  | 'ERROR'             // Any -> UI

export interface Message<T extends MessageType, P = unknown> {
  type: T;
  payload?: P;
}

// Examples
export type CaptureComplete = Message<'CAPTURE_COMPLETE', { html: string; url: string; title: string }>;
export type ProcessingComplete = Message<'PROCESSING_COMPLETE', { exportMd: string; exportJson: PromptReadyExport }>;
```

## 7. Core Modules
- **`capture.ts` (Content Script):** Grabs the current selection's DOM, computes a `selectionHash`, and collects page title/URL. Its sole job is to package this data and send it to the service worker via `CAPTURE_COMPLETE` message.
- **`cleaner.ts` (Core Logic):** Consumed by the Service Worker. Orchestrates the cleaning pipeline. It runs the rules from `boilerplate-filters.ts` on the DOM, then processes the result with `Readability.js`, and finally sanitizes with `DOMPurify`.
- **`boilerplate-filters.ts` (Rules Engine):** Exports an array of `FilterRule` objects that define the heuristics for removing common boilerplate (headers, footers, ads, cookie banners, etc.) from the DOM.
- **`structurer.ts` (Core Logic):** Consumed by the Service Worker. Takes the cleaned DOM fragment and converts it into the final `PromptReadyExport` JSON structure and the Markdown string.
- **`byok-client.ts` (Pro Logic):** Handles all secure communication with OpenAI-compatible endpoints. Managed exclusively by the Service Worker.

## 8. Security & Privacy
- **API Key Storage:** The API key will be stored in `chrome.storage.local` **only after** being encrypted with AES-GCM using a user-provided passphrase. The passphrase will be held in `chrome.storage.session` and must be re-entered each session to decrypt the key for use. This provides strong security at rest.
- **Consent:** Explicit consent modal shown before any BYOK network call.
- **Permissions:** Minimal permissions will be requested as defined in the PRD.

## 9. Performance
- **[NOTE]** By moving processing to the Service Worker, the main page's performance is protected. The background processing will still adhere to the `<1.5s` target for long documents.
- The `requestIdleCallback` pattern may still be used within the Service Worker if needed to prevent it from becoming unresponsive during very large processing tasks.

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
- **Unit Tests:** Will heavily target the `cleaner.ts`, `structurer.ts`, and `boilerplate-filters.ts` modules with mock DOM inputs.
- **Integration Tests:** Will focus on the messaging pipeline: `UI → Content Script → Service Worker → UI`.

## 13. Build & Release
- Manifest (MV3) with permissions and action popup
- Service worker registered and message channels tested
- Icons, screenshots, listing copy prepared per store guidelines
- Min Chromium version pinned during release prep (≈12 months back)

## 14. Pro Feature Gating
- The Pro feature unlock flow is confirmed: The user will enter a license key in the settings UI. Upon successful validation (a simple local check for the MVP), a flag `{ "isPro": true }` will be set in `chrome.storage.local`. The React UI components will conditionally render or enable Pro functionality based on this flag.

---

This final architecture document is now the single source of truth for the project. It is robust, secure, and performant. Development can now begin by scaffolding the project with `wxt` and building out the modules as defined.



---

### **NEW SECTION: Development Workflow & Setup**

This section provides the necessary commands and configuration for a developer to set up and run the project locally.

#### **Prerequisites**
-   Node.js (LTS version, e.g., 20.x)
-   npm (comes with Node.js)
-   A Chromium-based browser (e.g., Google Chrome, Brave)

#### **Local Setup Commands**
```bash
# 1. Clone the repository
git clone <your-repository-url>
cd prompt-ready-extension

# 2. Install all dependencies
npm install

# 3. Start the development server
# This will launch a new browser instance with the extension loaded.
# It supports hot-reloading for rapid development.
npm run dev
```

#### **Environment Configuration**
-   Create a `.env` file in the root of the project for any sensitive keys or environment-specific variables. For the MVP, this file will primarily be used for the OpenRouter API key during testing.

```
# .env

# Optional: For testing Pro features locally
OPENROUTER_API_KEY="your_key_here"
```

---

This addition resolves the final blocker identified during the PO's validation. The architecture document is now complete and ready for the development team.
