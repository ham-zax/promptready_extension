# PromptReady PRD v3.0 Delta Matrix vs Current Implementation

Status: Draft for review
Date: 2025-08-14

Sources
- PRD: docs/prd.md (Master PRD — MVP v3.0)
- Architecture: docs/architecture.md, docs/Architecture-Unified.md.md
- UX Spec: docs/front-end-spec.md
- Rules Engine Spec: docs/rules_engine_spec.md

Legend
- ✅ Implemented
- 🔄 In Progress / Partial
- ❌ Not Implemented
- Phases: 1 = Client-first (Offline + BYOK), 2 = Backend monetization (Credit + Circuit Breaker)
- Priority: Must / Should / Could

Summary
- Implemented/Strong: MV3 scaffold, selection capture, rule-based cleaner, auto-copy, cite-first capture
- Partial: Inline settings in popup, Markdown structurer, AI mode toggle (needs integration), AI pipeline basics (BYOK adapters TBD)
- Missing: Backend credit tracking, global budget circuit breaker, full trial flow, chrome.identity wiring

## Epic: Extension Core (MV3)

| Story | PRD Status | Current Impl | Gap | Priority | Phase |
|---|---|---|---|---|---|
| EXT-1 MV3 scaffold | ✅ | ✅ | None | Must | 1 |
| EXT-2 Inline settings in popup | 🔄 | 🔄 | Complete inline BYOK configuration per UX spec (gear, validation, storage) | Must | 1 |

Notes
- Ref: docs/front-end-spec.md (Settings access, progressive disclosure)

## Epic: Clean & Structure — Offline Mode

| Story | PRD Status | Current Impl | Gap | Priority | Phase |
|---|---|---|---|---|---|
| CLS-1 Selection capture | ✅ | ✅ | None | Must | 1 |
| CLS-2 Rule-based cleaner | ✅ | ✅ | Expand site-specific rules incrementally (optional) | Should | 1 |
| CLS-4 Auto-copy to clipboard | ✅ | ✅ | None | Must | 1 |

## Epic: Intelligent Offline Pipeline (Replaces CLS-3)

| Story | PRD Status | Current Impl | Gap | Priority | Phase |
|---|---|---|---|---|---|
| IHP-1 Hybrid Pipeline Orchestrator | 🔄 | ❌ | Implement the main orchestrator in `enhanced-processor.ts` to manage the two pipeline paths. | Must | 1 |
| IHP-2 Bypass Heuristic | 🔄 | ❌ | Implement the `shouldBypassReadability` decision heuristic. | Must | 1 |
| IHP-3 Aggressive Filtering | 🔄 | ❌ | Implement the second, aggressive `REMOVE` pass in the `boilerplate-filters.ts`. | Must | 1 |
| IHP-4 Scoring Engine | 🔄 | ❌ | Build the `ScoringEngine` to analyze and score content "islands". | Must | 1 |
| IHP-5 Content Pruning | 🔄 | ❌ | Implement the `pruneNode` function to remove nested boilerplate from the winning candidate. | Must | 1 |
| IHP-6 Semantic Conversion | 🔄 | ❌ | Implement the `tableToGfmOrJson` rule in `TurndownConfigManager` to preserve table structures. | Must | 1 |

Notes
- Ref: docs/offline-processing-pipeline.md, docs/rules_engine_spec.md

## Epic: AI Mode & Monetization

| Story | PRD Status | Current Impl | Gap | Priority | Phase |
|---|---|---|---|---|---|
| AI-1 Mode toggle UI (Offline/AI) | ❌ | 🔄 | Wire existing toggle to settings, persist state, gate features; ARIA + perf budgets | Must | 1 |
| AI-2 BYOK settings inline in popup | 🔄 | 🔄 | Complete BYOK flow (validate key, secure storage, UX prompts) | Must | 1 |
| AI-3 AI-enhanced pipeline (Trial & BYOK) | 🔄 | 🔄 | Implement BYOK adapter w/ timeouts and safe prompts; trial path gated (Phase 2) | Should | 1/2 |
| BKD-1 Backend credit tracking service | ❌ | ❌ | Stateless functions: issue/decrement/balance; auth-light; logging | Must | 2 |
| BKD-2 Global Budget Circuit Breaker | ❌ | ❌ | Budget thresholds + kill switch surfaced to client; enforce on proxy | Must | 2 |

Notes
- Phase 1: BYOK-only path enabled; no backend dependency in prod
- Phase 2: Trial via backend proxy + circuit breaker; experimentation hooks

## Epic: Cite-First Capture

| Story | PRD Status | Current Impl | Gap | Priority | Phase |
|---|---|---|---|---|---|
| CIT-1 URL + timestamp capture | ✅ | ✅ | None | Must | 1 |
| CIT-2 Selection hash/quote preservation | ✅ | ✅ | None | Must | 1 |

## Cross-Cutting Quality Bars

| Area | Current | Gap | Priority | Phase |
|---|---|---|---|---|
| Performance (popup <200ms, UI <100ms) | Good | Validate budgets after UI changes | Must | 1 |
| Accessibility (WCAG AA) | Partial | Ensure focus order, ARIA, contrast | Must | 1 |
| Telemetry (local-only Phase 1) | Minimal | Add lightweight client metrics; no content retention | Should | 1 |
| Experimentation (A/B/C) | Not wired | Local flag-based variant selection; logging in Phase 2 | Could | 2 |

## Risks & Mitigations

- Backend costs/trial abuse: Global Budget Circuit Breaker, strict timeouts, request size limits
- Privacy: BYOK never leaves client; no content stored server-side; disclose clearly in UI
- Regression risk in Offline path: Feature flags; default Offline; add regression tests for capture→clipboard
- Performance regressions: Lighthouse-style checks for popup; budget enforcement CI step (optional)

## Recommended Next Steps (for Sprint Planning)

1) Implement AI-1 Mode Toggle UI (Phase 1)
2) Complete AI-2 Inline BYOK Settings per UX spec (Phase 1)
3) Finalize CLS-3 Markdown Structurer and tests (Phase 1)
4) Add BYOK AI pipeline adapter with timeouts and safe prompts (Phase 1)
5) Draft backend API contracts for BKD-1/2; implement stubs (disabled) (Phase 2 prep)
6) Add perf/accessibility checks and minimal telemetry (Phase 1)

## Acceptance Criteria Pointers

- UI/UX: docs/front-end-spec.md
- Architecture: docs/architecture.md, docs/Architecture-Unified.md.md
- Offline pipeline: docs/offline-capabilities-integration-guide.md
- Rules engine: docs/rules_engine_spec.md


