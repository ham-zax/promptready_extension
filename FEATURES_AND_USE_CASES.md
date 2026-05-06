# PromptReady Features, Use Cases, and Differentiators

This document inventories what PromptReady does, where it is useful, and what it does differently from generic webpage clippers, summarizers, or AI-first extraction tools.

It is intentionally product-facing but implementation-aware. Runtime behavior remains defined by the extension code, tests, and focused docs such as `docs/OFFLINE_FAST_ITERATION.md`, `docs/RUNTIME_POLICY_MATRIX.md`, and `README.md`.

## One-Line Positioning

PromptReady is an offline-first browser extension that captures webpages and turns them into stable, prompt-ready Markdown, with optional BYOK OpenRouter cleanup gated by local fallback and fidelity checks.

## What PromptReady Is

PromptReady is a WXT + React Chrome extension for capturing web content, cleaning it, structuring it, and exporting it as reusable Markdown or JSON.

The core promise is not "AI rewrites any page." The promise is reliable web-to-Markdown conversion:

- capture the selected page or page region from the browser,
- preserve source metadata and attribution,
- produce useful Markdown locally by default,
- optionally ask AI to clean an already-strong offline baseline,
- fall back to offline output when AI is unavailable, blocked, or lower fidelity,
- export content in formats that are ready for LLM prompts, notes, docs, or review.

Offline capture and Markdown export run locally. If BYOK AI cleanup is enabled, PromptReady sends captured content and the user's OpenRouter API key directly to OpenRouter for that request. PromptReady does not proxy or store the request.

## What PromptReady Is Not

PromptReady deliberately avoids several tempting expansions:

- It is not a general web scraper, crawler, or website mirroring tool.
- It is not a live website downloader during normal CI tests.
- It is not a server-side content storage system.
- It is not a license-enforced SaaS billing system yet.
- It is not an AI provider marketplace; OpenRouter is the canonical BYOK provider.
- It is not a promise of pixel-perfect website reproduction.
- It is not a replacement for human review of generated Markdown.

The product boundary is narrow by design: capture, clean, structure, preserve source context, and export.

## Major Capabilities

### 1. Offline-First Webpage Capture

PromptReady captures content inside the browser extension boundary and processes it locally before any optional AI step.

The offline path handles:

- selected content and full-page captures,
- DOM sanitization and source URL normalization,
- metadata HTML capture for timestamps and bylines,
- readability-style extraction plus fallback strategies,
- Markdown cleanup and canonicalization,
- stable citation-first source blocks.

Why it matters:

- Users can capture private or sensitive pages without sending content to an AI provider.
- Offline output remains available when API keys, models, network calls, or AI quality checks fail.
- The extension has a deterministic baseline for tests and AI comparison.

### 2. Dual Offline and AI Processing Modes

PromptReady exposes two processing modes:

- Offline mode: always-local capture, extraction, cleanup, and export.
- AI mode: BYOK OpenRouter cleanup layered on top of the offline Markdown baseline.

AI mode does not treat raw webpage HTML as the only source of truth. It first prepares offline Markdown, injects that baseline into the AI prompt contract, post-processes the AI result, and checks whether the AI output preserved enough of the offline baseline.

If AI output fails fidelity checks, PromptReady returns the offline Markdown with stable fallback warnings instead of shipping degraded AI text.

### 3. BYOK OpenRouter Flow

PromptReady's current BYOK flow is OpenRouter-first:

- OpenRouter is the canonical provider.
- Legacy provider aliases can normalize to OpenRouter where supported.
- Unsupported provider values fall back to offline output.
- The model picker can fetch OpenRouter models dynamically.
- Free-first model selection helps users avoid accidental paid model usage.
- Users can refresh the model list or enter compatible model IDs when needed.

The runtime includes OpenAI-compatible plumbing for OpenRouter-style requests, but the current product contract should be described as OpenRouter BYOK rather than broad first-class Anthropic/OpenAI provider support.

### 4. Local Daily BYOK Gate

PromptReady uses a local freemium gate for BYOK AI mode:

- Offline mode remains free.
- BYOK AI mode allows 5 successful AI cleanups per local day.
- Successful AI runs are counted locally.
- Failed OpenRouter calls do not count.
- Production ignores legacy local access state.

This release does not include paid billing, server-verified licensing, or a provider marketplace.

### 5. Deep Capture Policy

PromptReady includes a deep capture policy for dynamic or lazy-loaded pages.

When enabled by policy, the content script can scroll through the page, wait for the DOM to settle, and capture a sanitized snapshot after more content has loaded. This helps pages whose useful text appears only after hydration, lazy loading, or progressive rendering.

Deep capture is still a capture policy, not a crawler. It improves the current page snapshot; it does not navigate across the site or download linked pages.

### 6. Source Metadata and Stable Export Context

PromptReady preserves source context in both Markdown and JSON outputs.

The export surface includes:

- title,
- source URL,
- captured timestamp,
- selection hash,
- detected publish/update timestamps where available,
- byline where available,
- warning codes for degraded or fallback paths.

This metadata makes outputs easier to audit, cite, compare, and re-run through downstream LLM or note-taking workflows.

### 7. Markdown and JSON Export

PromptReady supports user-facing copy, save, and export flows for processed content.

The core export contract is:

- Markdown for prompt-ready text and notes,
- JSON for structured downstream processing,
- source metadata attached to the exported payload,
- warnings attached when output used fallback or degraded paths.

The export goal is durable content fidelity, not preserving the browser's visual layout.

### 8. Technical Markdown Preservation

PromptReady has focused cleanup for technical pages where generic clipping often fails.

The Markdown pipeline works to preserve:

