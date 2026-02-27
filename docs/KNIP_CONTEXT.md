# Knip Context & Triage Guide

## Purpose

This document captures the current Knip setup and findings so future agents can continue cleanup without re-discovering context.

## Current Knip Setup

- Command: `npm run knip` (runs `knip`)
- Config file: [`knip.json`](/home/hamza/repo/promptready_extension/knip.json)
- Config strategy implemented:
  - Explicit `entry` patterns for WXT extension entrypoints, scripts, Cloudflare functions, and tests.
  - Explicit `project` boundaries instead of broad `ignore`.
  - `ignoreBinaries` for intentionally optional CLI binaries (`prettier`, `commitlint`).
  - `rules` set so `exports/types/duplicates/enumMembers` are warnings (printed, not counted as failures).
  - `ignoreExportsUsedInFile` for `interface` and `type`.

## Latest Knip Run (Snapshot)

Command:

```bash
npm run knip
```

Result:

- Exit code: `0`
- Current report is warning-only:
  - Unused exports
  - Unused exported types
  - Duplicate exports
- No blocking dependency/file findings in current `knip` gate.

### Current Warning Set

- Unused exports: `18`
- Unused exported types: `20`
- Duplicate exports: `2`

### Notable Config Exceptions (Intentional)

- `ignoreDependencies` includes:
  - `@tailwindcss/vite`
  - `@wxt-dev/module-react`
  - `dompurify`
  - `wrangler`
- `dompurify` is intentionally retained for upcoming DOM sanitizer integration.

## High-Confidence vs Needs Review

### High-confidence actions

1. Keep warning-only policy while finishing extractor stabilization work.
2. Keep quarantined files under `archive/knip-quarantine/` (do not delete) until explicit owner decision.
3. Keep `dompurify` dependency installed and documented for planned sanitizer adapter rollout.

### Needs verification before deletion

1. `@wxt-dev/module-react` may still be required by WXT module loading even if Knip cannot infer dynamic usage from config.
2. `@tailwindcss/vite` may still be required by `wxt.config.ts` plugin chain.
3. `wrangler` may be retained for Cloudflare function workflows/manual deploy scripts.
4. Quarantined files may be reintroduced by UI/runtime teams; keep archive as reversible source.

## TODO

1. Add a dedicated sanitizer adapter (port + adapter) that uses `dompurify` only in DOM-capable contexts.
2. Replace broad markdown regex sanitization with layered HTML sanitization where safe.
3. Burn down warning-only exports/types list in small deterministic batches (with tests).
4. Add a Knip production-mode CI lane (`knip --production`) once current warning set is stabilized.

## Recommended Next Workflow

1. Focus by issue type:
   - `knip --files`
   - `knip --dependencies`
2. Validate each candidate before delete:
   - Search usage (`rg`) including dynamic paths/scripts/config.
   - If intended but dynamically referenced, add minimal Knip exception (`ignoreDependencies`/entry pattern), not broad ignore.
3. Prefer small batched fixes:
   - Delete 2–5 files/deps
   - Run `npm run knip`, `npm run lint:all`, `npm run compile`, targeted tests
4. Use auto-fix cautiously:
   - Optional: `knip --fix --fix-type exports,types`
   - Avoid `--allow-remove-files` until manual verification is complete.

## Reference URLs Used

- https://knip.dev/overview/getting-started
- https://knip.dev/overview/configuration
- https://knip.dev/explanations/entry-files
- https://knip.dev/features/production-mode
- https://knip.dev/features/monorepos-and-workspaces
- https://knip.dev/features/rules-and-filters
- https://knip.dev/features/auto-fix
- https://knip.dev/features/compilers
- https://knip.dev/features/reporters-and-preprocessors
- https://knip.dev/features/script-parser
- https://knip.dev/guides/configuring-project-files
- https://knip.dev/guides/handling-issues
- https://knip.dev/reference/configuration-hints
