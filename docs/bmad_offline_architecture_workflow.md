# BMAD Workflow — Offline Architecture (MV3, Local-First)

Status: Active
Owner: Architect (Winston)
Contributors: Product Owner, UX, Dev, QA, Release

## Objective
Deliver a complete, PRD-aligned offline architecture for PromptReady where all core features run without any network dependency. BYOK is optional and only used with explicit consent.

## Inputs
- PRD: `docs/prd.md`
- Architecture references (v2/v3, migration): `docs/dont_read_unless_said_markdownloader/`
- WXT notes: `docs/wxt_notes.md`

## Deliverables
- Offline Architecture spec: `docs/offline-architecture.md`
- Minimal permissions list aligned to PRD
- Messaging contracts and data models for offline pipeline
- BYOK boundaries (consent, rate-limit, encryption at rest)

## Acceptance Criteria
- Core flows (capture → clean → structure → export) function offline
- No content or URLs leave the device unless BYOK is explicitly invoked
- Minimal permissions only (`activeTab`, `scripting`, `storage`, `downloads`, optional `clipboardWrite`)
- BYOK keys encrypted at rest (AES-GCM via WebCrypto; passphrase in session)
- Performance targets: typical <300ms; long docs <1.5s (background service worker)

## Plan & Checkpoints
1. Draft offline architecture aligned to PRD — DONE → `docs/offline-architecture.md`
2. Confirm permissions and privacy text — DONE (in spec)
3. Define messaging contracts/types — DONE (in spec)
4. Define export JSON model and file naming — DONE (in spec)
5. Define BYOK constraints (consent, boundaries, rate-limit) — DONE (in spec)
6. Implementation follow-ups (separate tasks):
   - Scaffold `core/cleaner.ts`, `core/structurer.ts`, `filters/boilerplate-filters.ts`
   - Add `pro/byok-client.ts` with consent and safeguards
   - Wire popup actions to background pipeline
   - Add `lib/storage.ts` (AES-GCM helpers), `lib/fileNaming.ts`, `lib/telemetry.ts`

## Review & Handoff
- Architect → PO: Validate alignment with PRD non-goals and privacy commitments
- PO → Dev: Green-light to scaffold modules per spec
- QA: Prepare test matrix (30 pages) for performance/quality checks

---

Activation complete. This workflow governs the offline architecture initiative and its immediate follow-ups.
