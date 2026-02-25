# Reference Notes: OpenRouter Integration

## Sources

1. OpenRouter Quickstart: `https://openrouter.ai/docs/quickstart/index`
2. OpenRouter TypeScript SDK docs: `openrouterteam/typescript-sdk`

## Adopted Patterns

1. Route browser-side BYOK traffic through first-party proxy to avoid CORS/preflight instability.
2. Use OpenRouter chat completions shape:
   - endpoint: `/chat/completions`
   - payload: `model`, `messages`, optional `temperature` and token limits.
3. Include attribution headers for OpenRouter app ranking and traceability:
   - `HTTP-Referer`
   - `X-Title`
   - `X-OpenRouter-Title` compatibility header.

## Anti-Patterns Avoided

1. Direct third-party API calls from extension UI/offscreen context.
2. Scattered hardcoded dev constants across multiple files.
3. Mixed mock/prod monetization imports in runtime codepaths.
