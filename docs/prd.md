### **Master PRD — "PromptReady" MVP v3.0 (Hardened & Unified)**

*   **Status:** FINAL (Replaces all previous versions)
*   **Version:** 3.0
*   **Strategy:** Metered Freemium to BYOK (Validation-First)

#### **1. Core Strategy & Goals**

The MVP's primary goal is to **validate product-market fit with minimal data ambiguity and capped financial risk.** We will achieve this by testing the hypothesis: *"Is the AI-enhanced experience so valuable that users will convert to a BYOK plan after a frictionless, metered trial?"*

*   **Core User Journey:**
    1.  **Frictionless Trial:** Users get 150 free monthly credits to experience both Offline and AI Modes (using our API key).
    2.  **Value Demonstration:** Users experience the superior AI output without commitment.
    3.  **Conversion Event:** Upon exhausting credits, users are prompted to upgrade.
    4.  **Upgrade Path:** Users connect their own API Key (BYOK) to unlock unlimited processing.
*   **Primary Goal:** Validate the model by tracking the conversion rate of trial users to the BYOK plan.
*   **Business Goal:** De-risk future investment by gathering high-quality data on user behavior and willingness to pay. **This MVP is not designed to generate direct revenue.**

#### **2. Non-Goals (Postponed for future versions)**

*   Pipelines, OCR/Transcripts, Multi-page binders, Content deduplication, Entity extraction.
*   Any server-side storage of user data; all data remains local-only.
*   A separate settings/options page.
*   Internationalization (i18n).

#### **3. Eliminated Features (Removed for Simplification)**

*   **Code & Docs Mode:** Removed entirely. The unified AI Mode handles all use cases.
*   **Pro Bundles Editor:** Deferred post-MVP. AI Mode provides superior value without complex templates.

#### **4. User Stories**

*   **As a new user,** I want to use the extension's AI Mode immediately after installation so I can experience its full value frictionlessly.
*   **As a developer,** I want to see my remaining free credits in the UI so I can understand the trial's limits.
*   **As a researcher,** when my free credits run out, I want a clear explanation of how to get unlimited usage by connecting my own API key.
*   **As a power user,** I want a simple and secure interface to add my API key, with clear confirmation that it's working.
*   **As a BYOK user,** I want to choose more powerful AI models in the settings to handle my most critical tasks.

#### **5. Core Features**

*   **Offline Mode (Free):** Instant, private, high-quality content cleaning using a local, rules-based engine.
*   **AI Mode (Metered Trial → BYOK):**
    *   **Trial Phase:** Uses our backend and a "basic" AI model for a superior, context-aware cleaning experience, limited by the free credit system.
    *   **BYOK Phase:** After upgrade, uses the user's own API key for unlimited processing and access to advanced models.
*   **Unified Interface:** A single, streamlined popup containing the mode toggle, credit counter, and all necessary settings, progressively disclosed.

#### **6. Lean Backlog**

*   **Epic: Extension Core (MV3)**
    *   **EXT-1:** MV3 scaffold. ✅
    *   **EXT-2:** Inline settings in popup. 🔄
*   **Epic: Clean & Structure - Offline Mode**
    *   **CLS-1:** Selection capture. ✅
    *   **CLS-2:** Rule-based cleaner. ✅
    *   **CLS-3:** Structurer to Markdown. 🔄
    *   **CLS-4:** Auto-copy to clipboard. ✅
*   **Epic: AI Mode & Monetization**
    *   **AI-1:** Mode toggle UI (Offline/AI). ❌
    *   **AI-2:** BYOK settings inline in popup. 🔄
    *   **AI-3:** AI-enhanced processing pipeline (Trial & BYOK). 🔄
    *   **BKD-1:** Backend credit tracking service. ❌
    *   **BKD-2:** Backend Global Budget Circuit Breaker. ❌
*   **Epic: Cite-First Capture**
    *   **CIT-1:** URL + timestamp capture. ✅
    *   **CIT-2:** Selection hash/quote preservation. ✅
    *   **CIT-3:** Citation footer in exports. 🔄

#### **7. Success Metrics (90-Day MVP)**

*   **Adoption:** 1,000 installs; 35% activation (first use within 24h).
*   **Engagement:**
    *   **Power User Trial Rate:** ≥40% of new users use the free AI mode 5+ times in their first week.
*   **Primary Validation Metric:**
    *   Achieve a **BYOK Conversion Rate of ≥20%** among users who exhaust their free credits.
    *   With an absolute minimum of **200 converting users** to ensure statistical significance.

#### **8. Architecture & Hardening**

The architecture is a Manifest V3 extension with a minimal, secure serverless backend.