- code fences,
- inline code spacing,
- headings,
- links,
- tables,
- docs pages,
- GitHub-like pages,
- news/article pages,
- Reddit-like listing and thread outputs.

This matters for developers capturing SDK docs, GitHub pages, code-heavy articles, MCP config snippets, command blocks, and troubleshooting guides where token loss or broken fences can make the output unusable.

### 9. Offline Website Corpus and Report Loop

PromptReady includes a pinned offline website corpus for regression safety.

The corpus covers real website classes such as:

- documentation and code-heavy pages,
- news and article pages,
- forum and Reddit-like pages,
- GitHub-style pages,
- generic landing pages,
- PromptReady-specific fixtures.

Normal tests read checked-in fixtures and do not download live websites. The repo also includes explicit refresh and report commands for maintainers who need to update fixtures or manually inspect extraction quality.

### 10. Runtime Profiles and Policy Separation

PromptReady separates development and production runtime policy.

Development profiles can use local endpoints, mock monetization, and bypass toggles for iteration. Production profiles reject development-only settings such as localhost monetization endpoints or forced developer-mode bypasses.

This keeps test and development ergonomics separate from production extension behavior.

## Primary Use Cases

### Developers Capturing Technical Context

Developers can capture docs, GitHub pages, SDK examples, API references, command snippets, and code-heavy technical articles into Markdown that is suitable for LLM prompts or engineering notes.

Useful when:

- collecting context for an implementation task,
- preserving command/config blocks,
- comparing docs against code,
- preparing focused prompt material without page chrome.

### Researchers Cleaning Long Webpages

Researchers can turn long articles, news pages, wiki-style pages, and forum threads into clean Markdown with source attribution.

Useful when:

- building reading notes,
- preparing LLM context from multiple pages,
- keeping publication metadata visible,
- removing navigation, ads, and repeated page furniture.

### Writers and Operators Creating Reusable Notes

Writers, operators, and product teams can convert web pages into reusable Markdown notes or structured JSON without manually copying around page clutter.

Useful when:

- collecting competitive research,
- turning support pages into internal notes,
- drafting summaries from source material,
- preserving provenance for later review.

### Privacy-Sensitive Offline Capture

Users who do not want to send page content to AI can stay in Offline mode.

Useful when:

- capturing internal tools,
- working with personal or sensitive pages,
- operating without an API key,
- needing deterministic local behavior.

### BYOK Users Who Want Optional AI Cleanup

BYOK users can add AI cleanup while retaining the offline fallback path.

Useful when:

- the offline output is good but needs lighter restructuring,
- a user wants to use their own OpenRouter account,
- the selected model fails or produces degraded Markdown,
- the user wants to compare AI cleanup against a local baseline.

### Maintainers Validating Extraction Quality

Maintainers can use the offline corpus and report loop to catch extraction regressions across pinned website fixtures.

Useful when:

- changing Markdown cleanup,
- changing readability/fallback heuristics,
- tuning Reddit, docs, GitHub, or news extraction,
- refreshing fixture captures intentionally.

## Differentiators

### Offline Baseline Is the Source of Truth

PromptReady's AI mode starts from offline Markdown, not from blind faith in model output.

This gives the system a stable local result to compare against and a usable fallback when AI fails.

### AI Output Is Quality-Gated

AI output is accepted only when it preserves enough structure and content from the offline baseline. If it loses important headings, code fences, or source content, PromptReady can return the offline Markdown instead.

### Deterministic Fixture Corpus Catches Regressions

The offline website corpus uses checked-in fixtures and deterministic assertions. Normal tests do not fetch live websites, which makes extraction regressions easier to reproduce.

### Browser Extension Boundaries Are Explicit

PromptReady separates responsibilities across extension surfaces:

- content script for capture,
- background service worker for orchestration,
- offscreen processor for heavier processing,
- popup UI for controls and export flows,
- direct OpenRouter BYOK calls only when users enable AI cleanup.

This keeps browser security constraints visible instead of hiding them behind generic "web scraper" language.

### Narrow Product Boundary

PromptReady is intentionally scoped to capture, clean, structure, and export webpage content.

That narrow boundary makes the product easier to reason about, test, and improve without turning it into a crawler, note database, billing backend, or general AI workspace.

## Validation and Testing Surface

PromptReady's current validation surface includes:

- TypeScript compile checks through `npm run compile`.
- Changed-file linting through `npm run lint:changed`.
- Smoke coverage through `npm run test:smoke`.
- BYOK self-check and manual comparison commands.
- Offline promptready fixture checks.
- Offline website manifest validation.
- Offline website corpus regression tests.
- Offline news fixture regression tests.
- Generated website corpus docs via `npm run docs:offline:websites`.
- Manual corpus reports via `npm run report:offline:websites`.

The offline website contract is explicit: normal tests use pinned fixtures, not live website downloads. Live or rendered capture belongs to intentional fixture refresh workflows.

## Current Boundaries and Non-Goals

- PromptReady does not claim 150 monthly AI credits as current behavior.
- PromptReady does not currently enforce server-verified licensing.
- PromptReady does not claim first-class provider support beyond OpenRouter BYOK.
- PromptReady does not proxy or store BYOK AI cleanup requests.
- PromptReady does not guarantee pixel-perfect website or layout preservation.
- PromptReady does not crawl linked pages or mirror websites.
- PromptReady does not store user content on a server as part of the normal extension workflow.
- PromptReady does not replace human review for sensitive, legal, medical, financial, or publication-critical Markdown.
- PromptReady's quality bar is stable PromptReady Markdown fidelity: source context, headings, links, code blocks, key text, and exportable structure.
