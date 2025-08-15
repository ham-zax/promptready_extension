# PromptReady Brownfield Upgrade Plan (PRD v3.0 Alignment)

Status: **v1.1 - Aligned with IHP Epic**
Date: 2025-08-14

Sources
- PRD: docs/prd.md (Master PRD — MVP v3.0)
- Delta Matrix: docs/delta-matrix.md
- Architecture: docs/architecture.md, docs/Architecture-Unified.md.md, docs/offline-processing-pipeline.md
- UX Spec: docs/front-end-spec.md

## 1) Goals & Principles

- Validate product-market fit with a metered Freemium → BYOK model
- Preserve and harden Offline Mode; default-safe behavior
- Add BYOK experience first; backend monetization and trial later at release
- Minimize risk with feature flags, circuit breakers, and progressive rollout

## 2) Scope

In scope (MVP)
- UI: Offline/AI toggle, inline BYOK settings (gear), minimal trial affordances
- **Offline pipeline hardening via new Intelligent Offline Pipeline (IHP) epic**
- BYOK AI pipeline adapter (direct client call with user key)
- Backend (Phase 2): credit tracking + global budget circuit breaker; trial routing via proxy
- Experiment hooks (local flags), minimal telemetry (anonymous, client-only in Phase 1)

Out of scope (MVP)
- Full identity/account system; persistent remote user profiles
- Data storage of user content server-side; advanced analytics

## 3) Assumptions & Constraints

- Existing WXT/React/TS stack remains
- No server-side storage of user content; backend is stateless
- Pop-up performance budget: <200ms load; <100ms interactions
- Accessibility target: WCAG 2.1 AA for popup

## 4) Phased Plan

### Phase 1: Client-first Validation (Offline + BYOK)
Deliverables
- Offline/AI toggle implemented (default Offline)
- Inline BYOK settings complete; secure storage in chrome.storage.local
- **Intelligent Offline Pipeline implemented and tested**
- BYOK AI pipeline adapter with safe prompts, timeouts, failback to Offline
- Minimal telemetry (local only), perf and a11y checks

Key Tasks
1. UI Toggle & Settings
   - Add primary Offline/AI toggle in popup; persist to settings
   - Inline BYOK settings (provider, apiBase, apiKey, model) with validation
   - Contextual “Upgrade with your API Key” prompts per UX
2. **Offline Hardening**
   - **Implement the full Intelligent Offline Pipeline (Epic IHP) to robustly handle complex and technical content.**
3. BYOK Pipeline
   - Implement provider-agnostic adapter; timeouts; retries; safe prompts
   - Clear error UX; automatic fallback to Offline path
4. Quality/Perf/A11y
   - Add content quality scoring; ensure output stability
   - Verify popup budget and WCAG AA interaction patterns
5. Flags & Telemetry
   - Feature flags: aiModeEnabled, byokEnabled, trialEnabled (default false)
   - Local-only metrics for latency/errors (no content retention)

Exit Criteria
- All Phase 1 acceptance criteria met (see section 7)
- No regressions in Offline path across test matrix
- AI BYOK flow usable and reliable for early adopters

### Phase 2: Backend Monetization (Activation at Release)
(No changes to this section)

## 5) Work Breakdown Structure

Epics and Stories (priority, phase)
- Extension Core (MV3)
  - EXT-2 Inline settings in popup (Must, P1)
- **Intelligent Offline Pipeline (Replaces CLS-3)**
  - IHP-1 Hybrid Pipeline Orchestrator (Must, P1)
  - IHP-2 Bypass Heuristic (Must, P1)
  - IHP-3 Aggressive Filtering (Must, P1)
  - IHP-4 Scoring Engine (Must, P1)
  - IHP-5 Content Pruning (Must, P1)
  - IHP-6 Semantic Conversion (Must, P1)
- AI Mode & Monetization
  - AI-1 Mode toggle UI (Must, P1)
  - AI-2 BYOK settings inline (Must, P1)
  - AI-3 AI pipeline (BYOK now; Trial via backend later) (Should, P1/2)
  - BKD-1 Credit tracking service (Must, P2)
  - BKD-2 Global Budget Circuit Breaker (Must, P2)
- Cite-First Capture
  - Covered (CIT-1/2 Done)

Dependencies
- AI-3 (Trial path) depends on BKD-1/2
- Credit counter/trial modal depends on BKD-1 responses

## 6) Architecture & Implementation Notes
(No changes to this section)

## 7) Acceptance Criteria (selected)

AI-1: Mode Toggle UI
- Toggle visible in popup; defaults to Offline; persists across sessions
- Keyboard accessible; ARIA-compliant; performance budgets upheld

AI-2: BYOK Settings Inline
- BYOK panel accessible via gear icon; progressive disclosure
- Validate provider/apiBase/apiKey/model; store securely in chrome.storage.local
- Never transmits key to our backend

**IHP: Intelligent Offline Pipeline**
- **The hybrid pipeline correctly routes simple articles to Readability.js.**
- **The pipeline correctly uses the Intelligent Bypass for complex/technical pages.**
- **The ScoringEngine accurately identifies the main content block.**
- **Nested boilerplate is successfully pruned from the selected content.**
- **HTML tables are correctly converted to GFM or a JSON fallback.**

AI-BYOK Pipeline (Phase 1)
- With AI enabled and BYOK configured, AI path runs with timeout; on error/timeout, fallback to Offline
- Clear user feedback on fallback; no crashes

BKD-1 Credits Service (Phase 2)
- Issue/decrement/balance endpoints functionally correct
- Client shows remaining credits; decrements per AI trial run

BKD-2 Circuit Breaker (Phase 2)
- Global budget thresholds configurable; kill switch stops trial requests
- Client reflects breaker state and falls back gracefully

Perf & A11y
- Popup loads <200ms on fresh open; interactions <100ms
- Keyboard navigable; visible focus; color contrast AA

## 8) Testing & QA Strategy
(No changes to this section)

## 9) Rollout & Risk Management
(No changes to this section)

## 10) Timeline (Rough Order of Magnitude)
- Phase 1: **4-6 weeks (UI toggle, BYOK inline, IHP epic, BYOK adapter, tests)**
- Phase 2: 6–8 weeks (backend services, client integration, experimentation, hardening)

## 11) Next Steps
(No changes to this section)