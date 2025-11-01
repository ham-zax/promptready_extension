import { describe, it, expect } from 'vitest';
import { OfflineModeManager } from '../../core/offline-mode-manager';

// Minimal representative HTML excerpt (contains the key headings and the Dimensions table row we assert)
const html = `<div>
  <h2>Overview</h2>
  <h2>Technical Specification</h2>
  <h2>CAD</h2>
  <h2>Compatible products</h2>
  <h2>More Information</h2>

  <h1>Overview</h1>
  <div>Display in:MetricImperial</div>

  <h2>Dimensions</h2>
  <table class="table" aria-describedby="Dimensions">
    <tr><td class="feature-name"><span class="name">Diameter of bearing seat</span></td><td class="feature-value value-no-wrap"><span class="value">180</span><span class="unit"> mm</span></td></tr>
    <tr><td class="feature-name"><span class="name">Centre height (pillow block)</span></td><td class="feature-value value-no-wrap"><span class="value">114.3</span><span class="unit"> mm</span></td></tr>
  </table>
</div>`;

describe('SKF product HTML -> Markdown (partial checks)', () => {
  it('produces markdown containing key sections and values', async () => {
    const url = 'https://www.skf.com/my/products/mounted-bearings/bearing-housings/split-pillow-blocks-saf-saw-series';
    const title = 'FSAF 520';

    const res = await OfflineModeManager.processContent(html, url, title, {
      turndownPreset: 'standard',
      postProcessing: { enabled: true, addTableOfContents: false, optimizeForPlatform: 'standard' },
      performance: { maxContentLength: 2000000, enableCaching: false, chunkSize: 100000 },
      fallbacks: { enableReadabilityFallback: true, enableTurndownFallback: true, maxRetries: 1 },
      readabilityPreset: 'blog-article',
    });

    expect(res.success).toBe(true);
    const md = res.markdown;

    // Key section headers
    expect(md).toContain('Overview');
    expect(md).toContain('Technical Specification');
    expect(md).toContain('CAD');
    expect(md).toContain('Compatible products');

    // Table rows / values we expect to preserve
    expect(md).toContain('Diameter of bearing seat');
    expect(md).toContain('| Diameter of bearing seat | 180 mm |');
  }, 30000);
});