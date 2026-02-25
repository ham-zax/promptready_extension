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
