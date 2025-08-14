# PromptReady Brownfield Upgrade Plan (PRD v3.0 Alignment)

Status: Draft for review
Date: 2025-08-14

Sources
- PRD: docs/prd.md (Master PRD — MVP v3.0)
- Delta Matrix: docs/delta-matrix.md
- Architecture: docs/architecture.md, docs/Architecture-Unified.md.md
- UX Spec: docs/front-end-spec.md
- Offline/Rules: docs/offline-capabilities-integration-guide.md, docs/rules_engine_spec.md

## 1) Goals & Principles

- Validate product-market fit with a metered Freemium → BYOK model
- Preserve and harden Offline Mode; default-safe behavior
- Add BYOK experience first; backend monetization and trial later at release
- Minimize risk with feature flags, circuit breakers, and progressive rollout

## 2) Scope

In scope (MVP)
- UI: Offline/AI toggle, inline BYOK settings (gear), minimal trial affordances
- Offline pipeline hardening and Markdown structurer finalization
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
- Markdown structurer finalized; quality scoring, chunking retained
- BYOK AI pipeline adapter with safe prompts, timeouts, failback to Offline
- Minimal telemetry (local only), perf and a11y checks

Key Tasks
1. UI Toggle & Settings
   - Add primary Offline/AI toggle in popup; persist to settings
   - Inline BYOK settings (provider, apiBase, apiKey, model) with validation
   - Contextual “Upgrade with your API Key” prompts per UX
2. Offline Hardening
   - Complete CLS-3 structurer (headings, links, images, code blocks)
   - Optional: extend site-specific boilerplate rules
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
Deliverables
- Serverless credit tracking APIs and global budget circuit breaker
- Trial routing via backend proxy; cohort/experiment hooks
- Client integration for credit counter and trial exhaustion UX

Key Tasks
1. Backend Services
   - Credits service: issue/decrement/balance; minimal auth
   - Circuit Breaker: global thresholds, kill switch, logging
   - Observability: cost/usage metrics (no user content)
2. Client Integration
   - Route Trial AI requests to backend proxy; enforce budgets
   - Credit counter in popup; trial exhaustion modal & upgrade prompts
   - Respect kill-switch and show safe UI states
3. Experimentation
   - Local flags for model variants A/B/C; capture anonymous metrics
4. Release Controls
   - Remote-config or in-app flags for staged activation

Exit Criteria
- Backend reliability and budget safety proven in staging
- Trial experience smooth; conversion prompts clear
- Circuit breaker validated (forced trip test)

## 5) Work Breakdown Structure

Epics and Stories (priority, phase)
- Extension Core (MV3)
  - EXT-2 Inline settings in popup (Must, P1)
- Clean & Structure — Offline Mode
  - CLS-3 Structurer to Markdown (Must, P1)
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

UI
- Primary toggle in popup; settings via gear icon; progressive disclosure
- Credit counter and trial modal introduced in Phase 2

Storage Schema
- Remove isPro; add fields (timing per rollout):
  - credits: { remaining, total, lastReset }
  - user: { id, cohort } (Chrome identity or locally generated anon id)
  - trial: { hasExhausted, showUpgradePrompt }
- Migrations: default-safe values; feature-flag gated usage

AI Pipeline
- BYOK path: direct provider call with user key; strict timeouts; safe prompts
- Trial path (Phase 2): backend proxy with budget checks; retry/timeout policy

Backend API (Phase 2)
- POST /credits/issue
- POST /credits/decrement
- GET  /credits/balance
- POST /ai/process (enforces circuit breaker)
- Notes: stateless functions + minimal storage for budget counters and config

Experimentation
- Local flags to select model variant; record anonymous timing/error counts

Security & Privacy
- No user content stored server-side; redact logs; BYOK key kept client-side

## 7) Acceptance Criteria (selected)

AI-1: Mode Toggle UI
- Toggle visible in popup; defaults to Offline; persists across sessions
- Keyboard accessible; ARIA-compliant; performance budgets upheld

AI-2: BYOK Settings Inline
- BYOK panel accessible via gear icon; progressive disclosure
- Validate provider/apiBase/apiKey/model; store securely in chrome.storage.local
- Never transmits key to our backend

CLS-3: Markdown Structurer
- Produces H1 title + consistent H2/H3 hierarchy
- Preserves links/images/code; fixes relative URLs
- Includes cite-first metadata (URL, timestamp, hash)

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

- Unit
  - Boilerplate filters; structurer rules; AI adapter error/timeout handling
- Integration
  - Capture → process → clipboard (Offline E2E)
  - BYOK flow (mock providers)
- A11y
  - Axe checks; keyboard navigation tests
- Performance
  - Popup load and interaction timings
- Staging Validation (Phase 2)
  - Credit decrement flows; circuit breaker trip/clear

## 9) Rollout & Risk Management

- Feature flags default to safe (Offline)
- Ringed rollout: dev → canary → prod
- Kill switches for AI and backend usage
- Telemetry minimal and anonymized; opt-out toggle in settings
- Risks: backend cost overrun, abuse, performance regressions — mitigated via breaker, rate limits, budgets, tests

## 10) Timeline (Rough Order of Magnitude)

- Phase 1: 2–3 weeks (UI toggle, BYOK inline, structurer, BYOK adapter, tests)
- Phase 2: 6–8 weeks (backend services, client integration, experimentation, hardening)

## 11) Next Steps

- Sign off this plan
- Implement Phase 1 backlog:
  1) Toggle + inline BYOK
  2) Structurer finalization
  3) BYOK adapter
  4) Tests + perf/a11y checks
- Draft backend API contracts and stubs (kept disabled)
