### **PromptReady MVP - Unified Architecture Blueprint v2.2**

*   **Status:** IMPLEMENTED - 95% Complete (See README.md for current status)
*   **Version:** 2.2 (Supersedes v2.1)
*   **Purpose:** This document is the single source of truth for PromptReady's architecture. It translates the `Master PRD v3.0` into a concrete, implementable design for both the client-side extension and the serverless backend.
*   **Note:** The architecture described herein has been successfully implemented. See the main README.md for the current development status and remaining work items.

#### **1. System Overview & Design Principles**

This architecture supports a "Metered Freemium to BYOK" model for the PromptReady WXT extension.

*   **Design Principles:**
    *   **Local-First & Private:** The Offline Mode is the foundation. User data remains on the client. AI Mode requests are proxied securely, and no user content is stored on our servers.
    *   **Stateless Backend:** The serverless backend is limited to credit tracking and AI proxying. All user settings are stored client-side in `chrome.storage.local`.
    *   **Financially Resilient:** A non-negotiable **Weekly Spend Cap** caps all financial risk from the free trial.
    *   **Built for Validation:** The architecture natively supports A/B/C testing to validate our chosen AI models.

#### **2. Component Architecture**

The system integrates the WXT extension with a new serverless backend.

*   **Client-Side (WXT Extension):**
    *   `Content Script`: Captures the selected DOM and metadata.
    *   `Service Worker (background.ts)`: The central orchestrator. It manages the offline pipeline and makes calls to our backend when "AI Mode" is selected.
    *   `Popup UI`: The user interface, containing the mode toggle, credit counter, and an inline BYOK settings interface.

*   **Server-Side (Serverless Functions):**
    *   `/api/check-credits`: Checks a user's credit balance and assigns them to an A/B/C cohort on their first request.
    *   `/api/process-ai`: The main AI proxy. It first validates the Weekly Spend Cap, then routes the request to the correct AI model based on the user's cohort, and finally decrements the user's credit upon a successful response.

```mermaid
flowchart TD
    A[User Selection] --> B[1. Sanitize with DOMPurify]
    B --> C{Is Simple Article?}
    C -- Yes --> D[Standard Pipeline];
    C -- No --> E[Intelligent Bypass Pipeline];

    subgraph Standard Pipeline
        D --> S1[4a. Extract Main Content with Readability.js];
        S1 --> S2[5. Convert to Markdown with Semantic Preservation];
    end

    subgraph "Intelligent Bypass Pipeline (Multi-Stage)"
        E --> I1[4b. Aggressive Filter (REMOVE)];
        I1 --> I2[4c. Run Heuristic ScoringEngine to Find Winner];
        I2 --> I3[4d. Prune Nested Boilerplate from Winner];
        I3 --> I4[5. Convert with Semantic Preservation];
        I4 --> I5[6. Final Markdown Post-Processing];
        I5 --> I6[✅ Final Clean Markdown];
        I6 --> I7[7. Secure Handoff for Clipboard Write];
    end
```

#### **3. High-Level Data Flow**

**A) Offline Mode Data Flow:**
1.  `Popup UI` sends `CAPTURE_SELECTION` → `Content Script`
2.  `Content Script` returns `CAPTURE_COMPLETE { html, ... }` → `Service Worker`
3.  `Service Worker` initiates the Offline Processing Pipeline via the offscreen document (Sanitize → Filter → Score/Prune → Convert).
4.  `Offscreen Document` sends `PROCESSING_COMPLETE { exportMd, ... }` → `Service Worker`
5.  `Service Worker` delegates the clipboard write to the `Content Script`

**B) AI Mode Data Flow:**
1.  `Popup UI` sends `CAPTURE_SELECTION` → `Content Script`
2.  `Content Script` returns `CAPTURE_COMPLETE { html, ... }` → `Service Worker`
3.  `Service Worker` calls **`POST /api/check-credits`** with the user's anonymous ID.
4.  *If credits are available*, `Service Worker` calls **`POST /api/process-ai`**.
5.  *Backend* checks the **Weekly Spend Cap**, routes to the correct AI provider, and returns the processed content.
6.  `Service Worker` receives the processed content and emits `PROCESSING_COMPLETE` → `Popup UI`.

#### **4. Pipeline Path 1: The Standard Readability Pipeline (for Articles)**

4.  **Extract Main Content with Readability.js:** The pre-cleaned HTML is passed to the industry-standard `@mozilla/readability` engine. It performs its own analysis to identify the single main "article" block and discards all other clutter.
5.  **Convert & Post-Process:** The clean HTML fragment from Readability is converted to Markdown by `Turndown.js` and then polished by our `MarkdownPostProcessor`.

#### **4. Pipeline Path 2: The Intelligent Bypass Pipeline (for Technical Content)**

This is the advanced path used for complex pages where Readability fails. It consists of multiple, sequential refinement stages.

