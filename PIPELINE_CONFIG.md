# Pipeline Configuration Guide

## Overview

The `PipelineConfig` interface allows runtime tuning of the graceful degradation pipeline without code changes. This enables A/B testing, performance optimization, and quality control.

## Configuration Interface

```typescript
export interface PipelineConfig {
  enableStage1: boolean;      // Enable semantic query extraction
  enableStage2: boolean;      // Enable Readability extraction
  enableStage3: boolean;      // Enable heuristic scoring (fallback)
  minQualityScore: number;    // Minimum quality score (0-100) for acceptance
  timeout: number;            // Max execution time in milliseconds
  debug: boolean;             // Enable debug logging
}
```

## Parameters

### `enableStage1` (default: `true`)

**Semantic Query Extraction**

Attempts to extract content from semantic HTML elements:
- `<article>` tag
- `<main>` tag
- Elements with `role="main"` or `role="article"`

**Use Cases:**
- Disable when testing pure Readability performance
- Disable for non-semantic websites (e.g., older sites, SPA frameworks without semantic markup)
- Keep enabled for modern, well-structured content

**Performance Impact:** Fastest stage (~5-50ms)

---

### `enableStage2` (default: `true`)

**Readability Extraction**

Uses Mozilla Readability library for intelligent content extraction with:
- HTML cleanup
- Boilerplate removal
- Content score calculation

**Use Cases:**
- Disable for performance-critical environments
- Disable if Readability library conflicts with other code
- Keep enabled for mixed-quality content sources

**Performance Impact:** Medium stage (~100-500ms)

---

### `enableStage3` (default: `true`)

**Heuristic Scoring (Safety Net)**

Uses custom ScoringEngine to find the best content container through:
- DOM analysis
- Container scoring
- Best candidate selection

**Use Cases:**
- Should always be enabled (provides fallback guarantee)
- Disable only if completely disabling fallbacks (not recommended)
- Acts as safety net when other stages fail

**Performance Impact:** Variable (~50-1000ms depending on page complexity)

---

### `minQualityScore` (default: `0`)

**Minimum Quality Threshold**

Enforces a minimum quality score for pipeline success:
- Range: 0-100
- Stages return only if quality score meets this threshold
- Falls through to next stage if score is below threshold

**Quality Score Components:**
- Character count (0-30 points)
- Paragraph count (0-20 points)
- Link density (0-20 points)
- Signal-to-noise ratio (0-15 points)
- Structure score (0-15 points)

**Recommended Values:**
- `0`: Accept any result (default, fastest)
- `30`: Reject obviously poor extractions
- `60`: Strict quality mode (recommended for production)
- `80`: Very strict, rare success

**Use Cases:**
- Production: Set to `60` for best quality
- Testing: Set to `0` for speed
- A/B testing: Compare results at different thresholds
- Mobile/slow networks: Set to `30` for balanced speed/quality

---

### `timeout` (default: `5000`)

**Execution Timeout**

Maximum time allowed for complete pipeline execution in milliseconds.

**Timeout Behavior:**
- If exceeded, pipeline throws timeout error
- Best-effort fallback uses last successful stage result
- Error handler catches timeout and provides recovery option

**Recommended Values:**
- `5000`: Default (5 seconds) - good balance
- `2000`: Fast mode (for interactive UX)
- `10000`: Slow network friendly
- `0`: Disable timeout (not recommended)

