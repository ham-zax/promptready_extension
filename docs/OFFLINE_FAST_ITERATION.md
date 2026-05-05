# Offline Extraction Fast Iteration

This repo now has two repeatable loops:

1. Single-page fast loop (`promptready.app`) for tight tuning.
2. Multi-site website corpus loop (portfolio, Reddit, docs, GitHub, news, landing pages) for regression safety.
3. Optional cross-publisher news fixture refresh.

## Primary Commands

```bash
npm run iterate:offline:promptready
npm run iterate:offline:corpus
npm run test:offline:website-corpus
npm run verify:offline:website-corpus
```

By default the iteration scripts also dump the extracted Markdown outputs to:

- `output/offline-dumps/`

Override or disable by setting:

- `OFFLINE_DUMP_DIR=<path>` (set to empty to disable dumps)

What it does:

- `iterate:offline:promptready`:
  - captures PromptReady fixture
  - runs `tests/offline-promptready-iteration.test.ts`
- `iterate:offline:corpus`:
  - runs `tests/offline-promptready-iteration.test.ts`
  - runs manifest-backed website fixtures through `tests/offline-fixture-regression.test.ts`
  - runs `tests/offline-news-fixture-regression.test.ts`
  - optionally refreshes fixtures before tests (see env vars below)
- `test:offline:website-corpus`:
  - reads pinned checked-in fixtures from `tests/fixtures/offline-websites/manifest.json`
  - does not download live websites
  - runs the same local offline extraction seam used by the extension's offline processor
- `verify:offline:website-corpus`:
  - runs changed-file lint, TypeScript compile, and the pinned website corpus tests

Compatibility aliases:

- `test:offline:websites` and `test:offline:corpus` run the same website corpus test.
- `capture:fixtures:websites` and `capture:fixtures:website-corpus` run the same optional corpus refresh script.

## Website Corpus Contract

Normal tests never download websites. The website corpus is a pinned fixture gate:

- manifest: `tests/fixtures/offline-websites/manifest.json`
- shared assertions: `tests/helpers/offline-website-harness.ts`
- synthetic portfolio fixture: `tests/fixtures/offline-websites/portfolio-landing.html`
- reused public captures: `tests/fixtures/offline-corpus/*.html`

Each manifest case declares the source URL, checked-in fixture path, required snippets,
forbidden snippets, quality floor, optional strategy/page-type expectations, and optional
refresh metadata. Tests read only `fixturePath`; they do not call the network.

The gate verifies PromptReady Markdown fidelity, not pixel or layout parity. Each fixture
is processed through `OfflineModeManager.getOptimalConfig(url)` and
`OfflineModeManager.processContent(...)`; the resulting Markdown must preserve the page's
important text, headings, links, forms, code blocks, or thread content declared by
`requiredSnippets`, while removing known clutter declared by `forbiddenSnippets`.

The PR9 corpus keeps the original offline regression coverage and adds pinned
portfolio and Reddit thread fixtures: Wikipedia-style article, docs/code-heavy,
news/article, forum thread, GitHub trending, generic landing, MindsDB landing,
old Reddit listing, Reddit thread, and portfolio landing. Deep Reddit JSON recovery
remains covered by `tests/reddit-thread-fidelity.test.ts`.

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

### Refresh website corpus fixtures

```bash
npm run capture:fixtures:websites -- --case github-trending
npm run capture:fixtures:websites -- --all
npm run capture:fixtures:websites -- --all --dry-run
npm run capture:fixtures:website-corpus -- --all --dry-run
```

Only manifest cases with `"capture": { "enabled": true }` are refreshable. Synthetic
or manual-auth fixtures, such as portfolio/Facebook-like pages, should stay pinned and
checked in by hand. Browser smoke coverage is optional and must not be part of default CI.

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
- `OFFLINE_DUMP_DIR=<path>` (default: `output/offline-dumps`)

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
- `OFFLINE_DUMP_DIR=<path>` (default: `output/offline-dumps`)

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
