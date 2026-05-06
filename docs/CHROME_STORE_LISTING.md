# Chrome Web Store Upload Sheet

Use this file when filling out the Chrome Web Store Developer Dashboard for PromptReady. It is written to match the current Chrome/Chromium release contract:

- core capture, cleanup, Markdown export, and JSON export are free;
- offline capture and Markdown export run locally;
- BYOK AI cleanup is optional and OpenRouter-only;
- BYOK AI cleanup sends captured content and the user's OpenRouter API key directly to OpenRouter for that request;
- BYOK AI cleanup is limited to 5 successful AI cleanups per local day;
- failed OpenRouter calls do not count;
- production ignores legacy local access state.

Do not paste old hosted-credit, paid purchase, server-mediated request, broad provider, or broad local-only claims into the store listing.

## Product Details

### Title

```text
PromptReady
```
### Summary

Chrome shows this as the short summary. Keep it under the store limit.

```text
Clean and structure webpage content into prompt-ready formats with citations
```

Alternative broader summary:

```text
Turn articles, docs, Reddit-style discussions, research sources, and notes into clean Markdown for AI prompts.
```

### Description

Paste this into the required description field.

```text
PromptReady turns active webpages into clean, source-aware Markdown and structured JSON for prompts, notes, research, and documentation workflows.

Use it on articles, technical docs, code-heavy pages, Reddit-style discussions, research sources, wiki-style pages, and everyday prompt context. PromptReady removes common page clutter while preserving useful structure such as headings, links, tables, code blocks, source URL, title, capture time, and warning metadata.

Core features:

- One-click capture from the active tab.
- Clean Markdown export for prompts and notes.
- Structured JSON export for downstream workflows.
- Source URL, page title, capture timestamp, selection hash, and warning metadata.
- Heading, list, table, link, and code-block preservation where available.
- Optional deep capture for long or lazy-loaded pages.
- Offline mode for local capture, extraction, cleanup, copy, save, and export.
- Optional BYOK AI cleanup through OpenRouter.
- Local daily BYOK limit of 5 successful AI cleanups per local day.
- Failed OpenRouter calls do not count against the daily BYOK limit.
- Offline fallback when OpenRouter is unavailable or AI output fails fidelity checks.

Privacy and AI behavior:

PromptReady works locally by default for offline capture and Markdown export. If you enable BYOK AI cleanup, the extension sends the captured content and your OpenRouter API key directly to OpenRouter for that request. PromptReady does not proxy, retain, or sell request content.

PromptReady is not a crawler, website mirror, server-side content store, paid license system, or layout-preserving webpage renderer. It is focused on turning the active page into useful Markdown or JSON with source context.
```

### Category

Recommended:

```text
Productivity
```

Reason: PromptReady is primarily a capture, cleanup, export, and prompt-preparation tool. It is closer to productivity/research workflow than developer tooling alone.

### Language

Recommended:

```text
English
```

### Mature Content

Recommended:

```text
No
```

Reason: the extension processes the user's active page but does not provide mature content itself.

## Additional Fields

### Official URL

If `promptready.app` is verified in Google Search Console for this publisher account, select it from the Official URL dropdown.

If it is not verified yet, leave this as:

```text
None
```

### Homepage URL

Use this if the public website is release-ready and has the Chrome Store install CTA configured:

```text
https://promptready.app/
```

If the website still contains stale prelaunch copy, leave the homepage blank until it is fixed.

### Support URL

Use the public support or contact page when available:

```text
https://promptready.app/support
```

If there is no support page yet, use the homepage only if it includes a clear support/contact route. Otherwise leave this blank and add support before final submission.

## Graphic Assets

### Store Icon

Upload the 128x128 extension icon from the production build or source icon folder.

Expected build output after `npm run build:prod`:

```text
.output/chrome-mv3/icon/128.png
```

### Screenshots

Prepare screenshots that show the real extension flow:

- popup on a webpage with Offline mode selected;
- successful Markdown output with source metadata;
- BYOK settings showing OpenRouter key/model setup without exposing a real key;
- daily BYOK limit state if you want to show the limit behavior;
- optional export format controls.

