import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ContentCapture } from '../content/capture';
import { OfflineModeManager } from '../core/offline-mode-manager';
import { ReadabilityConfigManager } from '../core/readability-config';

describe('PR5 Modern DOM Support - Full Page Content Capture', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('flattens open shadow roots into a unified tree during full-page capture', async () => {
    document.body.innerHTML = '<div id="host"></div>';
    const host = document.getElementById('host')!;
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<p>Shadow Content</p><slot></slot>';
    host.innerHTML = '<span>Light Content</span>';

    const result = await ContentCapture.captureFullPage();
    
    expect(result.html).toContain('Shadow Content');
    expect(result.html).toContain('Light Content');
    expect(result.html).toContain('data-pr-shadow-pierced="true"');
    
    expect(result.html).toContain('id="host"');
    expect(result.html).toContain('data-pr-shadow-pierced="true"');
  });

  it('handles nested shadow roots during full-page capture', async () => {
    document.body.innerHTML = '<div id="outer-host"></div>';
    const outerHost = document.getElementById('outer-host')!;
    const outerShadow = outerHost.attachShadow({ mode: 'open' });
    outerShadow.innerHTML = '<div id="inner-host"></div><slot></slot>';
    
    const innerHost = outerShadow.querySelector('#inner-host')!;
    const innerShadow = innerHost.attachShadow({ mode: 'open' });
    innerShadow.innerHTML = '<p>Inner Shadow</p>';
    
    outerHost.innerHTML = '<span>Light Content</span>';

    const result = await ContentCapture.captureFullPage();
    
    expect(result.html).toContain('Inner Shadow');
    expect(result.html).toContain('Light Content');
    // Verify nesting
    expect(result.html.indexOf('Inner Shadow')).toBeGreaterThan(result.html.indexOf('outer-host'));
  });

  it('handles named slots during full-page capture', async () => {
     document.body.innerHTML = '<div id="host"><span slot="title">The Title</span><p>The Body</p></div>';
     const host = document.getElementById('host')!;
     const shadow = host.attachShadow({ mode: 'open' });
     shadow.innerHTML = '<h1><slot name="title"></slot></h1><div><slot></slot></div>';
     
     const result = await ContentCapture.captureFullPage();
     
     expect(result.html).toContain('<h1><span slot="title">The Title</span></h1>');
     expect(result.html).toContain('<div><p>The Body</p></div>');
  });

  it('handles slot fallback content during full-page capture', async () => {
    document.body.innerHTML = '<div id="host"></div>';
    const host = document.getElementById('host')!;
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<slot><p>Fallback Content</p></slot>';

    const result = await ContentCapture.captureFullPage();
    
    expect(result.html).toContain('Fallback Content');
  });

  it('preserves shadow-pierced markers through the extraction pipeline during full-page capture', async () => {
    // Setup a DOM with shadow root
    document.body.innerHTML = '<div id="host"><article><h1>Shadow Content</h1><p>This is substantive content that will be picked up by generic:article.</p></article></div>';
    const host = document.getElementById('host')!;
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<slot></slot>';

    const capture = await ContentCapture.captureFullPage();
    
    vi.spyOn(ReadabilityConfigManager, 'extractContent').mockResolvedValue({
      content: '',
    });

    const result = await (OfflineModeManager as any).processContent(
      capture.html,
      capture.url,
      capture.title,
      {
        turndownPreset: 'standard' as const,
        postProcessing: { enabled: false, addTableOfContents: false },
        performance: { maxContentLength: 1000000, enableCaching: false, chunkSize: 100000 },
        fallbacks: { enableReadabilityFallback: true, enableTurndownFallback: true, maxRetries: 1 },
        extractionTuning: { mode: 'balanced', slider: 50, minTextLength: 50, highQualityThreshold: 0.8, lowQualityPenalty: 20 }
      }
    );

    expect(result.success).toBe(true);
    // GenericExtractor should find the article and mark it as shadow-pierced because its parent (host) has the marker
    expect(result.processingStats.strategyWinner).toContain('shadow-pierced');
    expect(result.markdown).toContain('Shadow Content');
  });

  it('handles reprojected slots using flattened assigned nodes', async () => {
    document.body.innerHTML = '<div id="outer-host"><span id="target">Reprojected Content</span></div>';
    const outerHost = document.getElementById('outer-host')!;
    const outerShadow = outerHost.attachShadow({ mode: 'open' });
    outerShadow.innerHTML = '<div id="inner-host"><slot></slot></div>';
    
    const innerHost = outerShadow.querySelector('#inner-host')!;
    const innerShadow = innerHost.attachShadow({ mode: 'open' });
    innerShadow.innerHTML = '<div><slot></slot></div>';

    const result = await ContentCapture.captureFullPage();
    
    expect(result.html).toContain('Reprojected Content');
    expect(result.html).toContain('id="inner-host"');
  });

  it('prevents recursive slot assignment loops during full-page flattening', async () => {
    document.body.innerHTML = '<div id="host"></div>';
    const host = document.getElementById('host')!;
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<slot></slot>';

    const slot = shadow.querySelector('slot') as HTMLSlotElement;
    // Pathological case: slot claims its own host as assigned node
    vi.spyOn(slot, 'assignedNodes').mockReturnValue([host] as unknown as Node[]);

    const result = await ContentCapture.captureFullPage();

    expect(result.html).toBeDefined();
  });
});
