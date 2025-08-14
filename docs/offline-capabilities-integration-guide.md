# PromptReady Offline Capabilities Integration Guide

This guide explains how to integrate the redesigned offline capabilities system into your PromptReady extension.

## Overview

The new offline capabilities system provides:
- **Streamlined UI**: Simple Offline/AI mode toggle
- **Robust Processing**: Optimized Readability.js + Turndown.js pipeline
- **Error Handling**: Comprehensive fallback mechanisms
- **Quality Validation**: Content quality assessment and scoring
- **Performance**: Optimized for large content with chunking support

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Simplified     │    │   Background     │    │   Offscreen     │
│  Popup UI       │◄──►│   Script         │◄──►│   Processor     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │ Offline Mode     │
                       │ Manager          │
                       └──────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
        ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
        │ Readability │ │  Turndown   │ │    Post     │
        │   Config    │ │   Config    │ │ Processor   │
        └─────────────┘ └─────────────┘ └─────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │ Error Handler &  │
                       │ Quality Validator│
                       └──────────────────┘
```

## Integration Steps

### Step 1: Update Background Script

Replace the existing content processor in `entrypoints/background.ts`:

```typescript
import { OfflineModeManager } from '../core/offline-mode-manager.js';
import { ErrorHandler } from '../core/error-handler.js';

// In your ContentProcessor class, replace handleCaptureComplete:
async handleCaptureComplete(message: CaptureCompleteMessage): Promise<void> {
  try {
    const { html, url, title, selectionHash } = message.payload;
    const settings = await Storage.getSettings();
    
    // Use the new offline mode manager
    if (settings.mode === 'offline') {
      await this.ensureOffscreenDocument();
      await browser.runtime.sendMessage({
        type: 'ENHANCED_OFFSCREEN_PROCESS',
        payload: { 
          html, 
          url, 
          title, 
          selectionHash, 
          mode: settings.mode,
          useReadability: settings.useReadability !== false,
          renderer: settings.renderer || 'turndown'
        },
      });
    } else {
      // AI mode processing (future implementation)
      await this.processWithAI(html, url, title, settings);
    }
    
  } catch (error) {
    console.error('Content processing failed:', error);
    const fallbackResult = await ErrorHandler.handleError(error, {
      stage: 'content-extraction',
      operation: 'handleCaptureComplete',
      input: { html: message.payload.html, url: message.payload.url }
    });
    
    if (fallbackResult.success) {
      // Use fallback result
      this.broadcastSuccess(fallbackResult.result);
    } else {
      this.broadcastError(`Processing failed: ${fallbackResult.errors.join(', ')}`);
    }
  }
}
```

### Step 2: Update Offscreen Document

Replace `entrypoints/offscreen/main.ts` with the enhanced processor:

```typescript
import { EnhancedOffscreenProcessor } from './enhanced-processor.js';

// Initialize the enhanced processor
const processor = EnhancedOffscreenProcessor.getInstance();

console.log('Enhanced offscreen processor initialized');
```

### Step 3: Update Popup UI

Replace the existing popup with the simplified version:

```typescript
// In entrypoints/popup/index.tsx
import SimplifiedPopup from './components/SimplifiedPopup.js';

function App() {
  return <SimplifiedPopup />;
}

export default App;
```

### Step 4: Update Settings Management

Add new settings to `lib/types.ts`:

```typescript
export interface Settings {
  mode: 'offline' | 'ai';
  // ... existing settings
  
  // New offline-specific settings
  offlineConfig?: {
    readabilityPreset?: string;
    turndownPreset: string;
    postProcessing: {
      enabled: boolean;
      addTableOfContents: boolean;
      optimizeForPlatform?: 'standard' | 'obsidian' | 'github';
    };
    performance: {
      maxContentLength: number;
      enableCaching: boolean;
    };
  };
}
```

## Configuration Examples

### Basic Offline Configuration

```typescript
const basicConfig = {
  turndownPreset: 'standard',
  postProcessing: {
    enabled: true,
    addTableOfContents: false,
    optimizeForPlatform: 'standard',
  },
  performance: {
    maxContentLength: 1000000, // 1MB
    enableCaching: true,
  },
};
```

### GitHub-Optimized Configuration

```typescript
const githubConfig = {
  readabilityPreset: 'technical-documentation',
  turndownPreset: 'github',
  postProcessing: {
    enabled: true,
    addTableOfContents: true,
    optimizeForPlatform: 'github',
  },
  performance: {
    maxContentLength: 2000000, // 2MB for docs
    enableCaching: true,
  },
};
```

### Obsidian-Optimized Configuration

```typescript
const obsidianConfig = {
  readabilityPreset: 'blog-article',
  turndownPreset: 'obsidian',
  postProcessing: {
    enabled: true,
    addTableOfContents: false,
    optimizeForPlatform: 'obsidian',
  },
  performance: {
    maxContentLength: 1500000, // 1.5MB
    enableCaching: true,
  },
};
```

## Testing Framework

### Unit Tests

Create tests for each component:

```typescript
// tests/offline-processor.test.ts
import { OfflineModeManager } from '../core/offline-mode-manager.js';

