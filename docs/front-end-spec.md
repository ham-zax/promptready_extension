# Front-End UX Specification — PromptReady Extension (MVP)

Author: Sally (UX Expert)
Inputs: `docs/vire-clean-structure-prd-backlog.md`
Version: 0.1 (MVP)

## 1. Product Context
PromptReady is a Chrome MV3 extension that cleans, structures, and exports selected page content into Markdown/JSON with citations. It targets Developers and Researchers with a Pro tier offering Prompt-Ready Bundles and BYOK validation via OpenAI-compatible endpoints (default: OpenRouter).

### 1.1 Tooling & Conventions (MVP)
- Framework: React 18 (React 19 acceptable if supported by WXT)
- Builder: WXT (MV3) with TypeScript
- Styling: TailwindCSS with `@tailwind base; @tailwind components; @tailwind utilities;`
- MV3 constraints: no inline scripts/styles; use HTML entrypoints and bundled JS/CSS
- WXT entrypoints (expected):
  - `entrypoints/popup.html` + `entrypoints/popup.tsx`
  - `entrypoints/options.html` + `entrypoints/options.tsx`
  - Background and content scripts live under `entrypoints/` (not part of this UX deliverable)

## 2. Personas & Primary Jobs-To-Be-Done (JTBD)
- Developer
  - Turn API docs, issues/PRs, and blog posts into clean MD with preserved code blocks.
  - Export JSON for downstream tooling/tests.
  - Maintain citations for reproducibility.
- Researcher/Student
  - Extract article content into structured notes with headings and quotes.
  - Keep canonical URL and timestamp for proper referencing.

## 3. Information Architecture (MVP)
- Popup (primary quick actions)
  - Mode toggle: General | Code & Docs
  - Primary CTA: Clean & Export
  - Secondary: Copy to Clipboard (MD/JSON), Download (MD/JSON)
  - Status strip: last action, processing state, and errors
  - Pro badge: indicates BYOK-enabled features; opens Bundles (Pro) when available
- Settings (secondary, persistent)
  - General: default mode, hotkey info, file naming convention
  - Templates: list of bundles (MVP: placeholder list)
  - BYOK: provider (OpenRouter), apiBase (editable), apiKey (masked), model dropdown or manual name
  - Privacy: telemetry toggle (opt-in)
- Pro Bundles Editor (MVP scope: basic view)
  - System, Task, Content textareas
  - Validate button (uses BYOK if enabled)
  - Save/Export bundle

## 4. Global Interaction Patterns
- Default hotkey: Ctrl/Cmd+Shift+P (user-configurable post-MVP)
- Keyboard-first: All controls tabbable; visible focus; ESC closes modals
- Feedback: Non-blocking toasts for success/error; inline validation where applicable
- File naming: `<title>__YYYY-MM-DD__hhmm__hash.(md|json)` with sanitization

## 5. Primary Flows (Step-by-Step)
### 5.1 Clean & Export (Popup)
1) User presses Ctrl/Cmd+Shift+P or clicks extension icon to open popup
2) Selects Mode (General | Code & Docs) if needed
3) Clicks Clean & Export
4) Content script captures selection, performs cleaning/structuring
5) Popup renders result summary and provides two actions:
   - Copy Markdown | Download Markdown
   - Copy JSON | Download JSON
6) Toast: “Export ready” + file name preview

Edge cases:
- No selection detected → show inline hint: “Select content on the page, then try again.” with a Try Again button
- Very large selection → show progress indicator with yielding; allow Cancel

### 5.2 Pro: Validate/Format Bundle (MVP minimal)
1) In Settings → BYOK, user enters apiKey, edits apiBase if needed (OpenRouter default)
2) Model dropdown shows known models; user can type manual name
3) In Bundles, user opens a bundle and clicks Validate
4) Consent dialog: “Using your key to format/validate. Visible network indicator. Continue?”
5) On success: show “Validated” badge; on failure: show error toast and fall back to local output

### 5.3 Settings Update
- Changes persist immediately to `chrome.storage.local`
- Secret fields masked; reveal-on-press eye icon
- Telemetry is off by default; opt-in CTA explains minimal event schema

## 6. Wireframe Specs (Textual)
### Popup Layout
- Header: Logo + Mode Toggle segmented control
- Body: Description line; large CTA “Clean & Export”
- Actions: Two split buttons
  - Copy (dropdown: Markdown, JSON)
  - Download (dropdown: Markdown, JSON)
- Footer: Status strip (icon + short text), Pro badge (click → Bundles)
Notes: fixed width ~360–400px; keyboard-first focus order; high-contrast theme via Tailwind utilities

### Settings Layout
- Tabs (left rail or top): General | Templates | BYOK | Privacy
- General: Mode default selector; hotkey info (read-only for MVP)
- Templates: Table of bundles (name, updatedAt) with View/Edit (MVP simple)
- BYOK: Provider (OpenRouter), apiBase (text), apiKey (password), model (select + free text)
- Privacy: Telemetry toggle with consent copy; link to privacy policy

## 7. Component Inventory (MVP)
- ModeToggle (General | Code & Docs)
- PrimaryButton (Clean & Export)
- SplitButton (Copy/Download with menu)
- Toast / InlineAlert (success, error, info)
- TextInput (apiBase), SecretInput (apiKey), SelectWithFreeEntry (model)
- Tabs, Table (templates), Badge (Pro), StatusStrip
- ModalDialog (consent)

## 8. States & Validation
- Loading: spinner and descriptive verb (“Cleaning…”, “Structuring…”, “Exporting…”) with p95 under 1.5s
- Errors: permission denied (clipboard/downloads), network error (BYOK), no selection, malformed content
- Recovery: retry, fall back to local, instructions for permissions

## 9. Accessibility (MVP)
- Tab order defined: Logo → ModeToggle → Clean & Export → Copy → Download → Footer links
- Focus trap in popup; ESC closes dropdowns/modals
- ARIA labels for buttons and inputs; live region for toasts
- Contrast ≥ 4.5:1; visible focus ring

## 10. Telemetry (opt-in)
- Events (if enabled):
  - clean: { mode, durationMs }
  - export: { type: "md" | "json", fileName }
  - bundle_use: { action: "validate" | "export", model }

## 11. Acceptance Criteria (UX)
- Popup usable entirely via keyboard; screen-reader announcements for state changes
- Clean & Export produces usable output on 85% of pages in the matrix without manual edits
- BYOK consent required before any network call; visible indicator during call
- File names follow convention and are sanitized

## 12. Out of Scope (MVP)
- i18n; advanced templates; multi-page binder; OCR; pipelines

## 13. Open Questions
- Minimum Chromium version to pin at release (target ~12 months back)
- Exact model list to seed for OpenRouter
