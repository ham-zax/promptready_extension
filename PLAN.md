# Plan: Offline Free + BYOK Freemium (5/day) + One-Time Unlock + Custom Prompt

## Context
- Product direction confirmed:
  1. **Offline mode** is always free.
  2. **BYOK mode** supports freemium allowance (**5 successful AI uses/day**, resets by **local calendar day**) and then **unlimited** usage after a **one-time external payment** (~$2–$3).
  3. BYOK includes a **custom prompt option**.
  4. Unlock flow is **Option B**: user enters an unlock code (from purchase receipt).
  5. Checkout URL is not ready yet, so UI uses a **placeholder checkout URL** for now.
- Codebase findings:
  - Trial/credits model is still wired in runtime/UI (`usePopupController`, `Popup.tsx`, `ProUpgradePrompt`, `useProManager`, `MonetizationClient`).
  - `SimplifiedByokSetup` currently sets `isPro: true` immediately when key is saved (no payment gate).
  - BYOK processing path already exists and is centralized in `entrypoints/offscreen/enhanced-processor.ts` via `buildByokPrompt(...)` + `BYOKClient.makeRequest(...)`.
  - No real checkout/licensing integration exists yet (only placeholder “upgrade” UI links).
  - Successful AI outcomes already flow through `entrypoints/background.ts -> handleProcessingComplete(...)` with `aiOutcome`, which is the safest place to increment daily BYOK usage counters.
  - Trial UX is still explicitly mounted in settings/popup (`UnifiedSettings` renders `ProUpgradePrompt`, `Popup.tsx` renders upgrade modal + “out of credits” messaging).
  - Type unions for AI fallback outcomes are already centralized in `lib/types.ts` and reused by `offscreen`, `background`, and popup hooks; adding a new daily-limit fallback code should be done there first.

## Approach
- **Recommended approach**: ship a deterministic local-first monetization model now, with these access rules:
  - Offline: always available.
  - AI/BYOK: requires API key.
  - If not unlocked: allow up to **5 successful AI completions/day**.
  - If unlocked (local unlock code accepted): unlimited BYOK usage.
- Unlock implementation (current phase):
  - Add an unlock code entry UI.
  - Validate code locally using a placeholder verifier (deterministic local check) and persist unlocked state.
  - Provide placeholder checkout link in UI (`https://example.com/promptready-checkout` until real URL exists).
- Keep enforcement centralized and deterministic:
  - **Primary access SSOT** in `resolveEntitlements`.
  - **Hard runtime guard** in `processAIMode` (fallback to offline with stable warning code when daily limit reached).
  - **Success counting is idempotent** in background using `runId` + `countedSuccessIds` (per-day ring buffer, target size 20).
  - **Concurrency-safe cap** via inflight reservations: gate on `(successfulAiCount + inflightAiCount) < 5`.
  - Inflight slots are released on completion/error/cancel; stale inflight reservations are purged on startup and when older than timeout (5–10 min).
  - Background is the **single writer** for BYOK usage state; updates use serialized/mutexed `updateSettings` transactions.
- Legacy-state strategy: **purge-on-read, not migrate**.
  - Gate legacy removal on `settingsSchemaVersion < 2`, strip an explicit legacy-key list, and persist the sanitized object.
  - Ignore and strip legacy monetization fields (`isPro`, `credits`, `trial`, etc.) during settings normalization.
  - Never honor legacy Pro state for unlock.
- Success contract (for “5 successful/day”): count only when `aiOutcome === 'success'` (and success emission itself guarantees usable non-empty output).
- Cross-midnight rule (accepted tradeoff): completions are counted against the **day of completion** using current local `dayKey`.
- Remove trial/credit surface area from extension runtime/UI (no “free credits”, no trial modal/hooks, no remote credit fetch).
- Add custom prompt as explicit BYOK setting and inject it into BYOK prompt construction with guardrails:
  - normalize whitespace
  - cap length (target: 1000 chars)
  - place in a clearly delimited “User preference (non-authoritative)” section after core safety/system instructions.

## Files to modify
- Access model + settings
  - `lib/types.ts`
  - `lib/storage.ts`
  - `lib/entitlement-policy.ts`
  - `lib/auth-service.ts`
  - `lib/runtime-profile.ts` (optional only if unlock code/checkouts become env-configurable now)
  - `lib/unlock-code.ts` (new helper for local unlock-code validation)
- Runtime processing and counter update
  - `entrypoints/background.ts`
  - `entrypoints/offscreen/enhanced-processor.ts`
- Popup/UI flows
  - `entrypoints/popup/hooks/usePopupController.ts`
  - `entrypoints/popup/Popup.tsx`
  - `entrypoints/popup/components/ModeToggle.tsx`
  - `entrypoints/popup/components/UnifiedSettings.tsx`
  - `entrypoints/popup/components/SimplifiedByokSetup.tsx`
  - `entrypoints/popup/components/ProStatusSettings.tsx` (rename semantics to unlock status/CTA)
  - `entrypoints/options/main.ts`
  - `entrypoints/options/index.html`
  - `lib/ui-messages.ts`
