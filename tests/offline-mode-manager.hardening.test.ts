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
    expect(result.processingStats.fallbacksUsed).toContain('readability-fallback');
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
    expect(result.processingStats.fallbacksUsed).toContain('readability-fallback');
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

  it('removes merged popup-noise and inline demo citation fragments from copied markdown', () => {
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
    expect(canonical).not.toContain('Source: example.com/rag-guide');
    expect(canonical).toContain('Cleaner input. Better model output.');
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
