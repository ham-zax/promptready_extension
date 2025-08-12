# PRD — "PromptReady" MVP (Unified - AI-First Monetization)

**Status:** Unified PRD (Replaces all sharded versions)  
**Version:** 2.0 (AI-First, Code & Docs Mode Removed)  
**Date:** 2025-01-12

## 0. Final Decisions & Strategic Approach

*   **AI-First Monetization:** The MVP positions **AI Mode** as the primary value proposition for revenue generation, with **Offline Mode** as the free baseline.
*   **BYOK Business Model:** Pro users ($3/mo or $29/yr) unlock AI Mode and use their own API keys for enhanced processing.
*   **Radical Simplification:** "Stupidly simple" UX - open extension → copy → done (offline) OR open extension → AI mode → copy → loading → done.
*   **Single Interface:** All settings integrated into the popup interface itself, eliminating separate options/settings pages.
*   **BYOK Provider:** Support any **OpenAI-compatible endpoint** with **OpenRouter as the default provider**.
*   **License UX:** Simple local license flag to unlock Pro features, avoiding Chrome Web Store licensing complexity.

## 1. Goals

*   Deliver stupidly simple clean/copy workflow that "just works" for any webpage selection.
*   Drive AI Mode adoption through superior output quality and smart formatting.
*   Monetize at launch with AI Mode as the premium experience powered by user's own API keys (BYOK).
*   Achieve 8-12% Pro conversion rate through clear value differentiation.

## 2. Non-Goals (Postponed for future versions)

