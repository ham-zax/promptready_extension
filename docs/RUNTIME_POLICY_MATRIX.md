# Runtime Policy Matrix

## Runtime Profiles

| Dimension | Development | Production |
|---|---|---|
| `premiumBypassEnabled` | `true` (default) | `false` |
| `enforceDeveloperMode` | `true` (default) | `false` |
| `useMockMonetization` | `true` (default) | `false` |
| Monetization API base | `http://127.0.0.1:8788` (default) | `https://promptready.app` (default) |
| BYOK proxy URL | `http://127.0.0.1:8788/byok/proxy` (default) | `https://promptready.app/api/proxy` (default) |
| Trafilatura fallback URL | `http://127.0.0.1:8089` (default) | empty by default |
| BYOK direct provider calls | Disabled (proxy required) | Disabled (proxy required) |

## Enforcement Rules

1. Production profiles cannot enable development bypass toggles.
2. Production profiles cannot point to localhost monetization/BYOK endpoints.
3. Development profile warnings are emitted if premium bypass or forced dev mode is disabled.
4. Startup self-check is executed in background and offscreen paths.

## Profile Sources

- Runtime config: `lib/runtime-profile.ts`
- Entitlement derivation: `lib/entitlement-policy.ts`
- Storage overrides: `lib/storage.ts`
- Startup guardrails: `entrypoints/background.ts`, `entrypoints/offscreen/enhanced-processor.ts`

## OpenRouter Defaults

- Default model: `arcee-ai/trinity-large-preview:free`
- Recommended attribution headers applied via proxy:
  - `HTTP-Referer: https://promptready.app`
  - `X-Title: PromptReady Extension`
  - `X-OpenRouter-Title: PromptReady Extension` (compatibility)
