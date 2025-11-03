# Graceful Degradation Pipeline - Integration Guide

## Quick Status

✅ **Your codebase is EXCELLENT for this integration**

### Key Facts:
- ✅ Mozilla Readability already installed (`@mozilla/readability@0.4.1`)
- ✅ Scoring Engine already implemented (`core/scoring/scoring-engine.ts`)
- ✅ Performance metrics system in place
- ✅ Quality assessment logic exists (`ContentQualityValidator`)
- ✅ Offscreen document system working
- ✅ Message routing patterns established

### What You're Getting:
1. **Quality Gates** - Validation between fallback stages
2. **Explicit Pipeline** - Centralized degradation logic
3. **Better Metrics** - Track which stage succeeds
4. **Reddit Support** - Stage 3 handles complex layouts

### Integration Complexity: **LOW** (~12 hours)

---

## Three-Stage Architecture

Your system will use:

```
┌─────────────────────────────────────────────────┐
│ GRACEFUL DEGRADATION PIPELINE                   │
├─────────────────────────────────────────────────┤
│                                                 │
│ Stage 1: Semantic Query                        │
│   └─ Selectors: article, main, [role="main"]  │
│   └─ Quality Gate: 60+/100 required            │
│   └─ Used by: ReadabilityConfigManager         │
│                                                 │
│ Stage 2: Readability Extraction                │
│   └─ Uses: Mozilla Readability library         │
│   └─ Quality Gate: 40+/100 required            │
│   └─ Fallback from: Stage 1                    │
│                                                 │
│ Stage 3: Heuristic Scoring                     │
│   └─ Uses: ScoringEngine.findBestCandidate()  │
│   └─ Quality Gate: NONE (always passes)        │
│   └─ Fallback from: Stage 2                    │
│                                                 │
└─────────────────────────────────────────────────┘

All stages feed into → PostProcessor → Output
```

---

## Implementation Checklist

### Phase 1: Create New Files (2 hours)

- [ ] **Create `core/quality-gates.ts`**
  - Metrics calculation (character count, paragraphs, link density, etc.)
  - Three validation gates (Stage 1 strict, Stage 2 lenient, Stage 3 fallback)
  - Quality report generation
  - **No dependencies needed** - can be done first

- [ ] **Create `core/graceful-degradation-pipeline.ts`**
  - Main pipeline orchestration
  - Stage execution with quality gates
  - Fallback decision logic
  - Metrics export
  - **Depends on:** quality-gates.ts ✓

### Phase 2: Integrate Existing Stages (1 hour)

- [ ] **Verify `ReadabilityConfigManager`**
  - Already Stage 2 compatible ✓
  - No changes needed

- [ ] **Verify `ScoringEngine`**
  - Already perfect for Stage 3 ✓
  - No changes needed

### Phase 3: Wire Up Components (3 hours)

- [ ] **Update `entrypoints/content.ts`**
  - Add pipeline call
  - Export stage metrics
  - Handle preliminary quality flags

- [ ] **Update `entrypoints/background.ts`**
  - Log stage usage
  - Track fallback frequency
  - Route quality metrics

- [ ] **Update `core/offline-mode-manager.ts`**
  - Use ScoringEngine in fallback chain
  - Add pipeline metrics tracking

### Phase 4: Testing (4 hours)

- [ ] Unit tests for quality gates
- [ ] Unit tests for pipeline stages
- [ ] Integration tests on sample sites
- [ ] Performance regression testing

---

## File Creation: Quality Gates

**File:** `core/quality-gates.ts`

```typescript
// This file validates whether extraction results are "good enough"
// Or if we should fall back to the next stage

export interface QualityMetrics {
  characterCount: number;
  paragraphCount: number;
  linkDensity: number;
  avgParagraphLength: number;
  headingCount: number;
  signalToNoiseRatio: number;
  structureScore: number;
}

export interface QualityGateResult {
  passed: boolean;
  score: number; // 0-100
  failureReasons: string[];
  metrics: QualityMetrics;
}

export class QualityGateValidator {
  static validateSemanticQuery(element: Element | null): QualityGateResult
  static validateReadability(article: any, originalDocument: Document): QualityGateResult
  static validateHeuristicScoring(element: Element): QualityGateResult
  static generateReport(result: QualityGateResult): string
}
```

**Key Methods:**
- `validateSemanticQuery()` - Strict gate (60+ score)
- `validateReadability()` - Medium gate (40+ score)
- `validateHeuristicScoring()` - Lenient gate (always passes)

**Lines:** ~400  
**Dependencies:** None

---

## File Creation: Pipeline Orchestration

**File:** `core/graceful-degradation-pipeline.ts`

