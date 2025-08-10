### UI generation prompt (paste into your codegen tool)

```text
SYSTEM
You are a senior frontend engineer generating a Chrome MV3 extension UI with WXT + React 18+ (React 19 acceptable) + TailwindCSS. Implement the PromptReady MVP popup and settings UI precisely per spec. Produce production-quality, accessible, typed React code with clean composition and zero inline scripts (MV3-compliant). Optimize for keyboard-first UX, ARIA, and performance.

CONTEXT
Product: PromptReady — clean, structure, and export selected page content into Markdown/JSON with citations. Two modes: General and Code & Docs. Pro (BYOK) adds optional validation via OpenAI-compatible endpoints (default OpenRouter). Default hotkey: Ctrl/Cmd+Shift+P. File naming: <title>__YYYY-MM-DD__hhmm__hash.(md|json). Telemetry: opt-in, minimal events.

Tooling:
- WXT (MV3) + React 18+ + TailwindCSS
- MV3 constraints: no inline scripts/styles; use entrypoints; content script + service worker exist but UI is popup/options.
- TypeScript strict; functional components; hooks; controlled inputs.

TARGET SCREENS (MVP)
1) Popup
   - Header: Logo + ModeToggle (General | Code & Docs)
   - Body: Short description; Primary CTA “Clean & Export”
   - Actions: Split buttons
     - Copy: Markdown | JSON
     - Download: Markdown | JSON
   - Footer: StatusStrip (processing status/errors); Pro badge (opens Bundles view when available)
   - Edge cases:
     - No selection → inline hint with “Try Again”
     - Large selection → progress indicator with cancel
2) Settings (Options page)
   Tabs: General | Templates | BYOK | Privacy
   - General: default mode selector; hotkey info (read-only); show file naming convention
   - Templates: table of bundles (placeholder list, MVP simple view/edit)
   - BYOK: provider (OpenRouter fixed), apiBase (editable), apiKey (masked), model (dropdown with free text)
   - Privacy: telemetry toggle (opt-in) with consent copy
3) Pro: Bundles Editor (MVP Basic)
   - System, Task, Content textareas
   - Validate button (triggers consent and uses BYOK); Save/Export

ACCESSIBILITY
- Full keyboard nav; visible focus; ESC closes modals/menus; focus trap in popup
- ARIA labels/roles; status updates in live region for toasts/progress
- Contrast ≥ 4.5:1

STATE + DATA FLOW
- Settings persisted in chrome.storage.local:
  {
    mode: 'general' | 'code_docs',
    templates: { bundles: any[] },
    byok: { provider: 'openrouter', apiBase: 'https://openrouter.ai/api', apiKey: string, model: string },
    privacy: { telemetryEnabled: boolean }
  }
- Popup interacts with background/content via message channels (stubs ok). Show optimistic progress and final actions (copy/download).
- BYOK calls require explicit consent modal and visible “Using your key” indicator; never auto-call.

DELIVERABLES
Generate a working WXT+React+Tailwind UI with the following structure and components. Provide code for all listed files with imports wired.

WXT ENTRYPOINTS (paths are suggestions; adjust if needed for WXT conventions)
- entrypoints:
  - popup.html + popup.tsx (UI root for popup)
  - options.html + options.tsx (UI root for settings)
- shared UI components under ui/components
- minimal styling via Tailwind classes; include @tailwind base/components/utilities

FILES TO OUTPUT
- entrypoints/popup.html
- entrypoints/popup.tsx
- entrypoints/options.html
- entrypoints/options.tsx
- ui/components/ModeToggle.tsx
- ui/components/SplitButton.tsx
- ui/components/Toast.tsx (with ARIA live region hook)
- ui/components/StatusStrip.tsx
- ui/components/SecretInput.tsx
- ui/components/SelectWithFreeEntry.tsx
- ui/components/Tabs.tsx
- ui/components/TextAreaAuto.tsx (for Bundles editor)
- ui/modules/BundlesEditor.tsx
- ui/modules/ByokPanel.tsx
- ui/modules/TemplatesTable.tsx
- ui/modules/GeneralPanel.tsx
- ui/modules/PrivacyPanel.tsx
- lib/storage.ts (typed wrapper over chrome.storage.local)
- lib/telemetry.ts (opt-in, no content)
- lib/fileNaming.ts (implements <title>__YYYY-MM-DD__hhmm__hash)
- lib/ui/toastStore.ts (simple pub/sub)
- lib/messaging.ts (typed message stubs for future wiring)
- styles/tailwind.css (base imports)

COMPONENT CONTRACTS (TypeScript signatures)
- ModeToggle
  props: { value: 'general' | 'code_docs'; onChange: (v) => void }
- SplitButton
  props: {
    label: string; items: { key: string; label: string; onSelect: () => void }[];
    variant?: 'primary' | 'default'; disabled?: boolean; busy?: boolean
  }
- StatusStrip
  props: { status: 'idle' | 'processing' | 'done' | 'error'; message?: string }
- SecretInput
  props: { label: string; value: string; onChange: (v) => void; placeholder?: string }
- SelectWithFreeEntry
  props: { label: string; value: string; onChange: (v) => void; options: string[]; placeholder?: string }
- Tabs
  props: { tabs: { key: string; label: string }[]; value: string; onChange: (k) => void }
- TextAreaAuto
  props: { label: string; value: string; onChange: (v) => void; rows?: number }

POPUP UX LOGIC
- Primary CTA dispatches a “CLEAN_EXPORT_REQUEST” message (stub for now), shows progress, then enables Copy/Download split buttons for MD/JSON with fileName preview per convention.
- Show inline hint when no selection.
- Display toast success/error; announce via ARIA live region.

SETTINGS UX LOGIC
- General: Dropdown for default mode; show hotkey (Ctrl/Cmd+Shift+P); show filename convention; Save is immediate with success toast.
- BYOK: inputs for apiBase/apiKey/model; model select seeded with a few OpenRouter models; free text allowed; masked apiKey with reveal toggle.
- Privacy: telemetry toggle with consent copy; default off.

TAILWIND
- Use semantic class composition; keep styles minimal; responsive not required (popup fixed width ~360–400px).
- Include focus-visible rings and high-contrast text.

ACCEPTANCE CRITERIA
- Keyboard-only operation across popup and settings.
- Popup: Clean & Export shows progress and exposes Copy/Download actions; toasts and status strip update.
- Settings: values persist across sessions; BYOK fields validated; apiKey is masked by default.
- Consent modal appears before any BYOK network call (stub).
- No inline scripts or styles; MV3-compliant.
- TypeScript passes; UI builds with WXT.

OUTPUT FORMAT
- Provide all files’ contents with correct relative imports. Do not include build logs or commentary—only code content per file.
```

Notes for the generator:
- Prefer React 18 stable; React 19 features only if fully supported by WXT.
- Keep BYOK/network behavior stubbed but UX complete (consent, indicators).
- Ensure aria-live for toasts and status changes.

- If you need a minimal Tailwind config, assume standard postcss setup; no custom plugin required.
```

- Created a complete, paste-ready UI generation prompt tailored to WXT + React + Tailwind, aligned with our UX/architecture specs and MV3 constraints.
- Next options: 
  - Use this prompt to generate the UI scaffold now.
  - Or I can run the scaffold task and commit the generated files for you.