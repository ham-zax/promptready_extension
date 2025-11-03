# Visual Pipeline Architecture

## Your Current System vs. Proposed System

### CURRENT ARCHITECTURE (Simple)

```
┌─────────────────────────────────────────────────────────────────┐
│ CONTENT CAPTURE (User selects text or clicks extension icon)   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ CONTENT SCRIPT                                                  │
│ • Extracts HTML from DOM                                       │
│ • Sends to background script                                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ BACKGROUND SERVICE WORKER                                       │
│ • Routes message to offscreen document                          │
│ • Handles clipboard operations                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ OFFSCREEN DOCUMENT                                              │
│ • Processes HTML                                                │
│ • Runs Readability extraction                                   │
│ • Returns result (good or bad)                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                ┌──────────┴──────────┐
                │                     │
         Success (80%)          Failure (20%)
                │                     │
                ▼                     ▼
        ┌──────────────┐     ┌──────────────────┐
        │ Use Result   │     │ Return Best      │
        │              │     │ Effort (document)│
        └──────────────┘     └──────────────────┘
                │                     │
                └──────────────────┬──────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────┐
                    │ POST PROCESSOR          │
                    │ Convert to Markdown     │
                    └─────────────────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────┐
                    │ EXPORT                  │
                    │ Copy to clipboard       │
                    └─────────────────────────┘

PROBLEM: No quality validation → Returns garbage on complex sites (Reddit)
```

---

### PROPOSED ARCHITECTURE (3-Stage Pipeline)

```
┌─────────────────────────────────────────────────────────────────┐
│ CONTENT CAPTURE                                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ GRACEFUL DEGRADATION PIPELINE (NEW)                             │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ STAGE 1: SEMANTIC QUERY                                  │  │
│  │ • Try: article, main, [role="main"], .post-content       │  │
│  │ • Quality Gate: 60+/100 (strict)                         │  │
│  │ • Success? → Skip Stages 2&3                             │  │
│  │ • Fail? → Continue to Stage 2                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                    │
│                  ┌─── FAILS QUALITY ───┐                       │
│                  ▼                     │                        │
│  ┌──────────────────────────────────────┐────────────────────┐ │
│  │ STAGE 2: READABILITY                 │ (from Stage 1)    │ │
│  │ • Use: Mozilla Readability library   │                    │ │
│  │ • Quality Gate: 40+/100 (lenient)    │                    │ │
│  │ • Success? → Skip Stage 3            │                    │ │
│  │ • Fail? → Continue to Stage 3        │                    │ │
│  └──────────────────────────────────────┘                    │ │
│                           │                                  │ │
│                  ┌─── FAILS QUALITY ───┴────────────────────┘ │
│                  ▼                                              │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ STAGE 3: HEURISTIC SCORING (SAFETY NET)                │  │
│  │ • Use: ScoringEngine.findBestCandidate()                │  │
│  │ • Quality Gate: NONE (always passes)                    │  │
│  │ • Always returns *something*                            │  │
│  │ • Scores all elements, picks best content container     │  │
│  └─────────────────────────────────────────────────────────┘  │
│                           │                                    │
│                           ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ RESULT WITH METADATA                                    │  │
│  │ • content: extracted HTML                               │  │
│  │ • stage: 'semantic'|'readability'|'heuristic'           │  │
│  │ • qualityScore: 0-100                                   │  │
│  │ • fallbacksUsed: ['stage1-failed', 'stage2-failed']    │  │
│  │ • extractionTime: milliseconds                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                           │                                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
                ┌─────────────────────────┐
                │ BACKGROUND TRACKS STAGE │
                │ • Which stage succeeded?│
                │ • Quality scores        │
                │ • Fallback frequency    │
                └────────────┬────────────┘
                             │
                             ▼
                ┌─────────────────────────┐
                │ POST PROCESSOR          │
                │ Convert to Markdown     │
                └────────────┬────────────┘
                             │
                             ▼
                ┌─────────────────────────┐
                │ EXPORT                  │
                │ Copy to clipboard       │
                └─────────────────────────┘

BENEFIT: Quality gates → Always returns usable content, tracks fallbacks
```

---

## Side-by-Side: Current vs. Proposed

```
CURRENT                         PROPOSED
════════════════════════════════════════════════════════════════

Try Readability                 Try Stage 1 (Semantic)
    │                               │
    ├─ Success? Use it              ├─ Quality > 60? → Use it
    │                               │                    │
    └─ Fail? Try fallback           └─ Quality ≤ 60? → Stage 2
                                        │
                              Try Stage 2 (Readability)
                                        │
                                        ├─ Quality > 40? → Use it
                                        │                    │
                                        └─ Quality ≤ 40? → Stage 3
                                            │
                                  Try Stage 3 (Heuristic)
                                            │
                                            ├─ ALWAYS succeeds
                                            │
                                            └─ Best effort result

PROBLEM: No quality gates       SOLUTION: Quality gates at each stage
RESULT: May return garbage      RESULT: Always usable, metrics tracked
```

