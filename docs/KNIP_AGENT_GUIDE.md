# Knip Agent Guide

## Scope

This guide is for agents working on code health in this repository. It explains how to run Knip, how to interpret results, and how to edit `knip.json` safely without creating configuration drift.

Use this together with [`docs/KNIP_CONTEXT.md`](/home/hamza/repo/promptready_extension/docs/KNIP_CONTEXT.md), which tracks the latest snapshot of findings.

## Quick Start

Run full report:

```bash
npm run knip
```

Run production-focused report (recommended for runtime cleanup passes):

```bash
npm run knip -- --production
```

Slice by issue type:

```bash
npm run knip -- --files
npm run knip -- --dependencies
npm run knip -- --include exports,types
```

Machine-readable output:

```bash
npm run knip -- --reporter json
```

## Current Config Shape

File: [`knip.json`](/home/hamza/repo/promptready_extension/knip.json)

Primary keys in use:

- `entry`: explicit runtime/test/tool entry roots.
- `project`: project boundaries Knip analyzes.
- `ignoreBinaries`: binaries intentionally not installed directly.
- `ignoreDependencies`: explicit dynamic/intentional deps that Knip cannot infer yet.
- `rules`: issue severity shaping (`error`/`warn`/`off`).
- `ignoreExportsUsedInFile`: suppresses local-only type/interface noise.
- `tags`: repo tag conventions (`-lintignore`).

### Why this shape

1. `entry` + `project` are the authoritative boundary controls.
2. `ignore*` is for narrow exceptions, not broad exclusion.
3. `rules` is preferred for phased cleanup (visible but non-blocking findings).

## Configuration Rules for Agents

1. Keep `entry` minimal and explicit.
2. Keep `project` broad enough for real source ownership.
3. Do not add broad `ignoreFiles` unless absolutely required.
4. Prefer fixing root cause over ignoring findings.
5. If a dependency is dynamically required and Knip cannot infer it, use targeted `ignoreDependencies` with a comment in PR notes.

Current intentional exceptions include `dompurify` (retained for upcoming DOM sanitizer adapter integration).

## How to Handle Knip Findings

### 1) Unused files

Process:

1. Verify with `rg` imports/usages.
2. If truly dead: delete file.
3. If dynamically loaded: add explicit entry pattern, not broad ignore.
4. Re-run `knip`, `lint`, `compile`, and relevant tests.

### 2) Unused dependencies

Process:

1. Confirm no imports/usages in runtime/tests/config/scripts.
2. Remove from `package.json`.
3. Reinstall lockfile (`npm install`).
4. Re-run `knip`.

### 3) Unlisted dependencies

If a module is imported (e.g. from `eslint.config.js`) and not listed:

1. Add it to `dependencies`/`devDependencies` appropriately.
2. Re-run `npm run knip`.

### 4) Exports/types noise

Prefer explicit de-exports/removals in small batches.  
Only suppress with `rules` when doing phased cleanup.

## Production Mode Guidance

Use production mode for "runtime truth":

```bash
npm run knip -- --production
```

Notes:

- Don’t attempt to exclude tests using `ignore`.
- Use production mode first, then tune boundaries if needed.

## Safe Autofix Workflow

Autofix can be useful but should be scoped:

```bash
npm run knip -- --fix --fix-type exports,types
```

Avoid destructive file removals unless manually verified:

```bash
npm run knip -- --fix --allow-remove-files
```

Only use `--allow-remove-files` after a manual review in Git diff.

## Recommended Agent Loop

1. `npm run knip -- --production`
2. Fix highest-confidence unused files/deps in small batch.
3. `npm run knip`
4. `npm run lint:all`
5. `npm run compile`
6. Run targeted tests for touched modules.
7. Commit with focused message.

## Output Discipline

When reporting Knip status in agent summaries:

1. Include command used (`knip`, `knip --production`, filters).
2. Include exit code.
3. Separate blockers (`files/dependencies/unlisted`) from warnings (`exports/types`).
4. Include exact file/package names for blockers.

## TODO Queue (Agent-Owned)

1. Implement a `dompurify` adapter behind a sanitization port and wire it only in DOM-capable extraction paths.
2. Reduce warning-only `exports/types` counts without changing public contracts accidentally.
3. Re-validate quarantine candidates in `archive/knip-quarantine/` before any permanent deletion proposal.
