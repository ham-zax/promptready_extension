### **PromptReady MVP - Unified Architecture Blueprint v2.1**

*   **Status:** FINAL - Approved for Development
*   **Version:** 2.1 (Supersedes v2.0)
*   **Purpose:** This document is the single source of truth for PromptReady’s architecture. It translates the `Master PRD v3.0` into a concrete, implementable design for both the client-side extension and the serverless backend.

#### **1. System Overview & Design Principles**

This architecture supports a "Metered Freemium to BYOK" model for the PromptReady WXT extension.

*   **Design Principles:**
    *   **Local-First & Private:** The Offline Mode is the foundation. User data remains on the client. AI Mode requests are proxied securely, and no user content is stored on our servers.
    *   **Stateless Backend:** The serverless backend is limited to credit tracking and AI proxying. All user settings are stored client-side in `chrome.storage.local`.
    *   **Financially Resilient:** A non-negotiable **Global Budget Circuit Breaker** caps all financial risk from the free trial.
    *   **Built for Validation:** The architecture natively supports A/B/C testing to validate our chosen AI models.

#### **2. Component Architecture**

The system integrates the WXT extension with a new serverless backend.

*   **Client-Side (WXT Extension):**
    *   `Content Script`: Captures the selected DOM and metadata.
    *   `Service Worker (background.ts)`: The central orchestrator. It manages the offline pipeline and makes calls to our backend when "AI Mode" is selected.
    *   `Popup UI`: The user interface, containing the mode toggle, credit counter, and an inline BYOK settings interface.

*   **Server-Side (Serverless Functions):**
    *   `/api/check-credits`: Checks a user's credit balance and assigns them to an A/B/C cohort on their first request.
    *   `/api/process-ai`: The main AI proxy. It first validates the Global Budget, then routes the request to the correct AI model based on the user's cohort, and finally decrements the user's credit upon a successful response.

#### **3. High-Level Data Flow**

**A) Offline Mode Data Flow:**
1.  `Popup UI` sends `CAPTURE_SELECTION` → `Content Script`
2.  `Content Script` returns `CAPTURE_COMPLETE { html, ... }` → `Service Worker`
3.  `Service Worker` executes the local `cleaner` → `structurer` pipeline.
4.  `Service Worker` emits `PROCESSING_COMPLETE { exportMd, ... }` → `Popup UI`

**B) AI Mode Data Flow:**
1.  `Popup UI` sends `CAPTURE_SELECTION` → `Content Script`
2.  `Content Script` returns `CAPTURE_COMPLETE { html, ... }` → `Service Worker`
3.  `Service Worker` calls **`POST /api/check-credits`** with the user's anonymous ID.
4.  *If credits are available*, `Service Worker` calls **`POST /api/process-ai`**.
5.  *Backend* checks the **Circuit Breaker**, routes to the correct AI provider, and returns the processed content.
6.  `Service Worker` receives the processed content and emits `PROCESSING_COMPLETE` → `Popup UI`.

#### **4. Directory Structure (WXT)**

```
entrypoints/
  background.ts      # Service Worker orchestration (offline pipeline + backend calls)
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
  byok-client.ts     # OpenAI‑compatible client for BYOK users
lib/
  api-client.ts      # NEW: Client for our own serverless backend
  types.ts           # Shared types for internal and backend communication
  storage.ts         # Storage wrappers (including BYOK key encryption)
```

#### **5. Data Models**

**A) Server-Side Data Models (NoSQL - e.g., Firestore):**
*   **`users` Collection:**
    *   **Document ID:** Anonymous User ID from `chrome.identity`.
    *   **Fields:** `credits_remaining` (Number), `cohort` (String 'A'/'B'/'C').
*   **`global_config` Collection:**
    *   **Document ID:** `budget`.
    *   **Fields:** `weekly_spend_usd` (Number), `weekly_cap_usd` (Number), `last_reset` (Timestamp).

**B) Client-Side Data Model (`chrome.storage.local`):**
```json
{
  "mode": "offline" | "ai",
  "byok": {
    "provider": "openrouter" | "manual",
    "apiKey": "",         // MUST be encrypted-at-rest
    "model": "",          // e.g., "meta-llama/Llama-3.1-8b-instant"
    "apiBaseUrl": ""      // Optional: Only used for "manual" provider
  },
  "privacy": { "telemetryEnabled": false }
}
```

#### **6. API & Messaging Contracts**

**A) Backend API Contracts:**
*   **`POST /api/check-credits`:**
    *   **Request:** `{ "userId": "..." }`
    *   **Success Response (200):** `{ "status": "OK", "credits_remaining": ... }`
    *   **Error Response (402):** `{ "status": "INSUFFICIENT_CREDITS" }`
*   **`POST /api/process-ai`:**
    *   **Request:** `{ "userId": "...", "content": "..." }`
    *   **Success Response (200):** `{ "status": "SUCCESS", "processed_content": "..." }`
    *   **Error Response (503):** `{ "status": "SERVICE_AT_CAPACITY" }` (if circuit breaker is tripped).

**B) Internal Extension Messaging Contracts:**
```typescript
// See docs/technical-specs/rules-engine.md for full types
type MessageType =
  | 'CAPTURE_SELECTION'
  | 'CAPTURE_COMPLETE'
  | 'PROCESSING_COMPLETE'
  | 'ERROR';
```

#### **7. Technical Strategy & A/B/C Framework**

*   **Primary Technology Choice:** The system is designed to primarily use **`GPT OSS 20B`** for the free trial, selected for its optimal balance of open-source flexibility, speed, and cost.
*   **A/B/C Validation Plan:** New users will be randomly assigned to a cohort via the backend:
    *   **Cohort A (70%):** `GPT OSS 20B` (Primary)
    *   **Cohort B (20%):** `Llama 3.1 8B Instant` (Speed/Cost Fallback)
    *   **Cohort C (10%):** `Gemini 2.0 Flash` (Cost Comparison)

#### **8. Security & Privacy**

*   **Backend Security:** Our master API keys are stored as secure secrets on the backend and are never exposed to the client.
*   **Client Security:** The user's BYOK `apiKey` **must** be encrypted at rest in `chrome.storage.local` using WebCrypto AES-GCM.
*   **Privacy:** No user content is stored server-side. AI requests are proxied ephemerally. User identification is anonymous.

#### **9. Acceptance Criteria (Architecture)**

*   The Offline Mode runs with zero network access.
*   The AI Mode free trial correctly checks and decrements credits via the backend.
*   The Global Budget Circuit Breaker is implemented and prevents financial overruns.
*   The A/B/C model assignment logic is implemented on the backend.
*   All sensitive keys (ours on the backend, user's on the client) are stored securely.

---
