# PromptReady Product Requirements

## Status

This document reflects the current Chrome/Chromium release contract. Earlier metered-credit, checkout, proxy, and multi-provider plans are historical and are not part of this release.

## Release Contract

- Core capture, cleanup, Markdown export, and JSON export are free.
- Offline capture and Markdown export run locally.
- AI cleanup is optional and BYOK-only through OpenRouter.
- BYOK AI cleanup sends captured content and the user's OpenRouter API key directly to OpenRouter for that request.
- PromptReady does not proxy or store BYOK AI cleanup requests.
- BYOK AI cleanup is limited to 5 successful AI cleanups per local day.
- Failed OpenRouter calls do not count against the daily limit.
- Production ignores legacy local access state; development/runtime bypass flags may enable testing bypasses.

## User Stories

- As a user, I want one-click active-tab capture so I can turn pages into clean prompt context quickly.
- As a researcher, I want source URL, title, timestamp, and warning metadata so I can verify where captured context came from.
- As a developer, I want code fences, tables, links, lists, and headings preserved where available.
- As a privacy-conscious user, I want offline mode to work without an API key.
- As a BYOK user, I want optional OpenRouter cleanup with a clear daily successful-cleanup limit.
- As a user who hits the BYOK daily limit, I want a clear path back to offline mode and BYOK settings.

## Core Features

- Active-tab capture from the extension popup or command.
- Offline Markdown and JSON export.
- Optional deep capture for long or lazy-loaded pages.
- Optional OpenRouter BYOK AI cleanup over the offline Markdown baseline.
- Offline fallback when OpenRouter is unavailable, the API key is missing, the daily successful-cleanup limit is reached, or AI output fails fidelity checks.

## Non-Goals

- PromptReady-hosted AI credits.
- Paid purchase flow, billing, code-based access, or paid licensing.
- PromptReady BYOK proxying or request storage.
- Unlimited production BYOK access.
- Broad provider marketplace support.
- Persistent all-site host access.

## Release Criteria

- Production build uses `npm run build:prod`.
- Chrome Web Store package uses `npm run zip`.
- Built manifest does not request `<all_urls>`.
- Built manifest requests only the narrow OpenRouter host permission needed for direct BYOK requests.
- Production UI contains no legacy paid-flow, access-code, prelaunch, prerelease, or unmetered BYOK launch copy.