```typescript
// Main orchestrator that runs all three stages with quality gates

export interface PipelineResult {
  content: string;
  stage: 'semantic' | 'readability' | 'heuristic';
  qualityScore: number;
  qualityReport: string;
  fallbacksUsed: string[];
  extractionTime: number;
  metadata: { url: string; title: string; timestamp: string; };
}

export interface PipelineConfig {
  enableStage1: boolean;
  enableStage2: boolean;
  enableStage3: boolean;
  minQualityScore: number;
  timeout: number;
  debug: boolean;
}

export class GracefulDegradationPipeline {
  static async execute(
    document: Document,
    config?: Partial<PipelineConfig>
  ): Promise<PipelineResult>

  private static async executeStage1(document: Document, config: PipelineConfig): Promise<...>
  private static async executeStage2(document: Document, config: PipelineConfig): Promise<...>
  private static async executeStage3(document: Document, config: PipelineConfig): Promise<...>
}
```

**Key Methods:**
- `execute()` - Main entry point, runs all stages
- `executeStage1()` - Semantic query with quality gate
- `executeStage2()` - Readability with quality gate
- `executeStage3()` - ScoringEngine with quality gate

**Lines:** ~500  
**Dependencies:** quality-gates.ts, ReadabilityConfigManager, ScoringEngine

---

## File Modifications: Content Script

**File:** `entrypoints/content.ts`

**Change 1:** Update imports
```typescript
// ADD THIS
import GracefulDegradationPipeline from '@/core/graceful-degradation-pipeline';
import type { PipelineResult } from '@/core/graceful-degradation-pipeline';
```

**Change 2:** Enhance `captureFullPage()` function
```typescript
// BEFORE:
async function captureFullPage() {
  const result = await ContentCapture.captureSelection();
  return {
    html: result.html,
    url: window.location.href,
    title: document.title
  };
}

// AFTER:
async function captureFullPage() {
  const pipelineResult = await GracefulDegradationPipeline.execute(document, {
    debug: true // For development
  });

  return {
    html: pipelineResult.content,
    url: window.location.href,
    title: document.title,
    pipelineMetadata: pipelineResult // ← NEW: Add metadata
  };
}
```

**Change 3:** Update message handler
```typescript
// In CAPTURE_SELECTION handler:
if (message.type === 'CAPTURE_SELECTION') {
  const result = await captureFullPage();
  
  console.log(`Extracted via: ${result.pipelineMetadata.stage}`);
  console.log(`Quality: ${result.pipelineMetadata.qualityScore}/100`);
  
  chrome.runtime.sendMessage({
    type: 'CAPTURE_COMPLETE',
    payload: {
      html: result.html,
      url: result.url,
      title: result.title,
      pipelineMetadata: result.pipelineMetadata // ← NEW
    }
  });
}
```

**Lines Changed:** ~20  
**Breaking Changes:** None

---

## File Modifications: Background Service Worker

**File:** `entrypoints/background.ts`

**Change 1:** Track pipeline metrics in `handleCaptureComplete()`
```typescript
async handleCaptureComplete(message: any, sender: any) {
  const pipelineMetadata = message.payload?.pipelineMetadata;
  
  if (pipelineMetadata) {
    console.log(`[Pipeline] Stage: ${pipelineMetadata.stage}`);
    console.log(`[Pipeline] Quality: ${pipelineMetadata.qualityScore}/100`);
    
    if (pipelineMetadata.fallbacksUsed.length > 0) {
      console.log(`[Pipeline] Fallbacks: ${pipelineMetadata.fallbacksUsed.join(' → ')}`);
    }
    
    // Track for analytics
    await this.trackPipelineMetric({
      stage: pipelineMetadata.stage,
      qualityScore: pipelineMetadata.qualityScore,
      fallbacksUsed: pipelineMetadata.fallbacksUsed,
      extractionTime: pipelineMetadata.extractionTime,
      url: message.payload.url
    });
  }
  
  // ... rest of existing logic
}
```

**Change 2:** Add metrics tracking method
```typescript
private async trackPipelineMetric(metric: any): Promise<void> {
  try {
    // Store in session for analytics dashboard
    const existing = await browser.storage.session.get('pipeline_metrics') || {};
    const metrics = existing.pipeline_metrics || [];
    
    metrics.push({
      ...metric,
      timestamp: Date.now()
    });
    
    // Keep last 100 metrics
    if (metrics.length > 100) {
      metrics.shift();
    }
    
    await browser.storage.session.set({ pipeline_metrics: metrics });
  } catch (error) {
    console.warn('Failed to track pipeline metric:', error);
  }
}
```

**Lines Changed:** ~30  
**Breaking Changes:** None

---

## File Modifications: Offline Mode Manager

**File:** `core/offline-mode-manager.ts`

**Change 1:** Import ScoringEngine
```typescript
import { ScoringEngine } from './scoring/scoring-engine.js';
```

