# Chrome Web Store Listing Draft

## Short Description

Turn articles, docs, Reddit-style discussions, research sources, and notes into clean Markdown for AI prompts.

## Description

PromptReady captures the active page and produces clean Markdown plus structured JSON with source context. It is built for articles, technical documentation, code-heavy pages, Reddit-style discussions, research sources, notes, and everyday AI prompt preparation.

Offline capture and Markdown export run locally. Optional BYOK AI cleanup uses your OpenRouter key and sends the captured content directly to OpenRouter for that request. PromptReady does not proxy or store the request.

Core features:

- One-click capture from the active tab.
- Clean Markdown and structured JSON export.
- Source URL, title, timestamp, and warning metadata.
- Code block, table, link, and heading preservation where available.
- Optional deep capture for long or lazy-loaded pages.
- Optional OpenRouter BYOK AI cleanup, limited to 5 successful AI cleanups per local day.
- Offline fallback when OpenRouter is unavailable or AI output fails fidelity checks.

## Permission Rationale

- `activeTab`: grants temporary access to the current tab only after the user invokes PromptReady through the popup or keyboard command.
- `scripting`: injects the capture runner into the active tab after that user gesture.
- `storage`: stores local settings, OpenRouter key, selected model, usage counters, and preferences.
- `downloads`: saves Markdown and JSON export files.
- `clipboardWrite`: copies generated Markdown or JSON to the clipboard.
- `offscreen`: runs heavier Markdown processing in an extension-owned document.
- `https://openrouter.ai/*`: sends optional BYOK AI cleanup requests directly to OpenRouter when the user has configured an OpenRouter API key.

`<all_urls>` is not requested for this release. The current one-click capture path uses `activeTab` plus `scripting`, which is enough for user-initiated active-tab capture. Direct BYOK cleanup uses the narrower OpenRouter host permission instead of broad persistent page access.

## Privacy Notes

PromptReady works locally by default for offline capture and Markdown export. If you enable BYOK AI cleanup, the extension sends the captured content and your OpenRouter API key directly to OpenRouter for that request. PromptReady does not proxy, retain, or sell request content.