1.  **Sanitize with DOMPurify:** Identical to the standard pipeline.
2.  **Apply Safe Boilerplate Filter:** Identical to the standard pipeline (UNWRAP pass).
3.  **Decision Point:** The `shouldBypassReadability` heuristic finds strong signals of technical content (e.g., headings like "Technical Specification") and returns `true`.
4.  **Apply Aggressive Filter:** A second, more aggressive set of filter rules is applied. This pass uses the `REMOVE` action to delete the now-orphaned boilerplate text left behind by the safe `UNWRAP` pass.
5.  **Run Heuristic ScoringEngine:** The `ScoringEngine` analyzes all remaining content "islands," scoring each based on multiple heuristics (link density, class names, presence of tables, heading depth, embedded code blocks, etc.) to select the single best candidate element.
6.  **Prune Winning Candidate:** The winning element is not trusted to be 100% pure. The `pruneNode` function is called to recursively score the winner's direct children and remove any nested, low-scoring boilerplate (e.g., "Related Products" sections, sidebars).
7.  **Convert with Semantic Preservation:** The final, clean HTML of the pruned winner is passed to our enhanced `TurndownConfigManager`. Its custom `tableToGfmOrJson` rule ensures that HTML tables are converted into LLM-friendly Markdown pipe tables or, for complex tables, a structured JSON fallback.
8.  **Post-Process & Handoff:** The Markdown is polished by `MarkdownPostProcessor` and then passed through the secure message pipeline for the privileged clipboard write.

#### **5. Architectural Evolution: The Journey from Bug to Feature**

The current sophisticated pipeline is the result of a systematic, iterative debugging and enhancement process.

*   **Initial State (V1):** A simple `Readability.js` -> `Turndown.js` pipeline that failed on complex pages.
*   **Problem 1: The Readability Conflict:** Our custom filter's "safe" `UNWRAP` action left orphaned text that confused the generic `Readability.js` algorithm.
*   **Solution 1: The Hybrid Pipeline & Two-Stage Cleaning:** The **Intelligent Bypass** was created. To fix the messy output from this bypass, the **Two-Stage Cleaning** process (Safe UNWRAP -> Aggressive REMOVE) was implemented.
*   **Problem 2: Nested Boilerplate:** The best content "island" still contained unwanted sections like "More from..." and related links.
*   **Solution 2: The Scoring & Pruning Engine:** The **`ScoringEngine`** was created to intelligently select the best content island, and the **`pruneNode`** function was added to perform a final cleanup pass inside that winner.
*   **Problem 3: Loss of Semantic Structure:** Tables were converted to plain text, losing their structure, which is critical for LLMs.
*   **Solution 3: Semantic Preservation:** The `TurndownConfigManager` was upgraded with a custom rule (`tableToGfmOrJson`) to intelligently convert tables to Markdown or a structured JSON fallback.
*   **Problem 4: Clipboard Security Violation:** The `navigator.clipboard` API failed when called from the offscreen document due to Chrome's security model.
*   **Solution 4: Secure Message Passing:** The final architecture was put in place, correctly delegating the clipboard write action via a message-passing flow: **Offscreen -> Background -> Content Script**.

#### **6. Key Modules & Responsibilities**

*   **`entrypoints/offscreen/enhanced-processor.ts`**: The main orchestrator of the offline/enhanced pipeline; responsible for running the two-stage cleaning, scoring, pruning, and conversion steps.
*   **`entrypoints/background.ts`**: The central message router and service worker orchestration. Manages pipeline invocation, backend calls, and secure message passing for clipboard writes.
*   **`entrypoints/content.ts`**: The user-facing context. Captures selections and performs the final privileged clipboard write.
*   **`core/scoring/scoring-engine.ts`**: The "brains" of the bypass pipeline; scores content islands and exposes `pruneNode` for nested boilerplate removal.
*   **`core/filters/boilerplate-filters.ts`**: The two-stage cleaning tool, providing both "safe" (UNWRAP) and "aggressive" (REMOVE) rule sets.
*   **`core/turndown-config.ts`**: The intelligent HTML-to-Markdown converter, responsible for semantic preservation of tables and custom conversion rules.
*   **`lib/dom-utils.ts`**: Utility helpers for DOM traversal, scoring heuristics, and safe element cloning used across the pipeline.
*   **`lib/markdown/markdown-adapter.ts`**: Adapts internal markdown output to external export formats (Joplin, clipboard, file).
*   **`pro/byok-client.ts`**: BYOK-compatible clients for external LLM providers used in AI Mode.

#### **7. Data Models**

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

#### **8. API & Messaging Contracts**

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

#### **9. Technical Strategy & A/B/C Framework**

*   **Primary Technology Choice:** The system is designed to primarily use **`GPT OSS 20B`** for the free trial via Groq API, selected for its optimal balance of open-source flexibility, speed, and cost.
*   **A/B/C Validation Plan:** New users will be randomly assigned to a cohort via the backend:
    *   **Cohort A (70%):** `GPT OSS 20B` (Primary)
    *   **Cohort B (20%):** `Llama 3.1 8B Instant` (Speed/Cost Fallback)
    *   **Cohort C (10%):** `Gemini 2.0 Flash` (Cost Comparison)

#### **10. Security & Privacy**

*   **Backend Security:** Our master API keys are stored as secure secrets on the backend and are never exposed to the client.
*   **Client Security:** The user's BYOK `apiKey` **must** be encrypted at rest in `chrome.storage.local` using WebCrypto AES-GCM.
*   **Privacy:** No user content is stored server-side. AI requests are proxied ephemerally. User identification is anonymous.

#### **11. Acceptance Criteria (Architecture)**

*   The Offline Mode runs with zero network access.
*   The AI Mode free trial correctly checks and decrements credits via the backend.
*   The Weekly Spend Cap is implemented and prevents financial overruns.
*   The A/B/C model assignment logic is implemented on the backend.
*   All sensitive keys (ours on the backend, user's on the client) are stored securely.

---