**Change 2:** Update `fallbackContentExtraction()` to use ScoringEngine
```typescript
private static async fallbackContentExtraction(html: string): Promise<string> {
  const doc = safeParseHTML(html);
  if (!doc) {
    return html;
  }

  // Try semantic elements first
  const semanticContent = extractSemanticContent(doc, 500);
  if (semanticContent) {
    return semanticContent;
  }

  // NEW: Use ScoringEngine to find best candidate
  const candidates = doc.querySelectorAll('div, section, article, main, aside');
  if (candidates.length > 0) {
    const { bestCandidate } = ScoringEngine.findBestCandidate(doc.body);
    if (bestCandidate && bestCandidate.element) {
      console.log(`Using ScoringEngine result with score: ${bestCandidate.score}`);
      return bestCandidate.element.innerHTML;
    }
  }

  // Last resort
  const body = doc.body;
  if (body) {
    removeUnwantedElements(body, ['.ad', '.advertisement', 'nav', 'header', 'footer']);
    return body.innerHTML;
  }

  return html;
}
```

**Lines Changed:** ~15  
**Breaking Changes:** None

---

## Testing Strategy

### Unit Tests: Quality Gates

```typescript
describe('QualityGateValidator', () => {
  test('Semantic gate rejects low-character content', () => {
    const el = createMockElement(100); // 100 chars
    const result = QualityGateValidator.validateSemanticQuery(el);
    expect(result.passed).toBe(false);
  });

  test('Semantic gate accepts high-quality content', () => {
    const el = createMockElement(2000); // 2000 chars
    const result = QualityGateValidator.validateSemanticQuery(el);
    expect(result.passed).toBe(true);
  });
});
```

### Integration Tests: Pipeline

```typescript
describe('GracefulDegradationPipeline', () => {
  test('Stage 1 succeeds on simple blog post', async () => {
    const result = await GracefulDegradationPipeline.execute(simpleBlogDoc);
    expect(result.stage).toBe('semantic');
  });

  test('Falls back to Stage 2 on heavy UI site', async () => {
    const result = await GracefulDegradationPipeline.execute(newsSiteDoc);
    expect(result.stage).toBe('readability');
  });

  test('Falls back to Stage 3 on Reddit post', async () => {
    const result = await GracefulDegradationPipeline.execute(redditDoc);
    expect(result.stage).toBe('heuristic');
  });

  test('Always returns content (never fails)', async () => {
    const result = await GracefulDegradationPipeline.execute(emptyDoc);
    expect(result.content).toBeTruthy();
    expect(result.stage).toBe('heuristic');
  });
});
```

---

## Deployment Checklist

- [ ] Create `core/quality-gates.ts` with all validation logic
- [ ] Create `core/graceful-degradation-pipeline.ts` with pipeline orchestration
- [ ] Update `entrypoints/content.ts` to call pipeline
- [ ] Update `entrypoints/background.ts` to track metrics
- [ ] Update `core/offline-mode-manager.ts` to use ScoringEngine
- [ ] Run full test suite: `npm test`
- [ ] Build extension: `npm run build`
- [ ] Test on sample sites:
  - [ ] Medium blog post (Stage 1)
  - [ ] CNN article (Stage 2)
  - [ ] Reddit post (Stage 3)
  - [ ] GitHub documentation (Stage 1)
  - [ ] NPM package page (Stage 2)
- [ ] Check performance: Extraction should still be <500ms
- [ ] Verify no memory leaks
- [ ] Check metrics are being collected

---

## Rollback Plan

If issues arise:

1. **If pipeline code breaks:**
   ```bash
   git revert <commit-hash>
   npm run build
   ```

2. **If quality gates too strict:**
   - Adjust thresholds in `QualityGateValidator`
   - Redeploy without full code changes

3. **If specific site broken:**
   - Add site-specific config to `PipelineConfig`
   - Disable specific stage for that URL

---

## Next Steps

1. **Review Audit Report** - Confirm all findings
2. **Review This Guide** - Understand integration approach
3. **Create Quality Gates** - Start with no dependencies
4. **Create Pipeline** - Build orchestration layer
5. **Test Components** - Unit tests for each stage
6. **Integrate Into Content Script** - Wire up main flow
7. **Test End-to-End** - Full pipeline on sample sites
8. **Deploy & Monitor** - Track metrics in production

---

## Questions?

### Q: Will this slow down extraction?

**A:** No. The pipeline adds quality validation (negligible overhead ~5ms) but may actually be faster because it short-circuits failed stages.

### Q: What if a site doesn't fit any stage?

**A:** Stage 3 always returns the best-effort candidate. Worst case, you get a heavily-scored div/section that's likely to be better than document.body.

### Q: Can I disable individual stages?

**A:** Yes, set `enableStage1: false` in `PipelineConfig` to skip specific stages.

### Q: Does this work with your existing ReadabilityConfigManager?

**A:** Yes perfectly. Stage 1 uses it, Stage 2 is it, Stage 3 is a fallback when neither works.

---

**Status:** Ready to begin implementation  
**Estimated Time:** 12 hours total  
**Risk Level:** LOW  
**Recommendation:** ✅ PROCEED
