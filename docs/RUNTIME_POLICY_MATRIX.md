# Runtime Policy Matrix

## Runtime Profiles

| Dimension | Development | Production |
|---|---|---|
| `premiumBypassEnabled` | `true` (default) | `false` |
| `enforceDeveloperMode` | `true` (default) | `false` |
| `useMockMonetization` | `true` (default) | `false` |
| Monetization API base | `http://127.0.0.1:8788` (default) | `https://promptready.app` (default) |
| Trafilatura fallback URL | `http://127.0.0.1:8089` (default) | empty by default |
| BYOK OpenRouter calls | Direct from extension | Direct from extension |
| BYOK daily gate | Development bypass flags may override | 5 successful AI cleanups per local day |

## Enforcement Rules

1. Production profiles cannot enable development bypass toggles.
2. Production profiles cannot point to localhost monetization endpoints.
3. Development profile warnings are emitted if premium bypass or forced dev mode is disabled.
4. Startup self-check is executed in background and offscreen paths.
5. Production ignores legacy local access state when calculating BYOK entitlement.

## Profile Sources

- Runtime config: `lib/runtime-profile.ts`
- Entitlement derivation: `lib/entitlement-policy.ts`
- Storage overrides: `lib/storage.ts`
- Startup guardrails: `entrypoints/background.ts`, `entrypoints/offscreen/enhanced-processor.ts`

## OpenRouter Defaults

- Default model: `arcee-ai/trinity-large-preview:free`
- Recommended attribution headers applied on direct OpenRouter requests:
  - `HTTP-Referer: https://promptready.app`
  - `X-Title: PromptReady Extension`
  - `X-OpenRouter-Title: PromptReady Extension` (compatibility)