---

## Stage Mapping to Your Existing Code

```
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 1: SEMANTIC QUERY                                         │
│                                                                 │
│ Uses: core/readability-config.ts                               │
│       • ReadabilityConfigManager.getConfigForUrl()             │
│       • document.querySelector('article, main, ...')           │
│                                                                 │
│ Quality Check: core/quality-gates.ts (NEW)                    │
│       • Check: character count > 500                           │
│       • Check: paragraphs > 3                                  │
│       • Check: link density < 40%                              │
│       • Gate: 60+/100 required to pass                         │
│                                                                 │
│ Your code status: ✅ Already exists in some form              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ STAGE 2: READABILITY EXTRACTION                                │
│                                                                 │
│ Uses: @mozilla/readability + core/readability-config.ts       │
│       • new Readability(doc, config).parse()                   │
│       • core/offline-mode-manager.ts                           │
│                                                                 │
│ Quality Check: core/quality-gates.ts (NEW)                    │
│       • Check: character count > 200                           │
│       • Check: has structure (p tags or headings)              │
│       • Check: link density < 70%                              │
│       • Gate: 40+/100 required to pass                         │
│                                                                 │
│ Your code status: ✅ Already implemented                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ STAGE 3: HEURISTIC SCORING                                     │
│                                                                 │
│ Uses: core/scoring/scoring-engine.ts                          │
│       • ScoringEngine.findBestCandidate(document.body)         │
│       • Scores all DIVs/SECTIONs by content density            │
│       • Selects highest-scoring element                        │
│                                                                 │
│ Quality Check: core/quality-gates.ts (NEW)                    │
│       • Always passes (it's the safety net)                    │
│       • Provides feedback score but doesn't reject             │
│                                                                 │
│ Your code status: ✅ Already exists, just underused            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ ORCHESTRATION: NEW FILES                                        │
│                                                                 │
│ NEW: core/quality-gates.ts                                     │
│ NEW: core/graceful-degradation-pipeline.ts                    │
│                                                                 │
│ Your code status: ❌ Doesn't exist yet                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quality Gate Details

### Stage 1 Gate: STRICT (60+ score required)

```
INPUT: Extracted element from Stage 1

CHECKS:
  ✓ Character Count: needs > 500 chars
    └─ If < 500: fail (-30 points)
  
  ✓ Paragraph Count: needs > 3 paragraphs
    └─ If < 3: fail (-25 points)
  
  ✓ Link Density: needs < 40% links
    └─ If > 40%: fail (-20 points)
  
  ✓ Paragraph Length: needs avg > 50 chars
    └─ If < 50: fail (-15 points)
  
  ✓ Signal/Noise Ratio: needs > 60% signal
    └─ If < 60%: fail (-10 points)

DECISION:
  ✓ If score >= 60: PASS → Use Stage 1 result
  ✗ If score < 60: FAIL → Continue to Stage 2

LOGIC: Only accept clearly high-quality Stage 1 results
```

### Stage 2 Gate: LENIENT (40+ score required)

```
INPUT: Extracted article from Readability

CHECKS:
  ✓ Character Count: needs > 200 chars (lower threshold)
    └─ If < 200: fail (-40 points)
  
  ✓ Has Structure: needs paragraphs OR headings
    └─ If neither: fail (-30 points)
  
  ✓ Not All Links: needs < 70% links
    └─ If > 70%: fail (-30 points)

DECISION:
  ✓ If score >= 40: PASS → Use Stage 2 result
  ✗ If score < 40: FAIL → Continue to Stage 3

LOGIC: Accept anything Readability extracts that has some structure
```

### Stage 3 Gate: FALLBACK (Always passes)

```
INPUT: Best-scored element from heuristics

