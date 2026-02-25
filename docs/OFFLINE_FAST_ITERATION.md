# Offline Extraction Fast Iteration

This repo now has two repeatable loops:

1. Single-page fast loop (`promptready.app`) for tight tuning.
2. Multi-site corpus loop (PromptReady, MindsDB, Reddit, GitHub) for regression safety.
3. Optional cross-publisher news fixture refresh.

## Primary Commands

```bash
npm run iterate:offline:promptready
npm run iterate:offline:corpus
```

What it does:

- `iterate:offline:promptready`:
- captures PromptReady fixture
- runs `tests/offline-promptready-iteration.test.ts`
- `iterate:offline:corpus`:
- runs `tests/offline-promptready-iteration.test.ts`
- runs `tests/offline-fixture-regression.test.ts`
- runs `tests/offline-news-fixture-regression.test.ts`
- optionally refreshes fixtures before tests (see env vars below)

## Why Rendered Capture Is Default

Many modern pages ship an empty shell (`<div id="root"></div>`) and hydrate content in JS.
Raw HTTP capture can miss real content and produce false negatives in offline extraction tests.

Rendered mode uses headless Chrome:

```bash
google-chrome --headless --disable-gpu --virtual-time-budget=7000 --dump-dom <url>
```

## Script Reference

### Capture any fixture

```bash
npm run capture:fixture -- <url> <output-file>
```

Env vars:

- `OFFLINE_CAPTURE_MODE=rendered|raw` (default: `rendered`)
- `OFFLINE_RENDER_WAIT_MS=<ms>` (default: `7000`)
- `OFFLINE_RENDER_VIEWPORT=<width,height>` (default: `1920,18000`)
- `OFFLINE_RENDER_AUTOTUNE=0|1` (default: `1`)
- `OFFLINE_RENDER_RETRY_VIEWPORT=<width,height>` (default: `1920,30000`)
- `OFFLINE_RENDER_RETRY_WAIT_MS=<ms>` (default: `12000`)

### Refresh core fixtures

```bash
npm run capture:fixtures:core
```

Captures:
- `https://promptready.app/`
- `https://mindsdb.com/`
- `https://old.reddit.com/r/programming/top/?t=month`
- `https://github.com/trending`

### Refresh news fixtures (multi-publisher)

```bash
npm run capture:fixtures:news
```

Captures:
- Times of India liveblog
- BBC News article
- The Guardian article
- Indian Express article
- Al Jazeera article

Default mode is `raw` for news capture (`OFFLINE_CAPTURE_MODE=raw`) since some headless-rendered captures can be unstable.

### PromptReady loop with custom URL or fixture path

```bash
bash scripts/iterate-offline-promptready.sh <url> <fixture-path>
```

Env vars:

- `OFFLINE_SOURCE_TITLE` (default: `PromptReady - One-click clean Markdown from any page`)
- `OFFLINE_CAPTURE_MODE=rendered|raw`
- `OFFLINE_RENDER_WAIT_MS=<ms>`
- `OFFLINE_RENDER_VIEWPORT=<width,height>`
- `OFFLINE_RENDER_AUTOTUNE=0|1`

### Corpus loop with optional fixture refresh

```bash
REFRESH_FIXTURES=1 npm run iterate:offline:corpus
REFRESH_FIXTURES=1 REFRESH_NEWS=1 npm run iterate:offline:corpus
```

Env vars:
- `REFRESH_FIXTURES=1`: refresh core fixtures before tests
- `REFRESH_NEWS=1`: refresh news fixtures before tests
- `OFFLINE_CAPTURE_MODE=rendered|raw`
- `OFFLINE_RENDER_WAIT_MS=<ms>`
- `OFFLINE_RENDER_AUTOTUNE=0|1`

## Troubleshooting

- If output says content is sanitized or empty, check if fixture was captured in `raw` mode.
- If the fixture only contains `<div id="root"></div>`, rerun with rendered mode:

```bash
OFFLINE_CAPTURE_MODE=rendered npm run iterate:offline:promptready
```

- If capture is flaky, increase wait budget:

```bash
OFFLINE_RENDER_WAIT_MS=12000 npm run iterate:offline:promptready
```

- If sections are lazy-loaded only when in view, increase rendered viewport height:

```bash
OFFLINE_RENDER_VIEWPORT=1920,16000 npm run iterate:offline:promptready
```

- If lazy placeholders still dominate a rendered capture, force a stronger retry pass:

```bash
OFFLINE_RENDER_AUTOTUNE=1 OFFLINE_RENDER_RETRY_VIEWPORT=1920,30000 OFFLINE_RENDER_RETRY_WAIT_MS=12000 npm run iterate:offline:promptready
```

- If rendered capture fails for a domain, retry in raw mode:

```bash
OFFLINE_CAPTURE_MODE=raw npm run capture:fixtures:news
```
