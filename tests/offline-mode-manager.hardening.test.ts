import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OfflineModeManager } from '../core/offline-mode-manager';
import { ReadabilityConfigManager } from '../core/readability-config';

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
    chunkSize: 120,
  },
  fallbacks: {
    enableReadabilityFallback: true,
    enableTurndownFallback: true,
    maxRetries: 1,
  },
  readabilityPreset: 'non-existent-preset',
};

describe('OfflineModeManager hardening regressions', () => {
  beforeEach(() => {
    const manager = OfflineModeManager as any;
    manager.activeSessions.clear();
  });

  it('uses ScoringEngine fallback before semantic extraction path', async () => {
    const html = `
      <html><body>
        <article id="main-content">
          <h1>Main Heading</h1>
          <p>${'Primary content paragraph with meaningful detail. '.repeat(30)}</p>
          <aside>
            SIDEBAR_NOISE_TOKEN
            <a href="/promo">promo</a>
            <a href="/related">related</a>
          </aside>
        </article>
      </body></html>
    `;

    const result = await OfflineModeManager.processContent(
      html,
      'https://example.com/fallback-order',
      'Fallback Order',
      baseConfig,
    );

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('Primary content paragraph');
    expect(result.markdown).not.toContain('SIDEBAR_NOISE_TOKEN');
  });

  it('retains multi-section document structure during fallback extraction', async () => {
    const html = `
      <html>
        <body>
          <header>NAVIGATION LINKS HOME PRICING DOCS</header>
          <main id="landing-content">
            <section class="hero">
              <h1>PromptReady — One-click clean Markdown from any page</h1>
              <p>PromptReady extracts useful parts and preserves structure.</p>
            </section>
            <section class="comparison">
              <h2>Before / After comparison</h2>
              <div class="promo">Save 40% today! Subscribe to our newsletter.</div>
              <p>${'Breaking down retrieval-augmented generation in production. '.repeat(90)}</p>
              <footer>Subscribe to our newsletter | Related links | Footer text</footer>
            </section>
            <section class="social-proof">
              <h2>Trusted by builders, researchers, and operators</h2>
              <p>Teams use PromptReady when they need reliable context.</p>
            </section>
            <section class="faq">
              <h2>Frequently asked questions</h2>
              <ul>
                <li>Is it local first?</li>
                <li>Do I need an API key?</li>
                <li>Will it preserve code and tables?</li>
              </ul>
            </section>
          </main>
        </body>
      </html>
    `;

    const result = await OfflineModeManager.processContent(
      html,
      'https://example.com/landing',
      'PromptReady Landing',
      baseConfig,
    );

    expect(result.success).toBe(true);
    expect(result.processingStats.fallbacksUsed.some((label) => label.startsWith('readability-'))).toBe(true);
    expect(result.markdown).toContain('PromptReady — One-click clean Markdown from any page');
    expect(result.markdown).toContain('Trusted by builders, researchers, and operators');
    expect(result.markdown).toContain('Frequently asked questions');
    expect(result.markdown).not.toContain('Save 40% today! Subscribe to our newsletter.');
    expect(result.markdown).not.toContain('Subscribe to our newsletter | Related links | Footer text');
  });

  it('recovers hero section when readability captures only a dominant subsection', async () => {
    const html = `
      <html>
        <body>
          <main id="landing-content">
            <section id="hero">
              <h1>PromptReady — One-click clean Markdown from any page</h1>
              <p>Cleaner input. Better model output.</p>
            </section>
            <section id="before-after">
              <h2>Before / After comparison</h2>
              <div class="promo">Save 40% today! Subscribe to our newsletter.</div>
              <p>${'Breaking down retrieval-augmented generation in production. '.repeat(120)}</p>
              <footer>Subscribe to our newsletter | Related links | Footer text</footer>
            </section>
          </main>
        </body>
      </html>
    `;

    const defaultLikeConfig = {
      ...baseConfig,
      readabilityPreset: undefined,
    };

    const result = await OfflineModeManager.processContent(
      html,
      'https://promptready.app/',
      'PromptReady Landing',
      defaultLikeConfig,
    );

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('PromptReady — One-click clean Markdown from any page');
    expect(result.markdown).toContain('Before / After comparison');
    expect(result.markdown).not.toContain('Save 40% today! Subscribe to our newsletter.');
    expect(result.markdown).not.toContain('Subscribe to our newsletter | Related links | Footer text');
  });

  it('removes inline consent/popup noise while preserving landing content structure', async () => {
    const html = `
      <html>
        <body>
          <main id="landing-content">
            <section id="hero">
              <h1>PromptReady — One-click clean Markdown from any page</h1>
              <p>Cleaner input. Better model output.</p>
              <p>PromptReady extracts the useful parts, preserves structure, and gives you citation-ready text in one click.</p>
            </section>
            <div>
              ANNOYING POPUP AD Accept all 500 tracking cookies to continue.
              <button>Accept all</button>
            </div>
            <section id="benefits">
              <h2>Core benefits</h2>
              <ul>
                <li>Preserves code fences</li>
                <li>Adds clean citations</li>
                <li>Privacy-first local parsing</li>
              </ul>
            </section>
            <section id="before-after">
              <h2>Before / After comparison</h2>
              <p>${'Breaking down retrieval-augmented generation in production. '.repeat(80)}</p>
            </section>
          </main>
        </body>
      </html>
    `;

    const defaultLikeConfig = {
      ...baseConfig,
      readabilityPreset: undefined,
    };

    const result = await OfflineModeManager.processContent(
      html,
      'https://promptready.app/',
      'PromptReady — One-click clean Markdown from any page',
      defaultLikeConfig,
    );

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('# PromptReady — One-click clean Markdown from any page');
    expect(result.markdown).toContain('Core benefits');
    expect(result.markdown).toContain('Before / After comparison');
    expect(result.markdown).not.toContain('ANNOYING POPUP AD');
    expect(result.markdown).not.toContain('Accept all 500 tracking cookies to continue');
  });

  it('adopts ranked fallback candidate even when readability coverage is not low', async () => {
    const manager = OfflineModeManager as any;
    const originalFallbackSelection = manager.fallbackContentExtractionSelection;
    const originalCoverageCheck = manager.shouldFallbackForCoverage;
    const originalAdoptionCheck = manager.shouldAdoptFallbackCandidate;

    manager.fallbackContentExtractionSelection = vi.fn().mockResolvedValue({
      source: 'mock-ranked-candidate',
      html: '<article><h1>Ranked Fallback Winner</h1><p>Better candidate content.</p></article>',
    });
    manager.shouldFallbackForCoverage = vi.fn().mockReturnValue(false);
    manager.shouldAdoptFallbackCandidate = vi.fn().mockReturnValue(true);

    try {
      const fallbacksUsed: string[] = [];
      const warnings: string[] = [];
      const resolved = await manager.resolveReadabilityCandidate(
        '<html><body><main><h1>Source Title</h1></main></body></html>',
        '<article><h1>Readability Candidate</h1><p>Primary body.</p></article>',
        fallbacksUsed,
        warnings,
        baseConfig
      );

      expect(resolved).toContain('Ranked Fallback Winner');
      expect(fallbacksUsed).toContain('readability-ranked-fallback');
      expect(warnings.some((w) => /higher-quality fallback candidate/i.test(w))).toBe(true);
    } finally {
      manager.fallbackContentExtractionSelection = originalFallbackSelection;
      manager.shouldFallbackForCoverage = originalCoverageCheck;
      manager.shouldAdoptFallbackCandidate = originalAdoptionCheck;
    }
  });

  it('canonicalizes delivery markdown by replacing stale cite block and stripping residual UI noise', () => {
    const warnings: string[] = [];
    const markdown = `
> Source: https://legacy.example.com/article
> Captured: 2024-01-01
> Hash: legacy-hash

ANNOYING POPUP AD Accept all 500 tracking cookies to continue.

Cleaner input. Better model output.
`;

    const canonical = OfflineModeManager.canonicalizeDeliveredMarkdown(markdown, {
      title: 'PromptReady — One-click clean Markdown from any page',
      url: 'https://promptready.app/',
      capturedAt: '2026-02-25T19:00:36.136Z',
      selectionHash: 'promptready-hash',
    }, warnings);

    expect((canonical.match(/^> Source:/gm) || []).length).toBe(1);
    expect(canonical).toContain('> Source: [PromptReady — One-click clean Markdown from any page](https://promptready.app/)');
    expect(canonical).toContain('> Captured: 2026-02-25T19:00:36.136Z');
    expect(canonical).toContain('# PromptReady — One-click clean Markdown from any page');
    expect(canonical).not.toContain('legacy.example.com/article');
    expect(canonical).not.toContain('ANNOYING POPUP AD');
    expect(canonical).not.toContain('Accept all 500 tracking cookies to continue');
  });

  it('removes merged popup-noise and inline code-fence artifacts from copied markdown', () => {
    const warnings: string[] = [];
    const pasted = `> Source: [PromptReady — One-click clean Markdown from any page](https://promptready.app/)
> Captured: 2026-02-25T18:54:42.222Z
> Hash: https://promptready.app/-b346117786c56015-3683995a368dd981

Cleaner input. Better model output.

PromptReady extracts the useful parts, preserves structure, and gives you citation-ready text in one click.

**No cleanup loops.**

ANNOYING POPUP ADAccept all 500 tracking cookies to continue.#\`\`\`json\`\`\`

Preserves code fences
Adds clean citations
Privacy-first local parsing

### PromptReady Output
\\# Retrieval-Augmented Generation in Production

Source: example.com/rag-guide•Captured: 2026-02-24T18:40Z`;

    const canonical = OfflineModeManager.canonicalizeDeliveredMarkdown(
      pasted,
      {
        title: 'PromptReady — One-click clean Markdown from any page',
        url: 'https://promptready.app/',
        capturedAt: '2026-02-25T18:54:42.222Z',
        selectionHash: 'https://promptready.app/-b346117786c56015-3683995a368dd981',
      },
      warnings
    );

    expect(canonical).not.toContain('ANNOYING POPUP AD');
    expect(canonical).not.toContain('tracking cookies to continue');
    expect(canonical).not.toContain('```json```');
    expect(canonical).toContain('Cleaner input. Better model output.');
  });

  it('removes UI-noise demo code fences while preserving real programming code fences', () => {
    const warnings: string[] = [];
    const markdown = `Raw input
\`\`\`Donate | Create account | Log in
Contents [hide]
From Wikipedia, the free encyclopedia
Privacy policy | About Wikipedia
Accept all 500 tracking cookies to continue.
\`\`\`

### SDK example
\`\`\`ts
import { OpenRouter } from '@openrouter/sdk';
const completion = await openRouter.chat.send({ model: 'openai/gpt-5.2' });
\`\`\``;

    const canonical = OfflineModeManager.canonicalizeDeliveredMarkdown(
      markdown,
      {
        title: 'PromptReady — One-click clean Markdown from any page',
        url: 'https://promptready.app/',
        capturedAt: '2026-02-25T22:27:57.577Z',
        selectionHash: 'promptready-hash',
      },
      warnings
    );

    expect(canonical).not.toContain('Donate | Create account | Log in');
    expect(canonical).not.toContain('Privacy policy | About Wikipedia');
    expect(canonical).not.toContain('Raw input');
    expect(canonical).toContain("import { OpenRouter } from '@openrouter/sdk';");
  });

  it('preserves newsletter/demo text inside fenced code while removing inline UI noise lines', () => {
    const warnings: string[] = [];
    const markdown = `Save 40% today! Subscribe to our newsletter.
Subscribe to our newsletter | Related links | Footer text

\`\`\`html
<div class="promo">
  Save 40% today! Subscribe to our newsletter.
</div>
<footer>
  Subscribe to our newsletter | Related links | Footer text
</footer>
\`\`\``;

    const canonical = OfflineModeManager.canonicalizeDeliveredMarkdown(
      markdown,
      {
        title: 'PromptReady — One-click clean Markdown from any page',
        url: 'https://promptready.app/',
        capturedAt: '2026-02-25T22:27:57.577Z',
        selectionHash: 'promptready-hash',
      },
      warnings
    );

    expect(canonical).toContain('```html');
    expect(canonical).toContain('<div class="promo">');
    expect(canonical).toContain('Subscribe to our newsletter | Related links | Footer text');

    const promoMatches = canonical.match(/Save 40% today! Subscribe to our newsletter\./g) ?? [];
    const footerMatches = canonical.match(/Subscribe to our newsletter \| Related links \| Footer text/g) ?? [];
    expect(promoMatches).toHaveLength(1);
    expect(footerMatches).toHaveLength(1);
  });

  it('removes low-signal media and empty-link artifacts while preserving meaningful text', () => {
    const warnings: string[] = [];
    const noisy = `# Trending

![toF23BrUnkTcleEFRGkss7jhJSw](https://framerusercontent.com/images/toF23BrUnkTcleEFRGkss7jhJSw.svg)
Python [14,542](/D4Vinci/Scrapling/stargazers) Built by [
](/D4Vinci)
[](/AbdullahY36)

Reliable extraction summary remains here.
`;

    const canonical = OfflineModeManager.canonicalizeDeliveredMarkdown(
      noisy,
      {
        title: 'Trending repositories on GitHub today',
        url: 'https://github.com/trending',
        capturedAt: '2026-02-25T19:37:55.451Z',
        selectionHash: 'github-trending-hash',
      },
      warnings
    );

    expect(canonical).toContain('Python [14,542](/D4Vinci/Scrapling/stargazers)');
    expect(canonical).toContain('Reliable extraction summary remains here.');
    expect(canonical).not.toContain('framerusercontent.com/images/');
    expect(canonical).not.toContain('Built by [');
    expect(canonical).not.toContain('[](/AbdullahY36)');
  });

  it('strips leading breadcrumb chrome and social embeds before the primary heading', () => {
    const warnings: string[] = [];
    const noisyPrelude = `- [News](https://timesofindia.indiatimes.com/)
- [India News](https://timesofindia.indiatimes.com/india)
- PM Modi Israel Visit Live: Netanyahu to host PM Modi for dinner; key MoUs to be inked on Feb 26
THE TIMES OF INDIA | Feb 26, 2026, 00:17:30 IST

# PM Modi Israel Visit Live: Netanyahu to host PM Modi for dinner; key MoUs to be inked on Feb 26

Prime Minister Narendra Modi and Israeli Prime Minister Benjamin Netanyahu attend a technology and innovations exhibition.

> &mdash; ANI (@ANI)[](https://twitter.com/ANI/status/2026730506428232065)

Core article body paragraph remains here.`;

    const canonical = OfflineModeManager.canonicalizeDeliveredMarkdown(
      noisyPrelude,
      {
        title: 'PM Modi Israel Visit Live',
        url: 'https://timesofindia.indiatimes.com/liveblog',
        capturedAt: '2026-02-25T23:17:06.773Z',
        selectionHash: 'toi-live-hash',
      },
      warnings
    );

    expect(canonical).not.toContain('- [News](');
    expect(canonical).not.toContain('- [India News](');
    expect(canonical).not.toContain('THE TIMES OF INDIA |');
    expect(canonical).not.toContain('&mdash; ANI');
    expect(canonical).toContain('# PM Modi Israel Visit Live');
    expect(canonical).toContain('Core article body paragraph remains here.');
  });

  it('normalizes excessive markdown spacing during canonicalization', () => {
    const warnings: string[] = [];
    const noisySpacing = `# Heading



Paragraph one.

    

Paragraph two.


`;

    const canonical = OfflineModeManager.canonicalizeDeliveredMarkdown(
      noisySpacing,
      {
        title: 'Spacing Coverage',
        url: 'https://example.com/spacing',
        capturedAt: '2026-02-25T19:37:55.451Z',
        selectionHash: 'spacing-hash',
      },
      warnings
    );

    expect(canonical).not.toMatch(/\n{4,}/);
    expect(canonical).toContain('Paragraph one.');
    expect(canonical).toContain('Paragraph two.');
  });

  it('extracts publish/update/byline metadata and surfaces them in cite header', async () => {
    const html = `
      <html>
        <head>
          <meta property="article:published_time" content="2026-02-25T14:43:00+05:30" />
          <meta property="article:modified_time" content="2026-02-25T15:10:00+05:30" />
          <meta name="author" content="News Desk" />
        </head>
        <body>
          <article>
            <h1>Metadata Coverage Story</h1>
            <p>${'Important section content for metadata regression coverage. '.repeat(30)}</p>
          </article>
        </body>
      </html>
    `;

    const result = await OfflineModeManager.processContent(
      html,
      'https://example.com/metadata-story',
      'Metadata Coverage Story',
      baseConfig,
    );

    expect(result.success).toBe(true);
    expect(result.metadata.publishedAt).toBe(new Date('2026-02-25T14:43:00+05:30').toISOString());
    expect(result.metadata.updatedAt).toBe(new Date('2026-02-25T15:10:00+05:30').toISOString());
    expect(result.metadata.byline).toBe('News Desk');
    expect(result.markdown).toContain('> Published: 2026-02-25T14:43:00+05:30');
    expect(result.markdown).toContain('> Updated: 2026-02-25T15:10:00+05:30');
    expect(result.markdown).toContain('> By: News Desk');
  });

  it('preserves non-ISO timestamp strings from source when normalization is not possible', async () => {
    const html = `
      <html>
        <body>
          <article>
            <h1>Live Update Stream</h1>
            <div class="dateline"><time>14:43 (IST) Feb 25</time></div>
            <p>${'Live updates with significant details to keep extraction stable. '.repeat(25)}</p>
          </article>
        </body>
      </html>
    `;

    const result = await OfflineModeManager.processContent(
      html,
      'https://example.com/live-stream',
      'Live Update Stream',
      baseConfig,
    );

    expect(result.success).toBe(true);
    expect(result.metadata.publishedAtText).toBe('14:43 (IST) Feb 25');
    expect(result.markdown).toContain('> Published: 14:43 (IST) Feb 25');
  });

  it('extracts timestamp fragments from long noisy dateline text', async () => {
    const html = `
      <html>
        <body>
          <article>
            <h1>Live Feed Coverage</h1>
            <div class="dateline">14:43 (IST) Feb 25 PM Modi Israel Visit Live: Meeting with Israeli President Herzog Scheduled</div>
            <p>${'Live feed details continue through the article body to keep extraction realistic and stable. '.repeat(20)}</p>
          </article>
        </body>
      </html>
    `;

    const result = await OfflineModeManager.processContent(
      html,
      'https://example.com/live-feed',
      'Live Feed Coverage',
      baseConfig,
    );

    expect(result.success).toBe(true);
    expect(result.metadata.publishedAtText).toBe('14:43 (IST) Feb 25');
    expect(result.markdown).toContain('> Published: 14:43 (IST) Feb 25');
  });

  it('prefers live-update timestamp text over stale legacy metadata candidates', async () => {
    const html = `
      <html>
        <head>
          <meta property="article:published_time" content="2006-02-28T18:19:29+00:00" />
        </head>
        <body>
          <article>
            <h1>Live Coverage</h1>
            <span class="live-time">14:43 (IST) Feb 25</span>
            <p>${'Continuous update content that should keep extraction stable for ranking. '.repeat(24)}</p>
          </article>
        </body>
      </html>
    `;

    const result = await OfflineModeManager.processContent(
      html,
      'https://example.com/live-coverage',
      'Live Coverage',
      baseConfig,
    );

    expect(result.success).toBe(true);
    expect(result.metadata.publishedAtText).toBe('14:43 (IST) Feb 25');
    expect(result.markdown).toContain('> Published: 14:43 (IST) Feb 25');
    expect(result.markdown).not.toContain('> Published: 2006-02-28T18:19:29+00:00');
  });

  it('falls back cleanly when Turndown module cannot be loaded at runtime', async () => {
    const manager = OfflineModeManager as any;
    const originalTurndownLoader = manager.getTurndownConfigManager;
    manager.getTurndownConfigManager = vi
      .fn()
      .mockRejectedValue(new ReferenceError('window is not defined'));

    const html = `
      <html>
        <body>
          <article>
            <h1>Turndown Fallback Coverage</h1>
            <p>${'This paragraph should survive module load failures. '.repeat(18)}</p>
          </article>
        </body>
      </html>
    `;

    try {
      const result = await OfflineModeManager.processContent(
        html,
        'https://example.com/turndown-missing',
        'Turndown Fallback Coverage',
        baseConfig,
      );

      expect(result.success).toBe(true);
      expect(result.processingStats.fallbacksUsed).toContain('turndown-fallback');
      expect(result.warnings.some((warning) => /fallback markdown conversion/i.test(warning))).toBe(true);
      expect(result.markdown).toContain('Turndown Fallback Coverage');
      expect(result.markdown).toContain('This paragraph should survive module load failures');
    } finally {
      manager.getTurndownConfigManager = originalTurndownLoader;
    }
  });

  it('records non-negative timing and closes failed session state', async () => {
    const result = await OfflineModeManager.processContent(
      '',
      'https://example.com/failure',
      'Failure Case',
      baseConfig,
    );

    expect(result.success).toBe(false);
    expect(result.processingStats.totalTime).toBeGreaterThanOrEqual(0);

    const metrics = OfflineModeManager.getCurrentSessionMetrics();
    expect(metrics.activeSessions).toBe(0);
    expect(metrics.recentSessions.some((s) => s.status === 'failed')).toBe(true);
  });

  it('prunes completed session history to bounded retention', () => {
    const manager = OfflineModeManager as any;
    const now = Date.now();

    for (let i = 0; i < 260; i++) {
      manager.activeSessions.set(`session_${i}`, {
        startTime: now - (i + 2) * 1000,
        htmlLength: 100,
        config: baseConfig,
        status: 'completed',
        lastUpdate: now - (i + 1) * 1000,
        endTime: now - (i + 1) * 1000,
        totalTime: 25,
        qualityScore: 80,
        markdownLength: 200,
      });
    }

    manager.pruneSessionStore();

    expect(manager.activeSessions.size).toBeLessThanOrEqual(manager.MAX_SESSION_HISTORY);
  });

  it('uses boundary-aware chunk fallback when DOMParser is unavailable', () => {
    const manager = OfflineModeManager as any;
    const html = '<div><p>alpha</p><p>beta</p><p>gamma</p><p>delta</p></div>';

    const originalDOMParser = (globalThis as any).DOMParser;
    (globalThis as any).DOMParser = undefined;
    try {
      const chunks: string[] = manager.splitIntoChunks(html, 15);
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.join('')).toBe(html);
      expect(chunks.slice(0, -1).every(chunk => chunk.endsWith('>') || chunk.endsWith('\n'))).toBe(true);
    } finally {
      (globalThis as any).DOMParser = originalDOMParser;
    }
  });

  it('produces stable and differentiated fallback hashes', () => {
    const manager = OfflineModeManager as any;
    const a = manager.fallbackHash('https://example.com/a');
    const b = manager.fallbackHash('https://example.com/b');
    const a2 = manager.fallbackHash('https://example.com/a');

    expect(a).toMatch(/^[0-9a-z]+$/);
    expect(a).toBe(a2);
    expect(a).not.toBe(b);
  });

  it('fails closed to a single chunk when no safe boundary exists near the split edge', () => {
    const manager = OfflineModeManager as any;
    const html = `<div data-payload="${'x'.repeat(5000)}"></div>`;

    const chunks: string[] = manager.splitByBoundaries(html, 120);

    expect(chunks).toEqual([html]);
  });

  it('cleans up in-flight request state when setup fails before pipeline execution', async () => {
    const manager = OfflineModeManager as any;
    const originalGenerateSessionId = manager.generateSessionId;
    manager.generateSessionId = vi.fn(() => {
      throw new Error('session bootstrap failed');
    });

    try {
      const result = await OfflineModeManager.processContent(
        '<html><body><article><h1>Setup Failure</h1><p>body</p></article></body></html>',
        'https://example.com/setup-failure',
        'Setup Failure',
        baseConfig,
      );

      expect(result.success).toBe(false);
      expect(result.errors.some((error) => /session bootstrap failed/i.test(error))).toBe(true);
      expect(manager.inFlightRequests.size).toBe(0);
    } finally {
      manager.generateSessionId = originalGenerateSessionId;
    }
  });

  it('coalesces concurrent identical requests into one in-flight execution', async () => {
    const html = `
      <html><body>
        <article>
          <h1>Dedup Title</h1>
          <p>${'Dedup paragraph content. '.repeat(40)}</p>
        </article>
      </body></html>
    `;
    const config = {
      ...baseConfig,
      readabilityPreset: 'blog-article',
      performance: { ...baseConfig.performance, enableCaching: false },
    };

    const extractSpy = vi.spyOn(ReadabilityConfigManager, 'extractContent');
    try {
      const [resultA, resultB] = await Promise.all([
        OfflineModeManager.processContent(html, 'https://example.com/dedup', 'Dedup', config),
        OfflineModeManager.processContent(html, 'https://example.com/dedup', 'Dedup', config),
      ]);

      expect(resultA.success).toBe(true);
      expect(resultB.success).toBe(true);
      expect(resultA.markdown).toBe(resultB.markdown);
      expect(extractSpy).toHaveBeenCalledTimes(1);

      const manager = OfflineModeManager as any;
      expect(manager.inFlightRequests.size).toBe(0);
    } finally {
      extractSpy.mockRestore();
    }
  });

  it('keeps real-time monitoring singleton-safe across repeated starts', () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    try {
      const first = OfflineModeManager.startRealTimeMonitoring();
      const second = OfflineModeManager.startRealTimeMonitoring();

      expect(setIntervalSpy).toHaveBeenCalledTimes(2);
      expect(clearIntervalSpy.mock.calls.length).toBeGreaterThanOrEqual(1);

      first.stop();
      second.stop();
    } finally {
      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    }
  });
});
