# PromptReady

PromptReady is a Chrome/Chromium extension that captures the active page and turns articles, technical docs, Reddit-style discussions, research sources, notes, and everyday AI prompt context into clean Markdown and structured JSON.

Offline capture and Markdown export run locally. If you enable BYOK AI cleanup, the extension sends the captured content and your OpenRouter API key directly to OpenRouter for that request. PromptReady does not proxy or store the request.

## Launch Contract

- Core capture, cleanup, Markdown export, and JSON export are free.
- Offline mode is local and available without an API key.
- AI cleanup is optional and BYOK-only through OpenRouter.
- BYOK AI cleanup is limited to 5 successful AI cleanups per local day.
- Failed OpenRouter calls do not count against the daily limit.
- Production builds ignore legacy local access state; only development runtime bypass flags can bypass the daily gate.

## Features

### One-Click Web-To-Markdown

- Capture the active tab from the popup or keyboard command.
- Preserve source URL, page title, capture timestamp, and detected publication metadata.
- Export Markdown for prompts and notes, or JSON for downstream processing.
- Keep code fences, inline code, tables, headings, links, and source context intact where the page provides them.

### Offline Mode

- Runs capture, extraction, cleanup, and export inside the extension.
- Works without an OpenRouter key.
- Remains available when AI mode is unavailable, rate-limited, or fails fidelity checks.

### Optional OpenRouter BYOK Cleanup

- Uses your saved OpenRouter key and selected OpenRouter model.
- Sends the cleanup request directly to OpenRouter from the extension.
- Starts from the offline Markdown baseline, then accepts AI output only when it preserves enough source structure.
- Falls back to offline Markdown on missing key, unsupported provider state, OpenRouter errors, or quality-gate failure.

### Deep Capture

- Optional policy for long or lazy-loaded pages.
- Scrolls and waits for the current page to settle before capture.
- Improves current-page snapshots without crawling linked pages.

## Quick Start

```bash
npm install
npm run dev
```

Load the generated development extension from Chrome's extension page.

For a production release artifact:

```bash
npm run build:prod
npm run zip
```

Use `npm run build:prod` for Chrome Web Store packages. The default `npm run build` script is development-oriented and enables dev runtime bypass flags.

## BYOK Self-Check

Use this when you want to verify an OpenRouter key outside the extension UI.

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
export BYOK_CHECK_MODEL="openai/gpt-oss-20b:free"
npm run byok:check
```

## Architecture

```text
entrypoints/
  background.ts          service worker orchestration
  content-runner.ts      active-tab injected capture and clipboard runner
  offscreen/             heavier Markdown and AI processing
  popup/                 React popup UI
content/                 DOM capture implementation
core/                    offline extraction, scoring, and post-processing
lib/                     storage, runtime policy, messages, and contracts
pro/                     direct OpenRouter BYOK client
functions/               legacy/service worker experiments and diagnostics
```

## Verification

Focused release checks:

```bash
npm run test -- tests/entitlement-policy.test.ts tests/byok-client.fallback.test.ts tests/background.byok-usage-idempotency.test.ts tests/ProStatusSettings.test.tsx tests/no-legacy-copy.test.tsx tests/manifest-permissions.test.ts
npm run compile
npm run build:prod
npm run zip
git diff --check
```

The legacy access-state storage key remains in code for backward compatibility, but production entitlement logic ignores it.

## Boundaries

PromptReady is not a crawler, website mirror, server-side content store, provider marketplace, paid-license system, or layout-preserving webpage renderer. The current product boundary is capture, clean, structure, preserve source context, and export.

## Contributing

1. Fork the repository.
2. Create a feature branch with `git switch -c feature/example`.
3. Commit focused changes with tests.
4. Push the branch.
5. Open a pull request.
