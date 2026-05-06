# How to Release PromptReady

This is the Chrome Web Store release path for the current PromptReady extension.

## Upload Artifact

Do not upload the output of `npm run build`.

Use:

```bash
npm run build:prod
npm run zip
```

Upload this file to Chrome Web Store:

```text
.output/promptready-extension-1.0.0-chrome.zip
```

## Why Not `npm run build`

`npm run build` is a development build in this repo. It enables development runtime flags such as open access, force premium, force developer mode, and mock monetization.

Chrome Web Store releases must use `npm run build:prod`, then `npm run zip`.

## Recommended Release Checks

Run these before packaging:

```bash
npm run compile
npm run verify:dev
npm run release:copy-gate:no-proxy
npm run release:copy-gate:no-stale-launch-copy
git diff --check
```

Then package:

```bash
npm run build:prod
npm run zip
```

Confirm the zip includes the manifest and capture runner:

```bash
unzip -l .output/promptready-extension-1.0.0-chrome.zip | rg "manifest.json|content-runner.js"
```

Confirm the built manifest does not request broad all-site access:

```bash
unzip -p .output/promptready-extension-1.0.0-chrome.zip manifest.json
```

Expected permission shape:

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

## What the Gates Mean

`verify:dev` runs the main local smoke suite: changed-file lint, regex safety checks, TypeScript compile, regex tests, and smoke tests.

`release:copy-gate:no-proxy` fails if public/runtime release surfaces still claim PromptReady proxies OpenRouter BYOK requests.

`release:copy-gate:no-stale-launch-copy` fails if public/runtime release surfaces still contain stale launch or monetization copy such as hosted credits, checkout flow, prelaunch copy, unlimited BYOK, encrypted API key claims, manual provider claims, or broad local-only claims.

`verify:offline` runs the offline extraction corpus. It is useful before shipping extraction-quality changes, but it is not the command that creates the Chrome Store package.

## BYOK Release Contract

- Offline capture and Markdown export run locally.
- BYOK AI cleanup is optional and OpenRouter-only.
- BYOK AI cleanup sends captured content and the user's OpenRouter API key directly to OpenRouter for that request.
- PromptReady does not proxy or store BYOK AI cleanup requests.
- BYOK AI cleanup is limited to 5 successful AI cleanups per local day.
- Failed OpenRouter calls do not count.
- Production ignores legacy local access state; development/runtime bypasses are for testing only.