*   Pipelines (#8) - *Scheduled for 2-4 weeks post-launch.*
*   OCR/Transcripts (#10, #11)
*   Multi-page binder (#12)
*   Content deduplication (#13)
*   Entity extraction (#14)
*   Hosted AI inference or background scraping.
*   Any server-side storage or cloud synchronization of user data. All data remains local-only in MVP.
*   Internationalization (i18n) — deferred post‑MVP.
*   **Separate Settings Page** - All configuration moved to popup interface.
*   **Renderer Selection** - Hidden from users, automatically optimized behind the scenes.

### 2.1 Eliminated Features (Removed for Simplification)

*   **Code & Docs Mode** - Removed entirely. General processing with AI Mode enhancement handles all use cases more effectively.
*   **Pro Bundles Editor** - Deferred post-MVP. AI Mode provides superior content enhancement without complex template management.
*   **Multiple Processing Modes** - Simplified to single general processing with optional AI enhancement.

## 3. Personas

*   **Developer:** Cleans API docs, PRs/issues, stack traces, blog posts into prompt-ready content.
*   **Researcher/Student:** Structures articles/papers into clean, citable content.
*   **Content Creator:** Processes web content for AI workflows and content creation.

## 4. User Stories (MVP)

*   As a user, I can press a hotkey or click the extension to instantly copy cleaned content from any webpage selection.
*   As a user, I can toggle between Offline Mode (free, instant) and AI Mode (premium, enhanced) with a single click.
*   As a Pro user, I can use AI Mode to get superior formatting, smart structuring, and enhanced output quality.
*   As a user, I can configure my AI settings (API key, model) directly within the popup without navigating to separate pages.

## 5. Core Features

### 5.1 Offline Mode (Free)
*   **One-Click Clean Copy (#1):** Selection → clean → structure → copy to clipboard automatically.
*   **Cite-First Capture (#9):** Includes canonical URL, timestamp, selection hash; preserves quoted snippets.
*   **Instant Processing:** Local-only processing with <300ms typical response time.

### 5.2 AI Mode (Pro - BYOK Monetization)
*   **Enhanced Processing:** AI-powered formatting, smart structuring, and content optimization.
*   **BYOK Integration (#22):** Uses user's own API key for OpenAI-compatible endpoints.
*   **Superior Output:** Better markdown formatting, intelligent content organization, enhanced readability.
*   **Smart Prompting:** Context-aware prompts that understand content type and optimize accordingly.

### 5.3 Unified Interface
*   **Mode Toggle:** Primary toggle between Offline/AI modes prominently displayed.
*   **Inline Settings:** All configuration accessible within popup (no separate options page).
*   **Progressive Disclosure:** Advanced settings revealed only when needed.

## 6. Requirements

### Functional

*   Triggered by hotkey and toolbar action.
*   Default hotkey: **Ctrl/Cmd+Shift+L** (current implementation).
*   **Offline Mode:** Deterministic cleaner (Readability.js + DOM heuristics + boilerplate filters).
*   **AI Mode:** Enhanced processing via BYOK with explicit consent and rate limiting.
*   **Auto-copy:** Content automatically copied to clipboard after processing (both modes).
*   File naming convention: `<title>__YYYY-MM-DD__hhmm__hash.(md|json)` (for downloads).
*   Citations: URL, timestamp, optional quoted-lines block, selection hash.
*   **Single Interface:** All settings within popup, no separate options page.

#### Settings Schema (Unified)

Stored in `chrome.storage.local`.

```json
{
  "mode": "offline" | "ai",
  "byok": {
    "provider": "openrouter",
    "apiBase": "https://openrouter.ai/api/v1",
    "apiKey": "",
    "model": ""
  },
  "privacy": { "telemetryEnabled": false },
  "isPro": false,
  "theme": "system" | "light" | "dark",
  "renderer": "turndown",
  "useReadability": true
}
```

### Non-Functional

*   **Platform:** Chrome MV3 with minimal permissions: `activeTab`, `storage`, `scripting`, `clipboardWrite`, `offscreen`.
*   **Browser support target:** Chromium stable released ~12 months prior to launch.
*   **Privacy:** Local-first, no server storage, explicit user action for any network call (AI Mode only).
*   **Performance:** 
    - Offline Mode: <300ms typical, <1.5s for long documents
    - AI Mode: <10s typical (network dependent)
*   **Accessibility:** Keyboard-first navigation, ARIA labels for popup interface.
*   **Quality:** ≥85% of exports require "no manual fix needed" on a test set of 30 diverse pages.

## 7. Lean Backlog (Unified)

### Epic: Extension Core (MV3) - Simplified
*   **EXT-1:** MV3 scaffold (manifest, service worker, content script, popup shell). ✅ DONE
*   **EXT-2:** ~~Settings page~~ → **Inline settings in popup**. 🔄 PARTIAL

### Epic: Clean & Structure (#1) - Offline Mode
*   **CLS-1:** Selection capture and DOM snapshot. ✅ DONE
*   **CLS-2:** Rule-based cleaner (Readability + boilerplate filters). ✅ DONE
*   **CLS-3:** Structurer to Markdown. 🔄 PARTIAL
*   **CLS-4:** Auto-copy to clipboard. ✅ DONE

### Epic: AI Mode (#22) - Premium Experience (BYOK Monetization)
*   **AI-1:** Mode toggle UI (Offline/AI). ❌ MISSING
*   **AI-2:** BYOK settings inline in popup. 🔄 PARTIAL
*   **AI-3:** AI-enhanced processing pipeline. 🔄 PARTIAL
*   **AI-4:** Pro feature gating and license management. ✅ DONE
*   **AI-5:** Pro license purchase/validation flow. ❌ MISSING

### Epic: Cite-First Capture (#9)
*   **CIT-1:** Canonical URL + timestamp capture. ✅ DONE
*   **CIT-2:** Selection hash and quote preservation. ✅ DONE
*   **CIT-3:** Citation footer in exports. 🔄 PARTIAL

### Epic: QA, Compliance, and Release
*   **QA-1:** Test matrix of 30 pages (news, docs, GitHub, MDN, ArXiv, etc.). ❌ MISSING
*   **QA-2:** Accessibility audit on popup interface. ❌ MISSING
*   **REL-1:** Chrome Web Store listing assets (icons, screenshots, GIFs, copy). ❌ MISSING
*   **LEG-1:** Privacy policy and permissions rationale document. ❌ MISSING

## 8. 2-Week Sprint Plan (Revised)

*   **Week 1:** AI-1, AI-2, CLS-3 completion, CIT-3, EXT-2 (inline settings), AI-5
*   **Week 2:** AI-3, AI-4 refinement, QA-1, QA-2, REL-1, LEG-1

## 9. Success Metrics (90 Days)

- **Adoption:** 1,000 installs; 35% activation (first clean within 24h).
- **Engagement:** median 3 cleans/user/week; 25% W4 retention.
- **AI Mode Conversion:** 15-25% of users try AI Mode; 8-12% Pro conversion overall.
- **Quality:** ≥85% "no manual fix needed" on a curated 30‑page test set.
- **Revenue:** Target $240-480 MRR at 1,000 users (8-12% conversion at $3/mo).

## 10. Release Criteria

- QA pass on 30‑page matrix; p95 processing <1.5s offline, <10s AI mode.
- Accessibility: keyboard navigation and ARIA on popup interface.
- MV3 compliance; minimal permissions rationale documented.
- Privacy policy and listing assets (icons, screenshots, GIFs, copy) complete.
- Pro license purchase flow functional and tested.

## 11. Architecture & Permissions (Simplified)

- Content script: selection/DOM capture → cleaner → structurer → auto-copy to clipboard.
- Service worker: orchestrates commands, AI processing, settings.
- UI: popup only (quick actions, mode toggle, inline settings).
- Storage: `chrome.storage.local` (API keys in plain text for simplicity).
- AI Mode: OpenAI‑compatible client; explicit user consent per call; retries/backoff; local rate limit.
- Permissions: `activeTab`, `storage`, `scripting`, `clipboardWrite`, `offscreen`.

## 12. Analytics & Telemetry

- Default off; post‑install opt‑in.
- If enabled: event counts only (clean_offline, clean_ai, pro_conversion). No content captured.

## 13. BYOK Monetization Strategy

### 13.1 Business Model Overview
**Primary Revenue Driver:** Pro license sales ($3/mo or $29/yr) that unlock AI Mode functionality.

**Value Proposition:**
- **Free Tier (Offline Mode):** Good quality, instant processing, privacy-first
- **Pro Tier (AI Mode):** Superior quality, AI-enhanced processing, requires user's own API key

### 13.2 BYOK Implementation Strategy
**Technical Approach:**
- Users purchase Pro license → `isPro: true` flag set locally
- Pro users can configure their own OpenAI-compatible API keys
- AI Mode uses user's API key for enhanced processing
- No hosted AI costs for the business

**Revenue Benefits:**
- Recurring subscription revenue without AI infrastructure costs
- Users pay for software value, not AI usage
- Scalable model - more users don't increase costs
- Clear upgrade path from free to paid

### 13.3 User Journey to Purchase
1. **Free User Experience:** User gets good results with Offline Mode
2. **AI Mode Discovery:** User notices AI Mode toggle, tries it
3. **Upgrade Prompt:** "Upgrade to Pro to unlock AI Mode" with benefits
4. **Purchase Decision:** User sees value in enhanced processing quality
5. **API Key Setup:** Pro user configures their own OpenAI/OpenRouter key
6. **Premium Experience:** User gets superior results with AI Mode

### 13.4 Competitive Advantages
- **No AI Costs:** Business model scales without infrastructure costs
- **User Control:** Users control their AI spending and privacy
- **Flexibility:** Works with any OpenAI-compatible provider
- **Transparency:** Clear value proposition - pay for software, not AI usage

## 14. Risks & Mitigations

- Variable DOM structures → site‑class heuristics + fallbacks.
- Extension review friction → minimal permissions + transparent AI Mode UX.
- AI Mode confusion → explicit "AI processing" indicator and consent flow.
- Performance variance → fast offline default; AI mode clearly marked as premium/slower.
- **BYOK Complexity:** Users may find API key setup confusing → Streamlined setup flow with clear documentation.
- **Simplification Risk:** Removing Code & Docs mode may disappoint power users → Monitor feedback and consider re-adding post-launch if needed.

---

**This unified PRD replaces:**
- `docs/prd.md` (original)
- `docs/prd_sharded.md` (sharded version)
- `docs/prd-revised.md` (AI-first revision)

**Key Unified Changes:**
1. **Code & Docs Mode Eliminated** - Single general processing mode
2. **AI-First Monetization** - Clear Offline/AI mode revenue strategy
3. **BYOK Business Model** - Detailed monetization strategy
4. **Radical UX Simplification** - Single popup interface
5. **Unified Settings Schema** - Consistent with current implementation