- Prompt customization
  - `core/prompts/byok-prompt.ts`
  - `core/prompts/byok-processing-prompt.md`
- Trial/credit cleanup candidates (remove or deprecate)
  - `entrypoints/popup/hooks/useProManager.ts`
  - `entrypoints/popup/components/ProUpgradePrompt.tsx`
  - `pro/monetization-client.ts`
- Tests
  - `tests/entitlement-policy.test.ts`
  - `tests/use-popup-controller.mode-toggle.test.tsx`
  - `tests/ModeToggle.test.tsx`
  - `tests/byok-prompt-template.test.ts`
  - `tests/enhanced-processor.provider-normalization.test.ts`
  - `tests/hooks.test.tsx`
  - `tests/popup.settings-guard.test.tsx`
  - `tests/storage.runtime-policy.test.ts`
  - `tests/background.byok-usage-idempotency.test.ts` (new)
  - `tests/storage.monetization-purge.test.ts` (new)
  - `tests/no-legacy-copy.test.ts` (new)
  - `tests/monetization-client.fallback.test.ts` (remove/replace)

## Reuse
- Existing BYOK request and prompt pipeline (no new AI transport needed):
  - `entrypoints/offscreen/enhanced-processor.ts` (`processAIMode`)
  - `pro/byok-client.ts` (`BYOKClient.makeRequest`)
  - `core/prompts/byok-prompt.ts` (`buildByokPrompt`)
- Existing settings normalization/update mechanism:
  - `lib/storage.ts` (`getSettings`, `updateSettings`, nested BYOK merge + defaults)
- Existing entitlement/auth points (to avoid scattered checks):
  - `lib/entitlement-policy.ts`
  - `lib/auth-service.ts`
- Existing completion event where successful AI runs can be counted:
  - `entrypoints/background.ts` (`handleProcessingComplete` with `aiOutcome`)
- Existing semantic contract points for AI outcomes/fallbacks:
  - `lib/types.ts` (`aiOutcome` + `fallbackCode` unions)
  - `entrypoints/offscreen/enhanced-processor.ts` (emits fallback codes)
  - `entrypoints/popup/hooks/usePopupController.ts` + `entrypoints/popup/Popup.tsx` (consumes/labels outcomes)
- Existing settings surfaces to expose unlock/custom prompt UI:
  - `entrypoints/popup/components/UnifiedSettings.tsx`
  - `entrypoints/popup/components/SimplifiedByokSetup.tsx`
  - `entrypoints/options/index.html` + `entrypoints/options/main.ts` (dev options consistency)

## Steps
- [ ] Add new persisted fields for BYOK monetization state in settings:
  - [ ] `unlock` state (`isUnlocked`, `unlockCodeLast4`, `unlockedAt`, `unlockSchemeVersion`)
  - [ ] daily usage bucket (`dayKey`, `successfulAiCount`, `inflightRuns`, `countedSuccessIds[]` per-day ring buffer)
  - [ ] define `inflightRuns` shape as `Record<runId, { startedAt: number; dayKey: string }>` (SSOT)
  - [ ] derive `inflightAiCount` from `inflightRuns` during normalization/entitlement computation
  - [ ] optional `customPrompt` text
- [ ] Implement settings **purge-on-read** normalization:
  - [ ] add `settingsSchemaVersion` (target: `2`)
  - [ ] when `< 2`, strip explicit legacy monetization key list (`isPro`, `trial`, `credits`, related legacy fields)
  - [ ] initialize new monetization defaults deterministically
  - [ ] persist sanitized settings back to storage immediately
- [ ] Implement daily-window normalization using local date key (`YYYY-MM-DD` from local getters, not `toISOString()`) and apply it before gate checks.
  - [ ] on `dayKey` change, reset `successfulAiCount`, `inflightRuns`, and `countedSuccessIds` (derived `inflightAiCount` becomes 0)
- [ ] Add local unlock code validator helper (`lib/unlock-code.ts`) for Option B flow:
  - [ ] accept entered code
  - [ ] deterministic offline verifier (non-obvious/checksum-style placeholder)
  - [ ] store only `unlockCodeLast4` + `unlockedAt` on success (never full code)
- [ ] Add per-run processing identity:
  - [ ] generate `runId` per AI attempt in background/offscreen message contract
  - [ ] include `runId` in completion payload for all outcomes (success/fallback/error/cancel)
  - [ ] add explicit cancel outcome/cancel fallback code path carrying `runId` so inflight can be released deterministically
  - [ ] dedupe increments using `countedSuccessIds` only when `aiOutcome === 'success'`
- [ ] Refactor `resolveEntitlements` to compute:
  - [ ] hasApiKey
  - [ ] isUnlocked
  - [ ] remainingFreeByokUsesToday (max 5)
  - [ ] canUseAIMode using `(successfulAiCount + inflightAiCount)` for gating
  - [ ] stale inflight purge (drop runs older than timeout and recompute inflight)
  - [ ] stable lock reason codes (missing key, limit reached)
