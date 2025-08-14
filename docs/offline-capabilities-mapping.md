# PromptReady MVP: As-Is Capabilities & Gap Analysis v1.0

*   **Status:** DRAFT
*   **Purpose:** To provide a single source of truth detailing the current, robust offline capabilities of the PromptReady extension and to explicitly map the gaps and required work to meet the "Metered Freemium to BYOK" MVP specification.

## 1. Executive Summary

The existing PromptReady extension provides a mature, comprehensive, and feature-rich **Offline Mode**. This represents a significant head start and de-risks a large portion of the client-side development.

The primary deviation from the MVP specification is the complete absence of any backend infrastructure or AI-powered features. Therefore, the MVP project can be defined as:
*   **Brownfield Work:** Extending the existing WXT components (UI, Service Worker, Storage) to support a new AI mode and secure key storage.
*   **Greenfield Work:** Building the entire serverless backend, including credit tracking, the AI proxy, and the Global Budget Circuit Breaker, from the ground up.

## 2. As-Is State: Current Offline Capabilities

This section summarizes the functionality documented in `offline-capabilities-mapping.md`. The existing system is a sophisticated, local-first content processing engine.

#### **Key Existing Components:**

*   **Core Offline Engine (`core/offline-mode-manager.ts`)**
    *   A robust 5-step pipeline for content extraction (Readability.js), Markdown conversion (Turndown.js), post-processing, metadata generation, and quality assessment.
    *   Advanced features like content chunking for large files, fallback mechanisms, and URL-specific configurations are already implemented.

*   **Storage & Persistence (`lib/storage.ts`, `lib/cache-manager.ts`)**
    *   A complete settings management system using Browser Local Storage for user preferences and mode selection.
    *   A high-performance caching system using IndexedDB for processed content, including TTL-based expiration and size management.

*   **UI & Background Processing (`entrypoints/`)**
    *   A functional UI with components for mode selection (`ModeToggle.tsx`) and settings (`SettingsPanel.tsx`).
    *   A `background.ts` Service Worker that acts as the central orchestrator for the offline processing flow.
    *   Use of an offscreen document for isolated and performant content processing.

## 3. Deviation Analysis: Gaps vs. PRD/Architecture

This table details the specific deviations between the current implementation and the target MVP.

| Requirement / Feature Area | Current State (As-Is) | Target State (To-Be per PRD/Arch) | Gap & Required Action |
| :--- | :--- | :--- | :--- |
| **Overall Strategy** | 100% Offline, local-first processing. No external calls. | Metered Freemium (AI) to BYOK model. | **Strategic Pivot.** Requires adding an entirely new, network-dependent "AI Mode". |
| **Backend Infrastructure** | **Does not exist.** | A secure, stateless serverless backend with two endpoints (`/check-credits`, `/process-ai`) and a Firestore database. | **Major Gap (Net New).** Build the entire backend infrastructure from scratch. |
| **Financial Controls** | **Not applicable.** | A non-negotiable **Global Budget Circuit Breaker** to cap all financial risk from the free trial. | **Major Gap (Net New).** This is a critical new component that must be built into the backend. |
| **Security: BYOK API Key** | Stored in plain text in `localStorage`. | **Must be encrypted at rest** in `chrome.storage.local` using WebCrypto AES-GCM. | **Critical Upgrade.** The `lib/storage.ts` module must be refactored to implement strong encryption for user API keys. |
| **Service Worker Logic** | Orchestrates the offline pipeline only. | Must orchestrate **both** the offline pipeline and the new AI mode API calls based on the selected mode. | **Requires Extension.** The `background.ts` file needs significant new logic to handle the AI flow (calling the backend, handling responses). |
| **User Interface (UI)** | A basic mode toggle and settings panel. | A multi-state UI with views for the free trial, upgrade prompts, and a multi-step BYOK configuration flow. | **Requires Major Adaptation.** The existing UI components must be heavily modified and extended to match the detailed flows in `ui_text_and_flows.md`. |
| **Data Models (Server)** | **Do not exist.** | `users` and `global_config` collections in a NoSQL database (Firestore) to track credits and budget. | **Major Gap (Net New).** Design and implement the required database schema. |