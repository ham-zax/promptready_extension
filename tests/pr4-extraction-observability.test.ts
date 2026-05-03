import { describe, it, expect, vi, afterEach } from 'vitest';
import { OfflineModeManager } from '../core/offline-mode-manager';
import { ReadabilityConfigManager } from '../core/readability-config';

describe('PR4 Extraction Observability - Candidate Traces', () => {
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
    }
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('records top candidate traces when falling back to generic selection', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Test Page</title></head>
        <body>
          <main>
            <article>
              <h1>Substantial Article</h1>
              <p>${'This is a valid test article that provides enough body content. '.repeat(10)}</p>
            </article>
            <aside>
              <p>Just some noise here.</p>
            </aside>
          </main>
        </body>
      </html>
    `;

    // Force Readability to fail so we fall through to fallback content selection
    vi.spyOn(ReadabilityConfigManager, 'extractContent').mockResolvedValue({
      content: '',
    });

    const result = await OfflineModeManager.processContent(
      html,
      'https://example.com/test-page',
      'Test Page',
      baseConfig
    );

    expect(result.success).toBe(true);
    expect(result.processingStats.strategyWinner).toContain('generic:article');

    // Verify diagnostics presence
    const diagnostics = result.processingStats.extractionDiagnostics;
    expect(diagnostics).toBeDefined();
    expect(diagnostics?.candidateTraces).toBeDefined();
    expect(diagnostics?.candidateTraces.length).toBeGreaterThan(0);
    expect(diagnostics?.candidateTraces.length).toBeLessThanOrEqual(5);

    // Verify trace shape
    const winnerTrace = diagnostics?.candidateTraces.find(t => t.selected);
    expect(winnerTrace).toBeDefined();
    expect(winnerTrace?.source).toContain('generic:article');
    expect(winnerTrace?.score).toBeGreaterThan(0);
    expect(winnerTrace?.charCount).toBeGreaterThan(100);

    const loserTrace = diagnostics?.candidateTraces.find(t => !t.selected);
    if (loserTrace) {
      expect(loserTrace.rejectionReason).toBeDefined();
      expect(['outscored', 'below_length_threshold', 'zero_score']).toContain(loserTrace.rejectionReason);
    }
  });

  it('guarantees candidateTraces always includes the final selected trace even if outside top 5', async () => {
    // A fixture designed to generate many candidates.
    // E.g. a page with 10 <article> elements, which might push Readability out of top 5.
    const articles = Array.from({ length: 10 })
      .map((_, i) => `<article><p>Noise article ${i} content that is long enough to be a candidate. This needs to be long enough. ${'words '.repeat(20)}</p></article>`)
      .join('\n');

    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Many Candidates</title></head>
        <body>
          <main>
            ${articles}
          </main>
        </body>
      </html>
    `;

    // Readability returns something short, so it gets a low score and drops out of top 5.
    vi.spyOn(ReadabilityConfigManager, 'extractContent').mockResolvedValue({
      content: '<h1>Readability Wins</h1><p>Short.</p>',
    });

    // Force resolveReadabilityCandidate to KEEP readability despite its low score
    vi.spyOn(OfflineModeManager as any, 'shouldFallbackForCoverage').mockReturnValue(false);
    vi.spyOn(OfflineModeManager as any, 'shouldAdoptFallbackCandidate').mockReturnValue(false);

    const result = await OfflineModeManager.processContent(
      html,
      'https://example.com/many-candidates',
      'Many Candidates',
      baseConfig
    );

    const traces = result.processingStats.extractionDiagnostics?.candidateTraces;
    expect(traces).toBeDefined();

    const selectedTraces = traces?.filter(t => t.selected);
    expect(selectedTraces?.length).toBe(1);
    expect(selectedTraces?.[0].source).toBe('readability-primary');
  });

  it('does not alter the final markdown output compared to PR3', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Stable Output</title></head>
        <body>
          <article>
            <p>${'Stable content block. '.repeat(10)}</p>
          </article>
        </body>
      </html>
    `;

    vi.spyOn(ReadabilityConfigManager, 'extractContent').mockResolvedValue({
      content: '',
    });

    const result = await OfflineModeManager.processContent(
      html,
      'https://example.com/stable',
      'Stable Output',
      baseConfig
    );

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('Stable content block.');

    // We confirm that even though traces were gathered, they do not leak into the markdown
    expect(result.markdown).not.toContain('candidateTraces');
    expect(result.markdown).not.toContain('rejectionReason');
  });

  it('records Readability candidate trace when it wins after quality comparison', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Readability Wins</title></head>
        <body>
          <main>
            <article>
              <p>${'Readability will win this round because we mock it to return perfect content. '.repeat(10)}</p>
            </article>
          </main>
        </body>
      </html>
    `;

    const mockContent = '<h1>Readability Wins</h1><p>' + 'Readability will win this round because we mock it to return perfect content. '.repeat(10) + '</p>';

    // Readability returns high-quality content
    vi.spyOn(ReadabilityConfigManager, 'extractContent').mockResolvedValue({
      content: mockContent,
    });

    const result = await OfflineModeManager.processContent(
      html,
      'https://example.com/readability',
      'Readability Wins',
      baseConfig
    );

    expect(result.success).toBe(true);
    expect(result.processingStats.strategyWinner).toBe('readability');

    const traces = result.processingStats.extractionDiagnostics?.candidateTraces;
    expect(traces).toBeDefined();

    const readabilityTrace = traces?.find(t => t.source === 'readability-primary');
    expect(readabilityTrace).toBeDefined();
    expect(readabilityTrace?.selected).toBe(true);
  });
});