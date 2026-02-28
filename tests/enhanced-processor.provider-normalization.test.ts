import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { EnhancedOffscreenProcessor } from '@/entrypoints/offscreen/enhanced-processor';
import { BYOKClient } from '@/pro/byok-client';

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      sendMessage: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

describe('EnhancedOffscreenProcessor AI provider normalization', () => {
  const byokSpy = vi.spyOn(BYOKClient, 'makeRequest');

  beforeEach(() => {
    byokSpy.mockReset();
  });

  afterEach(() => {
    byokSpy.mockReset();
  });

  it('normalizes legacy provider aliases and does not force offline fallback', async () => {
    byokSpy.mockResolvedValue({
      content: '# normalized',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    });

    const processor = Object.create((EnhancedOffscreenProcessor as any).prototype) as any;
    processor.sendProgress = vi.fn();
    processor.sendComplete = vi.fn();
    processor.generateStructuredExport = vi.fn().mockReturnValue({ version: '1.0' });
    processor.processOfflineMode = vi.fn().mockResolvedValue({
      exportMd: 'offline',
      exportJson: { version: '1.0' },
      metadata: {},
      stats: {},
      warnings: [],
      originalHtml: '<p>offline</p>',
    });

    const result = await processor.processAIMode(
      '<article><h1>Title</h1><p>Body</p></article>',
      'https://example.com',
      'Title',
      {} as any,
      {
        byok: {
          provider: 'manual',
          apiKey: 'sk-or-v1-test-key',
          model: 'arcee-ai/trinity-large-preview:free',
        },
      } as any,
      undefined,
      'sel-123',
    );

    expect(byokSpy).toHaveBeenCalledTimes(1);
    expect(processor.processOfflineMode).not.toHaveBeenCalled();
    expect(result.warnings).toContain('ai_provider_normalized:legacy_alias');
    expect(result.aiAttempted).toBe(true);
    expect(result.aiProvider).toBe('openrouter');
    expect(result.aiOutcome).toBe('success');
    expect(result.exportMd).toContain('> Source: [Title](https://example.com)');
    expect(result.exportMd).toContain('> Hash: sel-123');
    expect(result.exportMd).toContain('# normalized');
  });

  it('returns deterministic fallback trace when key is missing', async () => {
    const processor = Object.create((EnhancedOffscreenProcessor as any).prototype) as any;
    processor.sendProgress = vi.fn();
    processor.sendComplete = vi.fn();
    processor.generateStructuredExport = vi.fn().mockReturnValue({ version: '1.0' });
    processor.processOfflineMode = vi.fn().mockImplementation(
      async (_html: string, _url: string, _title: string, _config: unknown, _metadataHtml: unknown, aiTrace: any) => ({
        exportMd: 'offline',
        exportJson: { version: '1.0' },
        metadata: {},
        stats: {},
        warnings: [],
        originalHtml: '<p>offline</p>',
        ...aiTrace,
      })
    );

    const result = await processor.processAIMode(
      '<article><h1>Title</h1><p>Body</p></article>',
      'https://example.com',
      'Title',
      {} as any,
      {
        byok: {
          provider: 'openrouter',
          apiKey: '',
          model: 'arcee-ai/trinity-large-preview:free',
        },
      } as any,
    );

    expect(byokSpy).not.toHaveBeenCalled();
    expect(processor.processOfflineMode).toHaveBeenCalledTimes(1);
    expect(result.aiAttempted).toBe(false);
    expect(result.aiProvider).toBe(null);
    expect(result.aiOutcome).toBe('fallback_missing_key');
    expect(result.fallbackCode).toBe('ai_fallback:missing_openrouter_key');
    expect(result.warnings).toContain('ai_fallback:missing_openrouter_key');
  });

  it('returns deterministic fallback trace when OpenRouter request fails', async () => {
    byokSpy.mockRejectedValue(new Error('network down'));

    const processor = Object.create((EnhancedOffscreenProcessor as any).prototype) as any;
    processor.sendProgress = vi.fn();
    processor.sendError = vi.fn();
    processor.sendComplete = vi.fn();
    processor.generateStructuredExport = vi.fn().mockReturnValue({ version: '1.0' });
    processor.processOfflineMode = vi.fn().mockImplementation(
      async (_html: string, _url: string, _title: string, _config: unknown, _metadataHtml: unknown, aiTrace: any) => ({
        exportMd: 'offline',
        exportJson: { version: '1.0' },
        metadata: {},
        stats: {},
        warnings: [],
        originalHtml: '<p>offline</p>',
        ...aiTrace,
      })
    );

    const result = await processor.processAIMode(
      '<article><h1>Title</h1><p>Body</p></article>',
      'https://example.com',
      'Title',
      {} as any,
      {
        byok: {
          provider: 'openrouter',
          apiKey: 'sk-or-v1-test-key',
          model: 'arcee-ai/trinity-large-preview:free',
        },
      } as any,
    );

    expect(byokSpy).toHaveBeenCalledTimes(1);
    expect(processor.processOfflineMode).toHaveBeenCalledTimes(1);
    expect(result.aiAttempted).toBe(true);
    expect(result.aiProvider).toBe('openrouter');
    expect(result.aiOutcome).toBe('fallback_request_failed');
    expect(result.fallbackCode).toBe('ai_fallback:request_failed');
    expect(result.warnings).toContain('ai_fallback:request_failed');
  });

  it('returns daily-limit fallback without attempting OpenRouter request when gate blocks AI', async () => {
    const processor = Object.create((EnhancedOffscreenProcessor as any).prototype) as any;
    processor.sendProgress = vi.fn();
    processor.sendError = vi.fn();
    processor.sendComplete = vi.fn();
    processor.generateStructuredExport = vi.fn().mockReturnValue({ version: '1.0' });
    processor.processOfflineMode = vi.fn().mockImplementation(
      async (_html: string, _url: string, _title: string, _config: unknown, _metadataHtml: unknown, aiTrace: any) => ({
        exportMd: 'offline',
        exportJson: { version: '1.0' },
        metadata: {},
        stats: {},
        warnings: [],
        originalHtml: '<p>offline</p>',
        ...aiTrace,
      })
    );

    const result = await processor.processAIMode(
      '<article><h1>Title</h1><p>Body</p></article>',
      'https://example.com',
      'Title',
      {} as any,
      {
        byok: {
          provider: 'openrouter',
          apiKey: 'sk-or-v1-test-key',
          model: 'arcee-ai/trinity-large-preview:free',
        },
      } as any,
      undefined,
      'sel-limit',
      'run_1',
      {
        canUseAIMode: false,
        lockReason: 'daily_limit_reached',
        fallbackCode: 'ai_fallback:daily_limit_reached',
      },
    );

    expect(byokSpy).not.toHaveBeenCalled();
    expect(processor.processOfflineMode).toHaveBeenCalledTimes(1);
    expect(result.aiOutcome).toBe('fallback_daily_limit_reached');
    expect(result.fallbackCode).toBe('ai_fallback:daily_limit_reached');
    expect(result.runId).toBe('run_1');
  });
});
