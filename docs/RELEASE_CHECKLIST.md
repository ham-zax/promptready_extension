# Release Checklist

For the exact Chrome Web Store packaging path, see `docs/HOW_TO_RELEASE.md`.

## Pre-Release

1. Run `npm run verify:dev` and confirm all checks pass.
2. Optional after interrupted sessions: run `npm run verify:dev:retry` to confirm repeated local smoke stability.
3. Run `npm run verify:offline` and confirm offline corpus checks pass.
4. Run `npm run build:prod`, then `npm run zip`. Do not package the dev `npm run build` artifact for Chrome Web Store.
5. Confirm production runtime profile:
   - `premiumBypassEnabled=false`
   - `enforceDeveloperMode=false`
   - `useMockMonetization=false`
   - non-localhost API endpoints
6. Confirm BYOK release behavior:
   - OpenRouter is the only supported BYOK provider.
   - BYOK requests go directly from the extension to OpenRouter.
   - PromptReady does not proxy or store BYOK request content.
   - The limit is 5 successful AI cleanups per local day.
   - Failed BYOK calls do not count.
   - Production ignores legacy local access state.
7. Run the release copy gates from the release plan for stale request-routing and launch-copy claims.
8. Run `git diff --check`.

## Rollback Verification

1. Keep previous extension package and worker deployment artifact.
2. If rollback is needed:
   - revert extension package to prior tag/build
   - redeploy prior worker revision
3. Re-run `npm run verify:dev` on rollback branch to confirm integrity.
