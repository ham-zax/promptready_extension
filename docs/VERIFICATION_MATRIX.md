# Verification Matrix

## Baseline (Active Development)

| Check | Command | Expected |
|---|---|---|
| Type safety | `npm run compile` | Pass |
| Smoke validation | `npm run test:smoke` | Pass |
| Combined local gate | `npm run verify:dev` | Pass |

## Smoke Coverage

1. Runtime profile guard validation.
2. BYOK proxy CORS behavior and OpenRouter request shaping.
3. Popup hooks/settings behavior for BYOK and entitlement transitions.
4. Offline processor core sanity.

## Legacy Suite Status

- `npm run test` contains legacy suites currently failing and tracked in Taskmaster modernization tasks.
- Use baseline commands above for daily implementation gating until legacy suites are upgraded.
