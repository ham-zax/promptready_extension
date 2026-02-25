# Verification Baseline

## Purpose
Use these commands during active development while the legacy quality/security suites are being modernized.

## Baseline Commands
1. `npm run compile`
2. `npm run test:smoke`
3. `npm run verify:dev` (wrapper for 1 + 2)

## Smoke Scope
The smoke suite intentionally focuses on currently maintained surfaces:
- popup hooks and BYOK settings UI behavior
- offline processor sanity path
- BYOK proxy CORS and OpenRouter request shaping
- runtime profile validation guards

## Notes
- The full `npm run test` suite currently includes legacy cases that are known to fail and are tracked in Taskmaster modernization tasks.
- Confirm no hardcoded provider keys exist in `functions/ai-proxy/index.ts`; BYOK must come from request settings or worker env secrets.