- [ ] Remove runtime dependency on credit/trial backend checks in `usePopupController` and stop using `MonetizationClient.checkCredits`.
- [ ] Update popup + mode toggle messaging from “credits/trial/pro” to “free daily BYOK uses / unlocked unlimited”.
  - [ ] show remaining free uses near the mode toggle
  - [ ] on limit reached, show actions: `Enter unlock code` and `Go to checkout` + confirm offline fallback still works
- [ ] Update dev options page semantics (`entrypoints/options/*`) to remove trial/pro wording and keep deterministic dev bypass toggles aligned with new unlock model.
- [ ] Add checkout + unlock UX in settings:
  - [ ] checkout CTA using placeholder URL (`https://example.com/promptready-checkout`)
  - [ ] unlock code input + validate/apply action
- [ ] Enforce free-limit fallback in `processAIMode` with a stable warning/fallback code (new code for daily limit reached).
- [ ] Implement counter updates in background completion flow:
  - [ ] on AI start: reserve inflight slot by `runId` (if gate permits)
  - [ ] perform gate check + reservation atomically under the same background mutex (UI checks are advisory only)
  - [ ] on completion/failure/cancel: release inflight slot by `runId`
  - [ ] on success: increment only if `runId` not seen in `countedSuccessIds`, then record in per-day ring buffer
  - [ ] on background startup: clear stale/unknown inflight reservations safely
  - [ ] on normalize/evaluate: purge inflight runs older than timeout (5–10 minutes)
  - [ ] enforce serialized single-writer updates (mutex/queue around storage writes)
- [ ] Add custom prompt UI and persist it to settings.
- [ ] Extend BYOK prompt builder/template to include custom prompt instructions deterministically.
- [ ] Remove trial/credit hooks/components and related dead references from popup runtime.
- [ ] Update README/docs copy to match the new monetization model and the “honor-system unlock” tradeoff.

## Verification
- Unit tests (fail before / pass after):
  - Entitlement policy computes correct access for:
    - API key missing
    - API key present + free uses remaining
    - API key present + free limit exhausted
    - unlocked local flag
    - inflight reservations affecting gate decisions
  - Daily reset behavior resets usage only when local day key changes, and resets `successfulAiCount` + `inflightRuns` + `countedSuccessIds` together before gate checks (derived inflight count becomes 0).
  - Storage normalization purges legacy `isPro`/trial/credits fields and does not honor stale Pro state.
  - Unlock validator stores only `unlockCodeLast4`/`unlockedAt` and respects scheme version.
  - BYOK prompt builder injects custom prompt text with guardrails (length cap + normalized whitespace + delimited section).
  - Success emission contract ensures `aiOutcome === 'success'` implies usable non-empty output.
- Integration-ish/runtime tests:
  - `processAIMode` returns deterministic fallback code when free daily limit is exhausted.
  - New fallback code is propagated through shared unions/contracts (`lib/types.ts` -> offscreen -> background -> popup).
  - Background completion counting is idempotent (`runId` duplicate completion does not double-count).
  - Inflight reservation lifecycle is correct (reserve on start, release on completion/error/cancel).
  - Stale inflight reservations are purged on startup and by timeout policy.
- UI tests:
  - Mode toggle blocks AI when key missing or free limit exhausted (unless unlocked/dev mode).
  - Popup shows remaining free uses near toggle, plus limit-reached actions (`Enter unlock code`, `Go to checkout`).
  - No residual “credits/trial/pro” copy in active runtime surfaces.
  - `tests/no-legacy-copy.test.ts` asserts absence of legacy strings (e.g., "credits", "trial", "pro upgrade", "out of credits") from rendered DOM text only (no source-file grep).
  - Settings can save custom prompt and local unlock state.
- Manual E2E:
  1. Fresh install: offline works, AI disabled until key added.
  2. Add BYOK key: AI works up to 5/day.
  3. Trigger duplicate completion/retry path: counter increments once per unique `runId`.
  4. Fire concurrent AI requests near cap: gating honors `successful + inflight` rule.
  5. 6th successful use same day: deterministic fallback + clear unlock prompt + offline still works.
  6. Enable local unlock after external payment: unlimited BYOK.
  7. Set custom prompt and verify BYOK output behavior changes accordingly.

## Non-goals (for this change)
- Rebuilding secure server-side license verification (you chose local unlock for now).
- Refactoring/removing all Cloudflare monetization worker code in this same PR unless it is still imported by extension runtime.

## Risks / Explicit tradeoffs
- Local unlock is an **honor system** and can be shared/reverse-engineered; leakage is expected until server verification is introduced.
- Local-day reset uses device local time; timezone travel or manual clock changes may grant/lose a day bucket (accepted for this phase).
- Cross-midnight runs are counted on completion day (local day key), which may feel slightly unfair at boundaries (accepted for this phase).