**Use Cases:**
- Browser extensions: 2000-3000ms (don't block UI)
- Server-side: 5000ms or higher
- Mobile devices: 3000-5000ms
- Performance critical: 1000-2000ms

---

## Usage Examples

### Example 1: Production Quality Mode

```typescript
const config: Partial<PipelineConfig> = {
  enableStage1: true,
  enableStage2: true,
  enableStage3: true,
  minQualityScore: 60,      // Enforce quality
  timeout: 5000,            // Standard timeout
  debug: false,             // Suppress debug logs
};

const result = await GracefulDegradationPipeline.execute(document, config);
```

### Example 2: Speed-Optimized Mode

```typescript
const config: Partial<PipelineConfig> = {
  enableStage1: true,
  enableStage2: false,      // Skip Readability for speed
  enableStage3: true,
  minQualityScore: 0,       // Accept any result
  timeout: 1500,            // Fast timeout
  debug: false,
};

const result = await GracefulDegradationPipeline.execute(document, config);
```

### Example 3: Readability-Only Test

```typescript
const config: Partial<PipelineConfig> = {
  enableStage1: false,      // Skip semantic
  enableStage2: true,
  enableStage3: true,
  minQualityScore: 40,      // Readability gate
  timeout: 3000,
  debug: true,              // Show what's happening
};

const result = await GracefulDegradationPipeline.execute(document, config);
```

### Example 4: Mobile Device Mode

```typescript
const config: Partial<PipelineConfig> = {
  enableStage1: true,
  enableStage2: true,
  enableStage3: true,
  minQualityScore: 30,      // Relax quality for connectivity
  timeout: 4000,            // More time for network delays
  debug: false,
};

const result = await GracefulDegradationPipeline.execute(document, config);
```

## Quality Score Interpretation

The quality score returned in `PipelineResult` indicates extraction confidence:

```
0-20:   Poor     - Very low confidence, likely noise/boilerplate
21-40:  Fair     - Acceptable but noisy, may need cleanup
41-60:  Good     - Solid extraction, readable content
61-80:  Very Good - High confidence, minimal noise
81-100: Excellent - Near-perfect extraction
```

## Best Practices

### For Browser Extensions
```typescript
minQualityScore: 50        // Balance quality and responsiveness
timeout: 2000              // Don't block UI thread too long
enableStage1: true         // Always try fast semantic first
```

### For Server-Side Processing
```typescript
minQualityScore: 70        // Can afford to retry
timeout: 10000             // More time available
enableStage1: true
enableStage2: true
enableStage3: true         // Safety net important at scale
```

### For Content Curation Platforms
```typescript
minQualityScore: 80        // Only publish high-quality extracts
timeout: 5000              // Standard server processing
enableStage1: true
enableStage2: true
enableStage3: true
debug: true                // Log rejections for analysis
```

### For Accessibility/Search Engines
```typescript
minQualityScore: 40        // Include more content
timeout: 8000              // Batch processing is fine
enableStage1: true
enableStage2: true
enableStage3: true
debug: false               // Optimize for throughput
```

## Monitoring Configuration Performance

Track effectiveness of configuration changes:

```typescript
// Before
const resultsBefore = await batchProcess(documents, oldConfig);
const qualityBefore = resultsBefore.filter(r => r.success).length / documents.length;

// After
const resultsAfter = await batchProcess(documents, newConfig);
const qualityAfter = resultsAfter.filter(r => r.success).length / documents.length;

// Compare
console.log(`Quality improvement: ${((qualityAfter - qualityBefore) * 100).toFixed(1)}%`);
```

## Configuration Storage

Store configurations in browser storage for persistence:

```typescript
// Save configuration
const config: Partial<PipelineConfig> = { minQualityScore: 60, timeout: 5000 };
await browser.storage.sync.set({ pipelineConfig: config });

// Load configuration
const { pipelineConfig } = await browser.storage.sync.get('pipelineConfig');
const result = await GracefulDegradationPipeline.execute(document, pipelineConfig);
```

## Troubleshooting

| Problem | Check | Solution |
|---------|-------|----------|
| Extraction too slow | `timeout` | Reduce from 5000 to 2000-3000ms |
| Too many failed extractions | `minQualityScore` | Reduce from 80 to 60 or 40 |
| Missing content | `enableStage2` | Ensure Readability is enabled |
| Including boilerplate | `minQualityScore` | Increase from 0 to 50-70 |
| Inconsistent results | `debug: true` | Enable debug logs, check quality scores |

## See Also

- [Graceful Degradation Integration Guide](./GRACEFUL_DEGRADATION_INTEGRATION_GUIDE.md)
- [Quality Gates Documentation](./COMPATIBILITY_MATRIX.md)
- [Performance Metrics](./PERFORMANCE_INTEGRATION_SUMMARY.md)
