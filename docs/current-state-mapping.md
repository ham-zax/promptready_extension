# PromptReady – Current State Mapping (Brownfield UI Workflow: UI Analysis)

Status: Baseline mapped against PRD and Architecture. This document serves as the initial artifact for the brownfield-ui workflow's `ui_analysis` step.

## High-Level
- Project type: Chrome MV3 extension using WXT + React + Tailwind
- Core flows present: capture → offscreen clean/structure → popup export
- Pro/BYOK: storage and settings present; client call not yet integrated

## Code Structure (key files)
- Entrypoints
  - `entrypoints/background.ts`: Service Worker; keyboard command; message router; offscreen lifecycle; downloads and clipboard via offscreen; processes CAPTURE → sends OFFSCREEN_PROCESS
  - `entrypoints/content.ts`: Content script; listens for `CAPTURE_SELECTION`; calls `content/capture.ts`
  - `entrypoints/offscreen/index.html`, `entrypoints/offscreen/main.ts`: Offscreen document; handles `OFFSCREEN_COPY`, `OFFSCREEN_PROCESS`; Readability + cleaner + structurer; returns `OFFSCREEN_PROCESSED`
  - `entrypoints/popup/PopupApp.tsx`: Popup UI shell; mode toggle; Clean & Export; export actions; Settings; BYOK section (added)

- Core Processing
  - `content/capture.ts`: DOM selection/full-page capture; absolutizes URLs; computes `selectionHash`
  - `core/cleaner.ts` + `core/filters/boilerplate-filters.ts`: Rules-engine cleaner; readability-like passes; sanitization
  - `core/structurer.ts`: HTML → `PromptReadyExport` blocks → Markdown + citation footer

- Shared Lib
  - `lib/types.ts`: Settings, export schemas, messaging contracts
  - `lib/storage.ts`: Settings, telemetry; AES-GCM key storage with PBKDF2; session passphrase
  - `lib/fileNaming.ts`: File naming and selection hash
  - `lib/markdown/markdownload-adapter.ts`: Turndown adapter used by offscreen

## UX per Front-End Spec
- Popup
  - Mode toggle present
  - Primary CTA Clean & Export present
  - Export actions present (copy/download MD/JSON)
  - Status/toasts present
  - Readability toggle + Renderer selector present
- Settings
  - Appearance, General, Privacy present
  - BYOK section added: provider display, editable `apiBase`, editable `model`, secure key storage (AES-GCM) with passphrase in session, clear key action

## Messaging (per Architecture)
- Implemented: `CAPTURE_SELECTION`, `CAPTURE_COMPLETE`, `OFFSCREEN_PROCESS`, `OFFSCREEN_PROCESSED`, `EXPORT_REQUEST`, `EXPORT_COMPLETE`, `OFFSCREEN_COPY`, `ERROR`
- Not used yet: `BYOK_REQUEST`

## Gaps vs PRD/Architecture
- BYOK client call not wired (no `pro/byok-client.ts`; no `BYOK_REQUEST` handling in background)
- Pro Bundles editor (UI) is placeholder; no bundle validate/export flow
- Options page is minimal and separate from React Settings; acceptable for MVP but duplicative
- Telemetry UI minimal; counts-only storage present

## Recommended Next Tasks (brownfield-ui workflow)
1) Implement BYOK client (OpenAI-compatible) in Service Worker; add `BYOK_REQUEST` handler and rate-limit
2) Add Bundles basic editor view in popup (system/task/content) and `Validate` button that triggers `BYOK_REQUEST`
3) Refine cleaner rules for target sites (GitHub/MDN/Medium) and add unit tests for `core/*`
4) Polish accessibility: ensure ARIA live regions in popup toasts/status
5) Prepare store assets and minimum Chromium version pin in manifest build