describe('OfflineModeManager', () => {
  test('should process simple HTML content', async () => {
    const html = '<h1>Test</h1><p>Content</p>';
    const result = await OfflineModeManager.processContent(
      html, 
      'https://example.com', 
      'Test Page'
    );
    
    expect(result.success).toBe(true);
    expect(result.markdown).toContain('# Test');
    expect(result.markdown).toContain('Content');
  });
  
  test('should handle large content with chunking', async () => {
    const largeHtml = '<p>' + 'x'.repeat(1000000) + '</p>';
    const result = await OfflineModeManager.processLargeContent(
      largeHtml,
      'https://example.com',
      'Large Page'
    );
    
    expect(result.success).toBe(true);
    expect(result.processingStats.fallbacksUsed).toContain('content-chunking');
  });
});
```

### Integration Tests

Test the complete pipeline:

```typescript
// tests/integration.test.ts
describe('Complete Processing Pipeline', () => {
  test('should process real website content', async () => {
    // Fetch real content
    const response = await fetch('https://example.com');
    const html = await response.text();
    
    const result = await OfflineModeManager.processContent(
      html,
      'https://example.com',
      'Example Site'
    );
    
    expect(result.success).toBe(true);
    expect(result.processingStats.qualityScore).toBeGreaterThan(60);
  });
});
```

### Performance Tests

```typescript
// tests/performance.test.ts
describe('Performance Tests', () => {
  test('should process content within time limits', async () => {
    const html = generateLargeHtml(500000); // 500KB
    const startTime = performance.now();
    
    const result = await OfflineModeManager.processContent(
      html,
      'https://example.com',
      'Performance Test'
    );
    
    const processingTime = performance.now() - startTime;
    expect(processingTime).toBeLessThan(10000); // 10 seconds max
    expect(result.success).toBe(true);
  });
});
```

## Error Handling Examples

### Handling Readability Failures

```typescript
try {
  const result = await OfflineModeManager.processContent(html, url, title);
  if (!result.success) {
    console.warn('Processing failed, using fallbacks:', result.fallbacksUsed);
  }
} catch (error) {
  const fallbackResult = await ErrorHandler.handleError(error, {
    stage: 'readability-processing',
    operation: 'processContent',
    input: { html, url }
  });
  
  if (fallbackResult.success) {
    // Use fallback result
    return fallbackResult.result;
  } else {
    // Show user-friendly error
    showToast('Content extraction failed. Please try again.', 'error');
  }
}
```

### Handling Network Issues

```typescript
// In background script
browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  try {
    // Process message
  } catch (error) {
    if (error.message.includes('network')) {
      // Handle network errors gracefully
      const fallbackResult = await ErrorHandler.handleError(error, {
        stage: 'initialization',
        operation: 'messageHandler',
      });
      
      if (fallbackResult.fallbackUsed === 'retry') {
        // Retry the operation
        setTimeout(() => {
          // Retry logic
        }, 2000);
      }
    }
  }
});
```

## Quality Validation

### Implementing Quality Checks

```typescript
import { ContentQualityValidator } from '../core/content-quality-validator.js';

const result = await OfflineModeManager.processContent(html, url, title);

if (result.success) {
  const qualityReport = ContentQualityValidator.validate(
    result.markdown,
    html,
    result.processingStats
  );
  
  if (!qualityReport.passesThreshold) {
    console.warn('Quality below threshold:', qualityReport.overallScore);
    console.log('Recommendations:', qualityReport.recommendations);
    
    // Show quality warning to user
    showToast(
      `Content quality: ${qualityReport.overallScore}/100. ${qualityReport.recommendations[0]}`,
      'warning'
    );
  }
}
```

## Deployment Checklist

- [ ] Update background script with new processing logic
- [ ] Replace offscreen document with enhanced processor
- [ ] Update popup UI with simplified interface
- [ ] Add new settings to storage schema
- [ ] Test with various website types
- [ ] Validate error handling scenarios
- [ ] Performance test with large content
- [ ] Update extension permissions if needed
- [ ] Test offline functionality
- [ ] Validate quality scoring system

## Migration Notes

### From Existing System

1. **Settings Migration**: Existing `mode` values ('general', 'code_docs') will be automatically migrated to 'offline'
2. **API Compatibility**: The new system maintains compatibility with existing message types
3. **Gradual Rollout**: You can enable the new system gradually by feature flag

### Breaking Changes

- `OFFSCREEN_PROCESS` message type is replaced with `ENHANCED_OFFSCREEN_PROCESS`
- Quality validation is now mandatory and may affect processing results
- Some advanced Turndown configurations may need adjustment

## Troubleshooting

### Common Issues

1. **High Memory Usage**: Enable content chunking for large pages
2. **Poor Quality Scores**: Adjust Readability configuration for specific content types
3. **Slow Processing**: Increase timeout values or enable caching
4. **Fallback Overuse**: Review and tune primary processing configurations

### Debug Mode

Enable debug logging:

```typescript
const config = {
  // ... other config
  debug: true,
  logErrors: true,
};
```

This comprehensive integration guide provides everything needed to implement the redesigned offline capabilities system in your PromptReady extension.
