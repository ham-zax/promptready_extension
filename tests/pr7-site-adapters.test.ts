import { afterEach, describe, expect, it, vi } from 'vitest';
import { OfflineModeManager } from '../core/offline-mode-manager';
import { ReadabilityConfigManager } from '../core/readability-config';
import { RedditShadowExtractor } from '../core/reddit-shadow-extractor';

describe('PR7 Site Adapter Registry', () => {
  const baseConfig = {
    turndownPreset: 'standard' as const,
    postProcessing: {
      enabled: false,
      addTableOfContents: false,
      optimizeForPlatform: 'standard' as const,
    },
    performance: {
      maxContentLength: 1_000_000,
      enableCaching: false,
      chunkSize: 100000,
    },
    fallbacks: {
      enableReadabilityFallback: true,
      enableTurndownFallback: true,
      maxRetries: 1,
    },
    extractionTuning: {
      mode: 'balanced' as const,
      slider: 50,
      minTextLength: 100,
      highQualityThreshold: 0.8,
      lowQualityPenalty: 20,
    },
  };

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('does not run the Reddit adapter for non-Reddit pages', async () => {
    vi.spyOn(ReadabilityConfigManager, 'extractContent').mockResolvedValue({ content: '' });
    vi.spyOn(RedditShadowExtractor, 'extractContent');

    const result = await OfflineModeManager.processContent(
      `
        <main>
          <article>
            <h1>Normal article</h1>
            <p>${'Visible article body that should be recovered by the generic extractor without invoking Reddit-specific adapter logic. '.repeat(8)}</p>
          </article>
        </main>
      `,
      'https://example.com/article',
      'Normal article',
      baseConfig
    );

    expect(result.success).toBe(true);
    expect(RedditShadowExtractor.extractContent).not.toHaveBeenCalled();
    expect(result.processingStats.strategiesAttempted).not.toContain('adapter:reddit');
    expect(result.processingStats.fallbacksUsed).not.toContain('site-adapter:reddit:null');
  });

  it('records a null Reddit adapter result without failing generic extraction', async () => {
    vi.spyOn(ReadabilityConfigManager, 'extractContent').mockResolvedValue({ content: '' });
    vi.spyOn(RedditShadowExtractor, 'extractContent').mockReturnValue(null);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    const result = await OfflineModeManager.processContent(
      `
        <main>
          <article>
            <h1>Post Title</h1>
            <p>${'Visible body recovered by generic extractor after the Reddit adapter returns null. '.repeat(10)}</p>
          </article>
        </main>
      `,
      'https://www.reddit.com/r/test/comments/abc/post_slug/',
      'Post Title',
      baseConfig
    );

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('Visible body recovered');
    expect(result.processingStats.strategiesAttempted).toContain('adapter:reddit');
    expect(result.processingStats.fallbacksUsed).toContain('site-adapter:reddit:null');
    expect(result.processingStats.strategyWinner).toMatch(/generic|fallback-content-selection/);
  });

  it('demotes incomplete Reddit adapter output and keeps the generic body', async () => {
    vi.spyOn(ReadabilityConfigManager, 'extractContent').mockResolvedValue({ content: '' });
    vi.spyOn(RedditShadowExtractor, 'extractContent').mockReturnValue({
      content: '<h1>Only Title</h1>',
      metadata: {
        strategy: 'shadow-dom',
        qualityScore: 30,
        noiseFiltered: false,
        shadowDomDepth: 0,
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    const result = await OfflineModeManager.processContent(
      `
        <main>
          <article>
            <h1>Real Generic Body</h1>
            <p>${'The real generic body is much more complete than the title-only adapter candidate and should survive ranking. '.repeat(10)}</p>
          </article>
        </main>
      `,
      'https://www.reddit.com/r/test/comments/def/post_slug/',
      'Real Generic Body',
      baseConfig
    );

    expect(result.markdown).toContain('real generic body');
    expect(result.markdown).not.toMatch(/^# Only Title\s*$/);
    expect(result.processingStats.fallbacksUsed).toContain('site-adapter:reddit:incomplete');
    expect(result.processingStats.strategyWinner).toMatch(/generic|fallback-content-selection/);
  });

  it('lets strong Reddit adapter output win as a ranked candidate', async () => {
    const adapterBody = [
      '<article>',
      '<h1>Adapter Body</h1>',
      `<p>${'Full adapter body with complete Reddit post context and enough detail to be selected over sparse page content. '.repeat(8)}</p>`,
      '</article>',
    ].join('');

    vi.spyOn(ReadabilityConfigManager, 'extractContent').mockResolvedValue({ content: '' });
    vi.spyOn(RedditShadowExtractor, 'extractContent').mockReturnValue({
      content: adapterBody,
      metadata: {
        strategy: 'shadow-dom',
        qualityScore: 92,
        noiseFiltered: true,
        shadowDomDepth: 1,
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    const result = await OfflineModeManager.processContent(
      '<main><h1>Shell Title</h1><p>Short shell.</p></main>',
      'https://www.reddit.com/r/test/comments/ghi/post_slug/',
      'Shell Title',
      baseConfig
    );

    expect(result.markdown).toContain('Full adapter body');
    expect(result.processingStats.strategyWinner).toContain('adapter:reddit');
    expect(result.processingStats.extractionDiagnostics?.candidateTraces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: expect.stringContaining('adapter:reddit'),
          selected: true,
        }),
      ])
    );
  });

  it('lets a stronger generic candidate outscore a partial Reddit adapter candidate', async () => {
    vi.spyOn(ReadabilityConfigManager, 'extractContent').mockResolvedValue({ content: '' });
    vi.spyOn(RedditShadowExtractor, 'extractContent').mockReturnValue({
      content: `<p>${'Partial adapter paragraph that is valid but much less complete than the generic article body. '.repeat(3)}</p>`,
      metadata: {
        strategy: 'semantic',
        qualityScore: 55,
        noiseFiltered: false,
        shadowDomDepth: 0,
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    const result = await OfflineModeManager.processContent(
      `
        <main>
          <article>
            <h1>Generic Winner</h1>
            <p>${'The stronger generic candidate contains the full post body, details, and context that the adapter only partially returned. '.repeat(14)}</p>
          </article>
        </main>
      `,
      'https://www.reddit.com/r/test/comments/jkl/post_slug/',
      'Generic Winner',
      baseConfig
    );

    const traces = result.processingStats.extractionDiagnostics?.candidateTraces || [];
    const adapterTrace = traces.find((trace) => trace.source.startsWith('adapter:reddit'));

    expect(result.markdown).toContain('stronger generic candidate');
    expect(result.processingStats.strategyWinner).toMatch(/generic|fallback-content-selection/);
    expect(adapterTrace).toEqual(expect.objectContaining({
      selected: false,
      rejectionReason: 'outscored',
    }));
  });

  it('swallows Reddit adapter errors and records a stable fallback code', async () => {
    vi.spyOn(ReadabilityConfigManager, 'extractContent').mockResolvedValue({ content: '' });
    vi.spyOn(RedditShadowExtractor, 'extractContent').mockImplementation(() => {
      throw new Error('adapter failed with sensitive runtime detail');
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    const result = await OfflineModeManager.processContent(
      `
        <main>
          <article>
            <h1>Generic After Error</h1>
            <p>${'Generic body still succeeds when the Reddit adapter throws, because adapter failure is not allowed to fail extraction. '.repeat(10)}</p>
          </article>
        </main>
      `,
      'https://www.reddit.com/r/test/comments/mno/post_slug/',
      'Generic After Error',
      baseConfig
    );

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('Generic body still succeeds');
    expect(result.processingStats.fallbacksUsed).toContain('site-adapter:reddit:error');
    expect(result.processingStats.fallbacksUsed.join('\n')).not.toContain('sensitive runtime detail');
  });
});
