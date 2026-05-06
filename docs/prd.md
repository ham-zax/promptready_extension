# PromptReady PRD

## Status

This PRD is aligned to the current Chrome/Chromium release. Historical plans for hosted AI credits, paid purchase flow, server-mediated BYOK requests, code-based access, and broad provider support are not part of this release.

## Product Contract

PromptReady captures the active page and turns useful content into clean Markdown and structured JSON for AI prompts, notes, research, and technical work.

- Offline capture and Markdown export run locally.
- Core capture/export is free.
- Optional BYOK AI cleanup uses OpenRouter only.
- When BYOK AI cleanup is enabled, captured content and the user's OpenRouter API key are sent directly to OpenRouter for that request.
- PromptReady does not proxy or store BYOK AI cleanup requests.
- BYOK AI cleanup is limited to 5 successful AI cleanups per local day.
- Failed OpenRouter calls do not count.

## Primary Workflows

1. User opens the popup on the active tab.
2. User captures content in offline mode and gets Markdown/JSON output.
3. User may enable deep capture for long or lazy-loaded pages.
4. User may add an OpenRouter API key and run BYOK AI cleanup.
5. If AI cleanup fails or the daily BYOK limit is reached, offline output remains available.

## Requirements

- Preserve useful structure: headings, lists, links, tables, code fences, inline code, and source metadata where available.
- Keep capture scoped to the active tab after a user gesture.
- Avoid persistent all-site host access.
- Use a narrow OpenRouter host permission for direct BYOK requests.
- Show daily-limit copy as a BYOK AI successful-cleanup limit, not hosted free AI credits.
- Keep development/testing bypass state out of production entitlement behavior.

## Non-Goals

- PromptReady-hosted AI trial credits.
- PromptReady proxying of BYOK requests.
- Paid checkout or billing.
- Unlock-code UX in production.
- Unlimited BYOK claims in production.
- Provider marketplace support beyond OpenRouter.

## Verification

- Production build: `npm run build:prod`
- Package: `npm run zip`
- Core verification: `npm run verify:dev`
- Focused release tests for entitlements, direct OpenRouter BYOK, UI copy, daily-limit counting, and manifest permissions.