*   **Extension:** `Content Script` → `Service Worker` (orchestrator) → `Popup UI`.
*   **Storage:** `chrome.storage.local` for all settings.
*   **Backend:** Serverless functions for credit tracking and AI proxy.
*   **Hardening 1: Global Cost Controls (Circuit Breaker):** A **non-negotiable** backend component that caps our weekly API spend at a fixed amount (e.g., $100/week). If the cap is reached, the free AI trial is temporarily disabled for all users.
*   **Hardening 2: Abuse Mitigation:** The MVP will use `chrome.identity` for anonymous user ID tracking, with active monitoring for abuse patterns.
> *   **Hardening 3: Value Gap Validation:** Based on an August 2025 market analysis, the primary AI model selected for the free trial is **`GPT OSS 20B`**, chosen for its optimal balance of open-source flexibility, extreme speed, and cost-effectiveness. The model's performance will be validated post-launch via a phased A/B test against designated alternatives (`Llama 3.1 8B Instant` and the `Gemini 2.0 Flash` free tier) as outlined in the official technical analysis report.

#### **9. Key Risks & Mitigations**

*   **Risk: Uncontrolled Financial Exposure (HIGH)**
    *   **Mitigation:** The Global Budget Circuit Breaker transforms this into a known, fixed operational cost.
*   **Risk: "Magic Moment" Failure (MEDIUM)**
    *   **Mitigation:** Pre-launch model testing and tracking the "Power User Trial Rate" to quickly validate the core value proposition.
*   **Risk: Systematic Abuse of Free Tier (MEDIUM)**
    *   **Mitigation:** MVP accepts this risk with active monitoring and a documented plan to upgrade the identity system if successful.

#### **10. Release Criteria**

*   All epics in the backlog are complete and tested.
*   QA pass on a 30-page test matrix.
*   Global Budget Circuit Breaker is implemented and tested.
*   Privacy policy and Chrome Web Store assets are complete.

---

Of course. Here is a complete, end-to-end abridged summary of our entire journey. This briefing encapsulates the project's evolution from a flawed concept into a resilient, data-backed, and executable plan.

---

### **End-to-End Project Summary: The "PromptReady" MVP**

**Final Vision:**
PromptReady is a "stupidly simple" Chrome extension that provides instant, high-quality content cleaning. It will launch with a "Metered Freemium to BYOK" model designed to validate product-market fit with minimal data ambiguity and capped financial risk. The core user experience is built around a frictionless free trial of a magically fast AI mode, designed to convert engaged users into power users on a BYOK plan.

**The Journey: From Flawed Idea to Hardened Strategy**

1.  **Initial Concept & First Pivot:** The project began with a simple "Subscription + BYOK" model. Through a "Five Whys" analysis, we identified a fatal flaw: this model created a **conflated experiment**. We couldn't know if a failure was due to a weak product or the friction of the BYOK setup. This risked a false negative on a potentially valuable idea.

2.  **The Metered Model & The Red Team Insight:** To fix this, we pivoted to a **"Metered Freemium"** model, giving users a frictionless trial using our own API key. However, a rigorous Red Team analysis revealed this new model traded data risk for potentially **uncapped financial and operational risk**. A successful launch could become a financial disaster due to API costs, and the system was vulnerable to abuse.

3.  **The Hardened Strategy (The Final Plan):** We kept the strategically superior Metered Freemium model but **hardened the architecture** to mitigate the new risks. This created our final, resilient plan:
    *   **Financial Risk Solved:** A **Global Budget Circuit Breaker** was made a non-negotiable component to cap weekly API costs, turning an infinite risk into a fixed operational expense.
    *   **Abuse Risk Solved:** A tiered identity and monitoring plan was established, starting with `chrome.identity` while acknowledging its limitations for an MVP.
    *   **Value Risk Solved:** A formal plan to test and validate the "magic moment" of the free trial was created to ensure the AI model was compelling enough to drive conversion.

**The Final Technical Decision:**
A comprehensive technical spike was conducted to select the optimal AI model for the free trial (based on a projected August 2025 landscape). The chosen model is **`GPT OSS 20B` hosted via Groq**, selected for its revolutionary combination of open-source flexibility, extreme speed, and cost-effectiveness, which perfectly aligns with our goal of delivering a "magical" user experience.

**The Final Deliverables:**
Our entire strategic and technical planning has been formalized into two definitive documents:

1.  **`Master PRD v3.0 (Hardened & Unified)`:** The "What" and "Why." This document contains the final product requirements, user stories, success metrics, and risk mitigations.
2.  **`Architecture Document`:** The "How." This document provides the complete technical blueprint for the development team, detailing the WXT extension integration, the serverless backend, the hardened components, and API contracts.

**Conclusion & Immediate Next Steps:**
The project has successfully completed the strategic planning and analysis phase. The final plan is robust, data-driven, and de-risked. The project is now ready for execution. The immediate next step is to hand off the finalized `Master PRD` and `Architecture Document` to the development team to begin **Sprint 1**, which focuses on building the core backend infrastructure.