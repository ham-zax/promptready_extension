# E2E Validation Results

## Test Environment
- Chrome Version: [FILL IN - e.g. 120.0.6099.109]
- Extension Loaded from: `.output/chrome-mv3/`
- Date: 2026-05-02
- OpenRouter API Key Available: [FILL IN - YES / NO]
- Known Valid Unlock Code: [FILL IN - YES / NO or "N/A"]

## Scenarios

### 1. Offline Capture & Clipboard
- [ ] Result: PASS / FAIL / BLOCKED
- Steps:
  1. Load extension in Chrome (unpacked mode)
  2. Navigate to any webpage
  3. Click "Capture Content" in popup
  4. Verify Markdown output appears
  5. Click "Copy MD" and paste into text editor
- Evidence: [FILL IN - screenshot or description]
- Notes: Should work without any API key. Offline mode is always free.

### 2. Missing-Key AI Fallback
- [ ] Result: PASS / FAIL / BLOCKED
- Steps:
  1. Open popup
  2. Switch to "AI mode"
  3. Verify warning appears: "AI mode needs your BYOK API key"
  4. Click "Configure API Key"
  5. Verify settings panel opens
- Evidence: [FILL IN - screenshot or description]
- Notes: Should show fallback UI when no key is set.

### 3. Settings Open/Save Behavior
- [ ] Result: PASS / FAIL / BLOCKED
- Steps:
  1. Open popup
  2. Click settings gear icon
  3. Modify settings (enter API key, change model, etc.)
  4. Save settings
  5. Reopen popup and verify settings persisted
- Evidence: [FILL IN - screenshot or description]
- Notes: Settings should persist through Chrome storage.

### 4. Model Picker Behavior
- [ ] Result: PASS / FAIL / BLOCKED
- Steps:
  1. Open settings
  2. Click model dropdown
  3. Verify model list appears (fallback list from `lib/openrouter-models.ts`)
  4. Select a model
  5. Verify selection persists
- Evidence: [FILL IN - screenshot or description]
- Notes: Model list should come from the local fallback list only.

### 5. BYOK AI with Real Key (if key available)
- [ ] Result: PASS / FAIL / BLOCKED
- Steps:
  1. Open settings
  2. Enter valid OpenRouter API key (sk-or-v1-...)
  3. Switch to AI mode
  4. Click "Capture Content"
  5. Verify AI-processed output appears (not offline fallback)
- Evidence: [FILL IN - screenshot or description]
- Notes: Should route through proxy at `https://promptready.app/api/proxy`.

### 6. Unlock-Code UI (if known valid code is available)
- [ ] Result: PASS / FAIL / BLOCKED
- Steps:
  1. Open settings
  2. Locate unlock code input
  3. Enter known valid unlock code
  4. Verify "Unlocked Unlimited" appears in popup
  5. Verify AI mode works without daily limit
- Evidence: [FILL IN - screenshot or description]
- Notes: Unlock code enables local unlimited BYOK.

### 7. Daily-Limit UI (if testable)
- [ ] Result: PASS / FAIL / BLOCKED
- Steps:
  1. Use extension 5+ times in AI mode
  2. Verify "Daily free AI limit reached" message appears
  3. Verify settings panel shows remaining uses
- Evidence: [FILL IN - screenshot or description]
- Notes: Free tier allows 5 successful AI runs per local day.

## Blocker Summary
[List all BLOCKED items and reasons - FILL IN after testing]
1. 
2. 
3. 

## Release Readiness Decision
- [ ] Ready for MVP release
- [ ] Blocked — fix blockers first
- [ ] Blocked — need real checkout/billing

## Preflight Notes
- [FILL IN - production build command and result]
- [FILL IN - TypeScript command and result]
- [FILL IN - smoke test command and result]
- [FILL IN - any known build or runtime caveats before Chrome testing]
