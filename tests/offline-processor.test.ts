import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OfflineModeManager } from '../core/offline-mode-manager';
import { DateUtils } from '../lib/date-utils';

const html = `
<!doctype html>
<html><head><title>T</title></head><body>
  <h1>Heading</h1>
  <p>Para</p>
  <pre><code>code</code></pre>
  <a href="/rel">rel</a>
  <img src="/img.png" alt="A" />
</body></html>`;

const url = 'https://example.com/page';

describe('OfflineModeManager', () => {
  beforeEach(() => {
    OfflineModeManager.clearCache();
  });

  afterEach(() => {
    OfflineModeManager.clearCache();
  });

  it('processes content and inserts cite-first block + H1', async () => {
    const res = await OfflineModeManager.processContent(html, url, 'My Title', {
      turndownPreset: 'standard',
      postProcessing: { enabled: true, addTableOfContents: false, optimizeForPlatform: 'standard' },
      performance: { maxContentLength: 1000000, enableCaching: false, chunkSize: 100000 },
      fallbacks: { enableReadabilityFallback: true, enableTurndownFallback: true, maxRetries: 1 },
      readabilityPreset: 'blog-article',
    });
    expect(res.success).toBe(true);
    expect(res.markdown).toMatch(/^> Source:/m); // Cite-first block should be at the top
    expect(res.markdown).toContain('# Heading'); // H1 should be present
    expect(res.metadata.url).toBe(url);

    // Test date formatting consistency
    expect(res.metadata.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/); // ISO 8601 format
  });
});

