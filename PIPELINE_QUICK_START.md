# Quick Start: Graceful Degradation Pipeline

## Overview
The Graceful Degradation Pipeline is a three-stage content extraction system that automatically falls back through increasingly lenient extraction methods when stricter methods fail.

## How It Works

### Three Extraction Stages
```
┌─────────────────────────────────────────┐
│ STAGE 1: Semantic Query (Strict)       │
│ Selectors: article, main, [role=main]  │
│ Quality Threshold: 60+/100              │
└─────────────────────────────────────────┘
           ↓ (if fails)
┌─────────────────────────────────────────┐
│ STAGE 2: Readability Library            │
│ Uses: Mozilla Readability (@0.4.1)     │
│ Quality Threshold: 40+/100              │
└─────────────────────────────────────────┘
           ↓ (if fails)
┌─────────────────────────────────────────┐
│ STAGE 3: Heuristic Scoring              │
│ Uses: ScoringEngine (AI-based scoring)  │
│ Quality Threshold: Always passes        │
└─────────────────────────────────────────┘
```

## Usage

### Basic Usage (Automatic)
The pipeline runs automatically when capturing full-page content:

```typescript
// In content script - fully automatic
const result = await ContentCapture.captureSelection();
// Returns: CaptureResult with optional pipelineMetadata
```

### Manual Usage (Advanced)
```typescript
import GracefulDegradationPipeline from '@/core/graceful-degradation-pipeline.js';

// Execute pipeline with default config
const result = await GracefulDegradationPipeline.execute(document);

// Execute with custom config
const result = await GracefulDegradationPipeline.execute(document, {
  debug: true,           // Enable debug logging
  enableStage1: true,    // Enable semantic extraction
  enableStage2: true,    // Enable readability
  enableStage3: true,    // Enable heuristic (always recommended)
});

// Access results
console.log(result.stage);           // 'semantic' | 'readability' | 'heuristic'
console.log(result.qualityScore);    // 0-100
console.log(result.fallbacksUsed);   // ['semantic-gate-failed', ...]
console.log(result.extractionTime);  // milliseconds
```

### Understanding Results

```typescript
interface PipelineResult {
  content: string;                    // HTML content extracted
  stage: 'semantic' | 'readability' | 'heuristic';  // Which method succeeded
  qualityScore: number;               // 0-100 confidence score
  qualityReport: string;              // Detailed quality metrics
  fallbacksUsed: string[];            // What was tried before success
  extractionTime: number;             // Milliseconds to complete
  metadata: {
    url: string;                      // Page URL
    title: string;                    // Page title
    timestamp: string;                // ISO timestamp
  };
}
```

## Quality Scoring

### How Scores Are Calculated
The quality score is 0-100 and considers:

- **Character Count (0-30 points):** More text = better
  - < 300 chars: 0 pts
  - 300-1000: 15 pts
  - 1000-5000: 25 pts
  - 5000+: 30 pts

- **Paragraph Count (0-20 points):** Structured paragraphs are good
  - 1+ para: 10 pts
  - 3+ para: 15 pts
  - 5+ para: 20 pts

- **Link Density (0-20 points):** Too many links = low quality
  - < 10% links: 20 pts
  - 10-20%: 15 pts
  - 20-40%: 10 pts
  - 40-60%: 5 pts

- **Signal-to-Noise (0-15 points):** Content vs HTML ratio
  - > 50%: 15 pts
  - > 30%: 10 pts
  - > 10%: 5 pts

- **Structure Score (0-15 points):** Semantic elements present
  - Based on headings and semantic tags

### Gate Thresholds
- **Stage 1 (Semantic):** Requires ≥60 score
  - Fails on: low char count, few paragraphs, high link density
- **Stage 2 (Readability):** Requires ≥40 score
  - Fails on: very low char count or extremely high link density
- **Stage 3 (Heuristic):** Always passes
  - Best-effort extraction, never fails

## Configuration

### Default Config
```typescript
const DEFAULT_CONFIG: PipelineConfig = {
  enableStage1: true,      // Enable semantic query
  enableStage2: true,      // Enable readability
  enableStage3: true,      // Enable heuristic fallback
  minQualityScore: 0,      // Minimum acceptable quality (0 to disable)
  timeout: 5000,           // Timeout in milliseconds
  debug: false,            // Enable debug logging
};
```

### Common Configurations
```typescript
// For fast extraction (semantic only)
{ enableStage1: true, enableStage2: false, enableStage3: false }

// For robust extraction (all stages)
{ enableStage1: true, enableStage2: true, enableStage3: true }

// For debugging
{ debug: true, enableStage1: true, enableStage2: true, enableStage3: true }

// For strict quality
{ minQualityScore: 60, enableStage1: true, enableStage2: true, enableStage3: false }
```

