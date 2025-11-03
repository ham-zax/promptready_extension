// Performance Metrics Integration Test
// Verifies that the enhanced PerformanceMetrics integration works correctly

import { OfflineModeManager } from '../core/offline-mode-manager.js';

// Simple test function to verify performance tracking
export async function testPerformanceIntegration() {
  console.log('[PerformanceTest] Starting performance integration test...');

  const testHtml = `
    <html>
      <head><title>Test Document</title></head>
      <body>
        <h1>Test Heading</h1>
        <p>This is a test paragraph with <strong>bold text</strong>.</p>
        <ul>
          <li>First item</li>
          <li>Second item</li>
        </ul>
      </body>
    </html>
  `;

  const testUrl = 'https://example.com/test';
  const testTitle = 'Test Document';

  try {
    // Test the enhanced processContent with performance tracking
    const result = await OfflineModeManager.processContent(testHtml, testUrl, testTitle, {
      performance: {
        maxContentLength: 1000000,
        enableCaching: true,
        chunkSize: 100000,
      },
      fallbacks: {
        enableReadabilityFallback: true,
        enableTurndownFallback: true,
        maxRetries: 2,
      },
      postProcessing: {
        enabled: true,
        addTableOfContents: false,
        optimizeForPlatform: 'standard',
      },
      turndownPreset: 'standard',
    });

    console.log('[PerformanceTest] Processing completed successfully');
    console.log('[PerformanceTest] Result:', {
      success: result.success,
      markdownLength: result.markdown.length,
      processingTime: result.processingStats.totalTime,
      qualityScore: result.processingStats.qualityScore,
      warningsCount: result.warnings.length,
      errorsCount: result.errors.length,
    });

    // Test performance metrics retrieval
    const performanceMetrics = OfflineModeManager.getPerformanceMetrics();
    console.log('[PerformanceTest] Performance metrics:', performanceMetrics);

    // Test performance report generation
    const performanceReport = OfflineModeManager.generatePerformanceReport();
    console.log('[PerformanceTest] Performance report:', performanceReport);

    // Test overhead check
    const overheadAcceptable = OfflineModeManager.checkPerformanceOverhead();
    console.log('[PerformanceTest] Overhead acceptable:', overheadAcceptable);

    console.log('[PerformanceTest] Integration test completed successfully');
    return result;

  } catch (error) {
    console.error('[PerformanceTest] Test failed:', error);
    throw error;
  }
}

// Test cache statistics
export async function testCacheStatistics() {
  console.log('[PerformanceTest] Testing cache statistics...');

  const cacheStats = await OfflineModeManager.getEnhancedCacheStats();
  console.log('[PerformanceTest] Cache statistics:', cacheStats);

  return cacheStats;
}

// Run test if called directly
if (typeof window === 'undefined') {
  // Running in Node environment (likely testing)
  console.log('[PerformanceTest] Detected Node environment, running tests...');
  testPerformanceIntegration()
    .then(() => testCacheStatistics())
    .then(() => {
      console.log('[PerformanceTest] All tests completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[PerformanceTest] Test suite failed:', error);
      process.exit(1);
    });
}