CHECKS:
  ✓ No quality check (it's the safety net)
  
  ✓ Always returns PASS
  
  ✓ Quality score is informational only
    └─ Used for metrics/logging, not for rejection

DECISION:
  ✓ Always PASS → Use Stage 3 result

LOGIC: Something is always better than nothing
```

---

## Decision Tree

```
                        START
                          │
                          ▼
                  Run Stage 1 Extraction
                  (Semantic Query)
                          │
                          ▼
                  Quality > 60?
                    /          \
                  YES           NO
                   │             │
            ┌──────▼──┐    Run Stage 2
            │ RETURN  │    (Readability)
            │ Stage 1 │          │
            │ RESULT  │          ▼
            └─────────┘    Quality > 40?
                           /          \
                         YES           NO
                          │             │
                   ┌──────▼──┐   Run Stage 3
                   │ RETURN  │   (Heuristics)
                   │ Stage 2 │      │
                   │ RESULT  │      ▼
                   └─────────┘ ALWAYS
                                │
                         ┌──────▼──────┐
                         │ RETURN      │
                         │ Stage 3     │
                         │ RESULT      │
                         │ (Safe Net)   │
                         └─────────────┘
```

---

## Real-World Example: Reddit Post

```
URL: reddit.com/r/programming/comments/...

STAGE 1: Semantic Query
─────────────────────────────────────────
Looks for: article, main, [role="main"]
Problem:  Reddit has nested divs, no article tag
Result:   Extracts sidebar + navigation
Quality:  ~25/100 (too much noise)
Gate:     FAIL (need 60+)
Fallback: → Stage 2

STAGE 2: Readability
─────────────────────────────────────────
Uses:     Mozilla Readability algorithm
Problem:  Readability sees comments as separate
Result:   Extracts post title + first paragraph only
Quality:  ~35/100 (incomplete extraction)
Gate:     FAIL (need 40+)
Fallback: → Stage 3

STAGE 3: Heuristic Scoring
─────────────────────────────────────────
Scores all DIVs:
  • .post-container (main post) = 185 points ⭐ BEST
  • .comments-section (comments) = 120 points
  • .sidebar (sidebar) = 80 points
  • header = 10 points
  
Result:   Selects .post-container with score 185
Quality:  ~75/100 (very usable)
Gate:     PASS (always passes)
Return:   Reddit post content without comments/sidebar

FINAL OUTPUT:
─────────────────────────────────────────
✅ Stage: heuristic
✅ Quality: 75/100
✅ Fallbacks: ['stage1-failed', 'stage2-failed']
✅ Content: Clean Reddit post
✅ Metrics collected for analytics
```

---

## Expected Stage Distribution (After Deployment)

```
ASSUMPTION (based on typical web):
────────────────────────────────────────

Simple Content (Blogs, News, Articles, Docs):
  Stage 1 Success: 60%   ← Semantic query works
  Stage 2 Success: 30%   ← Readability works
  Stage 3 Success: 10%   ← Heavy UI sites

Complex Content (Reddit, Twitter, LinkedIn):
  Stage 1 Success: 10%   ← Semantic doesn't match
  Stage 2 Success: 20%   ← Readability partial
  Stage 3 Success: 70%   ← Heuristics find content

Edge Cases (Empty, JS-Heavy, Paywalls):
  Stage 1 Success: 0%
  Stage 2 Success: 10%
  Stage 3 Success: 90%   ← Always returns something

OVERALL EXPECTED:
  Stage 1: ~40-50%
  Stage 2: ~30-40%
  Stage 3: ~10-20%

This distribution will help identify which types of content need improvement.
```

---

## Integration Points

```
┌─────────────────────────────────────────────────────────────────┐
│ WXT EXTENSION ARCHITECTURE                                      │
└─────────────────────────────────────────────────────────────────┘

Content Script                  Background Service Worker
(entrypoints/content.ts)        (entrypoints/background.ts)
│                               │
├─ Captures page content        ├─ Routes messages
│                               │
├─ Sends to background         ├─ Calls pipeline
│  via message                 │  (NEW!)
│                              │
│                              ├─ Tracks metrics
│  (NEW!)                      │  (NEW!)
│  ↓                           │
│  Add pipeline call           ├─ Forwards to offscreen
│  GracefulDegradationPipeline ├─ or handles locally
│  .execute(document)          │
│                              └─ Sends result to popup
└─────────────────────────────────────────────────────────────────┘

Core Processing Layer
────────────────────────────────
GracefulDegradationPipeline (NEW!)
  ├─ executeStage1()
  ├─ executeStage2()
  └─ executeStage3()
    ↓
QualityGateValidator (NEW!)
  ├─ validateSemanticQuery()
  ├─ validateReadability()
  └─ validateHeuristicScoring()
    ↓
Existing Components
  ├─ ReadabilityConfigManager ✅
  ├─ ScoringEngine ✅
  ├─ OfflineModeManager ✅
  └─ ContentQualityValidator ✅
```

---

**This architecture ensures:**
- ✅ Always usable extraction
- ✅ Quality validation at each stage
- ✅ Metrics tracking
- ✅ No breaking changes
- ✅ Backwards compatible

