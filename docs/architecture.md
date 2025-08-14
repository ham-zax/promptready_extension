
### **PromptReady MVP - Final Architecture Blueprint v1.0 (Abridged)**

*   **Status:** FINAL - Approved for Development
*   **Version:** 1.0
*   **Date:** August 20, 2025

#### **1. System Overview & Design Principles**

This document outlines the architecture for adding a "Metered Freemium to BYOK" model to the existing PromptReady WXT extension.

*   **Design Principles:**
    *   **Local-First & Private:** The existing Offline Mode is the foundation. User data remains on the client unless AI Mode is used.
    *   **Stateless Backend:** No user state is stored on our servers. All settings are in `chrome.storage.local`.
    *   **Minimal & Secure Backend:** The new serverless backend is limited to credit tracking and AI proxying for the free trial.
    *   **Financially Resilient:** A non-negotiable **Global Budget Circuit Breaker** caps all financial risk.
    *   **Built for Validation:** The architecture natively supports A/B/C testing to validate the chosen AI models.

#### **2. Component Architecture**

The system integrates the existing WXT extension with a new serverless backend.

*   **Client-Side (WXT Extension):**
    *   The `background.ts` service worker is the central orchestrator. It will be updated to include logic that calls our backend when "AI Mode" is selected.
    *   The `popup` UI will be updated with the mode toggle, credit counter, and an inline BYOK settings interface.

*   **Server-Side (New Serverless Functions):**
    *   **`/api/check-credits`:** Checks a user's credit balance and assigns them to an A/B/C cohort on their first request.
    *   **`/api/process-ai`:** The main AI proxy. It first checks the global budget, then routes the request to the correct AI model based on the user's cohort, and finally decrements the user's credit upon success.

*   **High-Level Flow:**
    `Popup UI` → `background.ts` → `Backend: check-credits` → `background.ts` → `Backend: process-ai` (with circuit breaker & A/B/C logic) → `AI Provider` → `background.ts` → `Popup UI`.

#### **3. Data Models (NoSQL - e.g., Firestore)**

*   **`users` Collection:**
    *   **Document ID:** Anonymous User ID from `chrome.identity`.
    *   **Fields:** `credits_remaining` (Number), `cohort` (String 'A'/'B'/'C'), `last_seen` (Timestamp).

*   **`global_config` Collection:**
    *   **Document ID:** `budget`.
    *   **Fields:** `weekly_spend_usd` (Number), `weekly_cap_usd` (Number), `last_reset` (Timestamp).

#### **4. API Contracts**

*   **`POST /api/check-credits`:**
    *   **Request:** `{ "userId": "..." }`
    *   **Success Response (200):** `{ "status": "OK", "credits_remaining": ..., "cohort": "..." }`
    *   **Error Response (402):** `{ "status": "INSUFFICIENT_CREDITS" }`

*   **`POST /api/process-ai`:**
    *   **Request:** `{ "userId": "...", "cohort": "...", "content": "..." }`
    *   **Success Response (200):** `{ "status": "SUCCESS", "processed_content": "..." }`
    *   **Error Response (503):** `{ "status": "SERVICE_AT_CAPACITY" }` (if circuit breaker is tripped).

#### **5. Technical Strategy & A/B/C Framework**

*   **Primary Technology Choice:** The system is designed to primarily use **`GPT OSS 20B`** (hosted via Groq/Together AI) for the free trial, selected for its optimal balance of open-source flexibility, speed, and cost.
*   **A/B/C Validation Plan:** New users will be randomly assigned to a cohort to test our model assumptions:
    *   **Cohort A (70%):** `GPT OSS 20B` (Primary)
    *   **Cohort B (20%):** `Llama 3.1 8B Instant` (Speed/Cost Fallback)
    *   **Cohort C (10%):** `Gemini 2.0 Flash` (Leveraging its free tier for cost comparison)

#### **6. Security & Deployment**

*   **Security:** Our master API keys are stored as secure secrets on the backend. The user's BYOK key is stored locally and never transmitted to us.
*   **Deployment:** The WXT extension will be published via the Chrome Web Store. The serverless backend will be deployed via a CI/CD pipeline connected to a GitHub repository, with separate environments for development and production.
