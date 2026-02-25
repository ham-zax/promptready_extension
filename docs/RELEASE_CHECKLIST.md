# Release Checklist

## Pre-Release

1. Run `npm run verify:dev` and confirm all checks pass.
2. Optional after interrupted sessions: run `npm run verify:dev:retry` to confirm repeated local smoke stability.
3. Verify `functions/ai-proxy/index.ts` has no hardcoded provider keys and only uses request/env-sourced credentials.
4. Confirm production runtime profile:
   - `premiumBypassEnabled=false`
   - `enforceDeveloperMode=false`
   - `useMockMonetization=false`
   - non-localhost API endpoints
5. Confirm worker env vars:
   - `OPENROUTER_HTTP_REFERER=https://promptready.app`
   - `OPENROUTER_TITLE=PromptReady Extension`
   - production API keys sourced from secrets/env only

## Rollback Verification

1. Keep previous extension package and worker deployment artifact.
2. If rollback is needed:
   - revert extension package to prior tag/build
   - redeploy prior worker revision
3. Re-run `npm run verify:dev` on rollback branch to confirm integrity.