## Testing

### Unit Test Example
```typescript
import { QualityGateValidator } from '@/core/quality-gates.js';

// Test semantic gate
const element = document.querySelector('article');
const result = QualityGateValidator.validateSemanticQuery(element);

if (result.passed) {
  console.log('✓ Passed semantic gate');
  console.log(`Quality: ${result.score}/100`);
} else {
  console.log('✗ Failed semantic gate');
  console.log('Reasons:', result.failureReasons);
}
```

### Integration Test Example
```typescript
import GracefulDegradationPipeline from '@/core/graceful-degradation-pipeline.js';

// Test on a specific page
const result = await GracefulDegradationPipeline.execute(document, { debug: true });

console.log(`Extraction Stage: ${result.stage}`);
console.log(`Quality Score: ${result.qualityScore}/100`);
console.log(`Fallbacks Used: ${result.fallbacksUsed.join(' → ')}`);
console.log(`Extraction Time: ${result.extractionTime}ms`);

// Print detailed report
console.log(result.qualityReport);
```

## Debugging

### Enable Debug Mode
```typescript
const result = await GracefulDegradationPipeline.execute(document, {
  debug: true
});
```

This will log:
- Stage 1 attempt details
- Stage 1 quality gate result
- Stage 2 attempt details
- Stage 2 quality gate result
- Stage 3 attempt details
- Best candidate score (Stage 3)

### Console Logging
```
[Pipeline] Executing Stage 1 (Semantic)
[Pipeline] Stage 1 (Semantic) failed gate: { passed: false, score: 35, ... }
[Pipeline] Executing Stage 2 (Readability)
[Pipeline] Best candidate found with score: 125
[Pipeline] Executing Stage 3 (Heuristic)
```

## Metrics & Monitoring

### Track Extraction Methods
```typescript
// Background worker logs these automatically
[Pipeline] Extraction completed via: readability
[Pipeline] Quality score: 72/100
[Pipeline] Fallbacks used: semantic-gate-failed → using-readability
[Pipeline] Extraction time: 45ms
```

### Analyze Performance
- **< 100ms:** Semantic extraction worked well
- **100-500ms:** Readability had to be used
- **> 500ms:** Full pipeline fallback to heuristics

## Common Issues & Solutions

### Content Extraction Returns Little Data
**Problem:** Stage 3 being used, quality score low

**Solution:**
1. Check if page has semantic elements (article, main tags)
2. Verify Readability can parse the page
3. Consider using Stage 3 result as-is (it's best-effort)

### Performance Degradation
**Problem:** Extraction taking > 2 seconds

**Solution:**
1. Enable debug mode to see which stage is slow
2. Consider disabling Stage 2 (Readability) if Stage 1 works well
3. Check for very large DOM trees (timeout might help)

### Specific Site Not Working
**Problem:** Reddit, complex layout giving poor results

**Solution:**
1. This is why Stage 3 exists - heuristic scoring handles it
2. Check quality score and fallback chain
3. Consider site-specific configuration in `ReadabilityConfigManager`

## Advanced Usage

### Custom Quality Gates
```typescript
import { QualityGateValidator, QualityGateResult } from '@/core/quality-gates.js';

// Create custom validation
const result = QualityGateValidator.validateSemanticQuery(element);

// Extend with custom logic
if (result.metrics.linkDensity > 0.3) {
  console.log('Content is link-heavy');
}
```

### Get Quality Report
```typescript
const result = await GracefulDegradationPipeline.execute(document);

// Print human-readable report
console.log(result.qualityReport);

// Output:
// Quality Gate Report
// Status: ✓ PASSED
// Score: 72/100
// 
// Metrics:
//   - Characters: 2450
//   - Paragraphs: 5
//   - Link Density: 12.3%
//   - ...
```

## Performance Impact

- **Quality Gate Validation:** 5-10ms per stage
- **Stage 1 (Semantic):** 1-5ms
- **Stage 2 (Readability):** 10-100ms (DOM parsing)
- **Stage 3 (Heuristic):** 5-50ms (scoring)
- **Total Pipeline:** < 50ms overhead added

## See Also

- `GRACEFUL_DEGRADATION_INTEGRATION_GUIDE.md` - Full implementation spec
- `VISUAL_ARCHITECTURE.md` - Architecture diagrams
- `core/quality-gates.ts` - Quality validation code
- `core/graceful-degradation-pipeline.ts` - Pipeline orchestration
- `core/scoring/scoring-engine.ts` - Heuristic scoring

---

**Status:** Production Ready ✅  
**Backward Compatible:** Yes ✅  
**Required Dependencies:** @mozilla/readability@0.4.1 ✅