Do not use screenshots that show development-only access flags, local test endpoints, fake paid flows, or old prelaunch copy.

### Promo Tile

Optional for initial submission. If provided, keep the promise simple:

```text
Clean web pages into prompt-ready Markdown.
```

## Privacy Tab

Use precise wording. Do not say "everything stays local."

### Single Purpose

```text
PromptReady captures the user-invoked active webpage and converts useful page content into clean Markdown or structured JSON with source metadata for prompts, notes, research, and documentation workflows.
```

### Permission Justification

```text
activeTab: Grants temporary access to the current tab only after the user invokes PromptReady from the popup or keyboard command.

scripting: Injects the capture runner into the active tab after the user gesture so PromptReady can read the current page content.

storage: Stores local settings, selected mode, OpenRouter API key, selected model, local BYOK usage counters, and export preferences.

downloads: Saves Markdown and JSON export files when the user chooses a download action.

clipboardWrite: Copies generated Markdown or JSON to the clipboard when the user chooses a copy action.

offscreen: Runs heavier Markdown processing in an extension-owned offscreen document to keep the popup responsive.

https://openrouter.ai/*: Sends optional BYOK AI cleanup requests directly to OpenRouter when the user has configured an OpenRouter API key.
```

### Host Permission Note

```text
PromptReady does not request broad all-site host access for this release. User-initiated capture uses activeTab plus scripting. Optional BYOK AI cleanup uses the narrow https://openrouter.ai/* host permission for direct OpenRouter requests.
```

### Data Usage Disclosure

Suggested answers for the privacy form:

- Website content: collected only when the user invokes capture on the active tab.
- Authentication information: the user may store an OpenRouter API key locally for optional BYOK AI cleanup.
- User activity: local usage counters are stored for the daily BYOK limit.
- Personally identifiable information: not intentionally collected by PromptReady, but captured page content may contain personal information depending on the page the user chooses to process.

Suggested disclosure text:

```text
Offline capture and Markdown export run locally in the extension. If BYOK AI cleanup is enabled, the extension sends the captured content and the user's OpenRouter API key directly to OpenRouter for that request. PromptReady does not retain or sell request content, and the request does not route through PromptReady servers. The OpenRouter key, selected model, preferences, and local daily usage counters are stored in extension local storage.
```

### Remote Code

Recommended answer:

```text
No remote code is executed. Optional BYOK AI cleanup sends request data to OpenRouter and receives generated text, but executable extension code is bundled in the extension package.
```

## Item Support

Recommended visibility:

```text
On
```

Only enable this after a support/contact page or support email is ready for users.

## Test Instructions For Reviewers

Paste this into the dashboard test instructions field if requested.

```text
1. Install PromptReady and open any normal webpage, article, or documentation page.
2. Click the PromptReady toolbar icon.
3. Use Offline mode and click Capture Content.
4. Verify the extension produces Markdown with source metadata.
5. Use copy or download to export Markdown or JSON.
6. Optional AI cleanup requires the reviewer to provide their own OpenRouter API key in BYOK settings. PromptReady does not provide hosted AI credits. BYOK AI cleanup is limited to 5 successful AI cleanups per local day, and failed OpenRouter calls do not count.
```

## Package Upload Checklist

Do not upload the development build.

Run:

```bash
npm run compile
npm run verify:dev
npm run release:copy-gate:no-proxy
npm run release:copy-gate:no-stale-launch-copy
git diff --check
npm run build:prod
npm run zip
```

Upload:

```text
.output/promptready-extension-1.0.0-chrome.zip
```

Confirm the zip includes the capture runner:

```bash
unzip -l .output/promptready-extension-1.0.0-chrome.zip | rg "manifest.json|content-runner.js"
```

Confirm the built manifest has the expected narrow permission shape:

```bash
unzip -p .output/promptready-extension-1.0.0-chrome.zip manifest.json
```

Expected:

```json
{
  "permissions": [
    "activeTab",
    "storage",
    "scripting",
    "downloads",
    "clipboardWrite",
    "offscreen"
  ],
  "host_permissions": [
    "https://openrouter.ai/*"
  ]
}
```
