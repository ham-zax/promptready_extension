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
    );

    expect(byokSpy).toHaveBeenCalledTimes(1);
    expect(processor.processOfflineMode).not.toHaveBeenCalled();
    expect(result.warnings).toContain('ai_provider_normalized:legacy_alias');
  });
});
