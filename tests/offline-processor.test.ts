import { describe, it, expect } from 'vitest';
import { OfflineModeManager } from '../core/offline-mode-manager';

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
  it('processes content and inserts cite-first block + H1', async () => {
    const res = await OfflineModeManager.processContent(html, url, 'My Title', {
      turndownPreset: 'standard',
      postProcessing: { enabled: true, addTableOfContents: false, optimizeForPlatform: 'standard' },
      performance: { maxContentLength: 1000000, enableCaching: false, chunkSize: 100000 },
      fallbacks: { enableReadabilityFallback: true, enableTurndownFallback: true, maxRetries: 1 },
      readabilityPreset: 'blog-article',
    });
    expect(res.success).toBe(true);
    expect(res.markdown).toMatch(/^# /); // H1 at top
    expect(res.markdown).toMatch(/^> Source:/m); // cite-first block
    expect(res.metadata.url).toBe(url);
  });
});

