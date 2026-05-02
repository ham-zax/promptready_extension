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

  function createOfflineResult(markdown = [
    '# Title',
    '',
    '## Install',
    '',
    'Use `npx` to install.',
    '',
    '## Configure',
    '',
    'Set `MILVUS_TOKEN` only for authenticated endpoints.',
  ].join('\n')) {
    return {
      exportMd: markdown,
      exportJson: { version: '1.0', content: { markdown } },
      metadata: {},
      stats: { fallbacksUsed: [] },
      warnings: [],
      originalHtml: '<p>offline</p>',
    };
  }

  beforeEach(() => {
    byokSpy.mockReset();
  });

  afterEach(() => {
    byokSpy.mockReset();
  });

  it('normalizes legacy provider aliases and uses offline markdown as the AI prompt baseline', async () => {
    byokSpy.mockResolvedValue({
      content: [
        '# Title',
        '',
        '## Install',
        '',
        'Use `npx` to install.',
        '',
        '## Configure',
        '',
        'Set `MILVUS_TOKEN` only for authenticated endpoints.',
      ].join('\n'),
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    });

    const processor = Object.create((EnhancedOffscreenProcessor as any).prototype) as any;
    processor.sendProgress = vi.fn();
    processor.sendComplete = vi.fn();
    processor.generateStructuredExport = vi.fn().mockReturnValue({ version: '1.0' });
    processor.processOfflineMode = vi.fn().mockResolvedValue(createOfflineResult());

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
    expect(processor.processOfflineMode).toHaveBeenCalledTimes(1);
    const prompt = byokSpy.mock.calls[0]?.[0].prompt;
    expect(prompt).toContain('<offline_markdown_baseline>');
    expect(prompt).toContain('## Install');
    expect(prompt).toContain('Use `npx` to install.');
    expect(prompt).toContain('Use captured HTML only as secondary recovery context');
    expect(result.warnings).toContain('ai_provider_normalized:legacy_alias');
    expect(result.aiAttempted).toBe(true);
    expect(result.aiProvider).toBe('openrouter');
    expect(result.aiOutcome).toBe('success');
    expect(result.exportMd).toContain('> Source: [Title](https://example.com)');
    expect(result.exportMd).toContain('> Hash: sel-123');
    expect(result.exportMd).toContain('## Configure');
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
        stats: { fallbacksUsed: [] },
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
    expect(result.stats.fallbacksUsed).toContain('ai_fallback:missing_openrouter_key');
  });

  it('prefers the explicit selected BYOK model over the legacy model field', async () => {
    byokSpy.mockResolvedValue({
      content: [
        '# Title',
        '',
        '## Install',
        '',
        'Use `npx` to install.',
        '',
        '## Configure',
        '',
        'Set `MILVUS_TOKEN` only for authenticated endpoints.',
      ].join('\n'),
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    });

    const processor = Object.create((EnhancedOffscreenProcessor as any).prototype) as any;
    processor.sendProgress = vi.fn();
    processor.sendComplete = vi.fn();
    processor.generateStructuredExport = vi.fn().mockReturnValue({ version: '1.0' });
    processor.processOfflineMode = vi.fn().mockResolvedValue(createOfflineResult());

    await processor.processAIMode(
      '<article><h1>Title</h1><p>Body</p></article>',
      'https://example.com',
      'Title',
      {} as any,
      {
        byok: {
          provider: 'openrouter',
          apiKey: 'sk-or-v1-test-key',
          model: 'openrouter/free',
          selectedByokModel: 'openai/gpt-5.2',
        },
      } as any,
    );

    expect(byokSpy).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ model: 'openai/gpt-5.2' }),
    );
    expect(byokSpy.mock.calls[0]?.[2]).toBeUndefined();
  });

  it('falls back to offline markdown when AI output is summary-like and drops headings', async () => {
    byokSpy.mockResolvedValue({
      content: '# Summary\n\nThis page explains installation and configuration.',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    });

    const offlineMarkdown = [
      '# Title',
      '',
      '## Install',
      '',
      'Use `npx` to install.',
      '',
      '## Configure',
      '',
      'Set `MILVUS_TOKEN` only for authenticated endpoints.',
      '',
      '## Failure States Are Explicit',
      '',
      'Errors use stable warning codes.',
    ].join('\n');
    const processor = Object.create((EnhancedOffscreenProcessor as any).prototype) as any;
    processor.sendProgress = vi.fn();
    processor.sendComplete = vi.fn();
    processor.generateStructuredExport = vi.fn().mockImplementation((result: any) => ({
      version: '1.0',
      content: { markdown: result.markdown },
      metadata: result.metadata || {},
    }));
    processor.processOfflineMode = vi.fn().mockResolvedValue(createOfflineResult(offlineMarkdown));

    const result = await processor.processAIMode(
      '<article><h1>Title</h1><h2>Install</h2><p>Use npx.</p><h2>Configure</h2><p>Set token.</p></article>',
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
      'sel-summary',
    );

    expect(byokSpy).toHaveBeenCalledTimes(1);
    expect(result.exportMd).toContain('## Failure States Are Explicit');
    expect(result.exportMd).toContain('Set `MILVUS_TOKEN` only for authenticated endpoints.');
    expect(result.exportMd).not.toContain('# Summary');
    expect(result.aiAttempted).toBe(true);
    expect(result.aiProvider).toBe('openrouter');
    expect(result.aiOutcome).toBe('fallback_quality_gate_failed');
    expect(result.fallbackCode).toBe('ai_fallback:quality_gate_failed');
    expect(result.warnings).toContain('ai_fallback:quality_gate_failed');
    expect(result.stats.fallbacksUsed).toContain('ai_fallback:quality_gate_failed');
    expect(result.warnings).toContain('ai_quality_gate:heading_loss');
    expect(result.warnings).toContain('ai_quality_gate:content_loss');
    expect(result.exportJson.processing.warnings).toContain('ai_quality_gate:heading_loss');
  });

  it('falls back to offline markdown when AI output has malformed code fences', async () => {
    byokSpy.mockResolvedValue({
      content: [
        '# Title',
        '',
        '## Install',
        '',
        '```bash',
        'npx -y @zokizuan/satori-cli doctor',
      ].join('\n'),
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    });

    const offlineMarkdown = [
      '# Title',
      '',
      '## Install',
      '',
      '```bash',
      'npx -y @zokizuan/satori-cli doctor',
      '```',
    ].join('\n');
    const processor = Object.create((EnhancedOffscreenProcessor as any).prototype) as any;
    processor.sendProgress = vi.fn();
    processor.sendComplete = vi.fn();
    processor.generateStructuredExport = vi.fn().mockImplementation((result: any) => ({
      version: '1.0',
      content: { markdown: result.markdown },
      metadata: result.metadata || {},
    }));
    processor.processOfflineMode = vi.fn().mockResolvedValue(createOfflineResult(offlineMarkdown));

    const result = await processor.processAIMode(
      '<article><h1>Title</h1><h2>Install</h2><pre>npx</pre></article>',
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

    expect(result.exportMd).toContain('npx -y @zokizuan/satori-cli doctor');
    expect(result.aiOutcome).toBe('fallback_quality_gate_failed');
    expect(result.warnings).toContain('ai_fallback:quality_gate_failed');
    expect(result.warnings).toContain('ai_quality_gate:malformed_fences');
  });

  it('falls back when AI preserves headings but reorders baseline sections', async () => {
    byokSpy.mockResolvedValue({
      content: [
        '# Title',
        '',
        '## Configure',
        '',
        'Set `MILVUS_TOKEN` only for authenticated endpoints.',
        '',
        '## Install',
        '',
        'Use `npx` to install.',
        '',
        '## Verify',
        '',
        'Run `npx -y @zokizuan/satori-cli@0.3.1 doctor`.',
      ].join('\n'),
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    });

    const offlineMarkdown = [
      '# Title',
      '',
      '## Install',
      '',
      'Use `npx` to install.',
      '',
      '## Configure',
      '',
      'Set `MILVUS_TOKEN` only for authenticated endpoints.',
      '',
      '## Verify',
      '',
      'Run `npx -y @zokizuan/satori-cli@0.3.1 doctor`.',
    ].join('\n');
    const processor = Object.create((EnhancedOffscreenProcessor as any).prototype) as any;
    processor.sendProgress = vi.fn();
    processor.sendComplete = vi.fn();
    processor.generateStructuredExport = vi.fn().mockImplementation((result: any) => ({
      version: '1.0',
      content: { markdown: result.markdown },
      metadata: result.metadata || {},
      processing: { warnings: result.warnings || [] },
    }));
    processor.processOfflineMode = vi.fn().mockResolvedValue(createOfflineResult(offlineMarkdown));

    const result = await processor.processAIMode(
      '<article><h1>Title</h1><h2>Install</h2><h2>Configure</h2><h2>Verify</h2></article>',
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

    expect(result.aiOutcome).toBe('fallback_quality_gate_failed');
    expect(result.exportMd).toContain('## Install');
    expect(result.exportMd.indexOf('## Install')).toBeLessThan(result.exportMd.indexOf('## Configure'));
    expect(result.warnings).toContain('ai_quality_gate:heading_order_loss');
  });

  it('falls back when AI changes technical tokens from the offline baseline', async () => {
    byokSpy.mockResolvedValue({
      content: [
        '# Title',
        '',
        '## Install',
        '',
        'Run `npx -y @zokizuan/satori-cli doctor`.',
        '',
        '## Configure',
        '',
        'Set `MILVUS_API_KEY` only for authenticated endpoints.',
      ].join('\n'),
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    });

    const offlineMarkdown = [
      '# Title',
      '',
      '## Install',
      '',
      'Run `npx -y @zokizuan/satori-cli@0.3.1 doctor`.',
      '',
      '## Configure',
      '',
      'Set `MILVUS_TOKEN` only for authenticated endpoints.',
    ].join('\n');
    const processor = Object.create((EnhancedOffscreenProcessor as any).prototype) as any;
    processor.sendProgress = vi.fn();
    processor.sendComplete = vi.fn();
    processor.generateStructuredExport = vi.fn().mockImplementation((result: any) => ({
      version: '1.0',
      content: { markdown: result.markdown },
      metadata: result.metadata || {},
    }));
    processor.processOfflineMode = vi.fn().mockResolvedValue(createOfflineResult(offlineMarkdown));

    const result = await processor.processAIMode(
      '<article><h1>Title</h1><h2>Install</h2><h2>Configure</h2></article>',
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

    expect(result.aiOutcome).toBe('fallback_quality_gate_failed');
    expect(result.exportMd).toContain('@zokizuan/satori-cli@0.3.1');
    expect(result.exportMd).toContain('MILVUS_TOKEN');
    expect(result.warnings).toContain('ai_quality_gate:technical_token_loss');
  });

  it('does not treat prose starting with command names as required command tokens', async () => {
    byokSpy.mockResolvedValue({
      content: [
        '# Title',
        '',
        '## Background',
        '',
        'npm has workspace support.',
        '',
        'git keeps repository metadata.',
      ].join('\n'),
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    });

    const offlineMarkdown = [
      '# Title',
      '',
      '## Background',
      '',
      'npm supports workspaces.',
      '',
      'git stores repository metadata.',
    ].join('\n');
    const processor = Object.create((EnhancedOffscreenProcessor as any).prototype) as any;
    processor.sendProgress = vi.fn();
    processor.sendComplete = vi.fn();
    processor.generateStructuredExport = vi.fn().mockImplementation((result: any) => ({
      version: '1.0',
      content: { markdown: result.markdown },
      metadata: result.metadata || {},
    }));
    processor.processOfflineMode = vi.fn().mockResolvedValue(createOfflineResult(offlineMarkdown));

    const result = await processor.processAIMode(
      '<article><h1>Title</h1><h2>Background</h2></article>',
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

    expect(result.aiOutcome).toBe('success');
    expect(result.warnings).not.toContain('ai_quality_gate:technical_token_loss');
  });

  it('does not treat command subcommand prose as required command tokens', async () => {
    byokSpy.mockResolvedValue({
      content: [
        '# Title',
        '',
        '## Background',
        '',
        'npm install guidance is common in package documentation.',
        '',
        'git status output can be difficult to scan.',
        '',
        'docker run samples often need port mappings.',
      ].join('\n'),
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    });

    const offlineMarkdown = [
      '# Title',
      '',
      '## Background',
      '',
      'npm install scripts are common in package docs.',
      '',
      'git status output can be hard to read.',
      '',
      'docker run examples often need ports.',
    ].join('\n');
    const processor = Object.create((EnhancedOffscreenProcessor as any).prototype) as any;
    processor.sendProgress = vi.fn();
    processor.sendComplete = vi.fn();
    processor.generateStructuredExport = vi.fn().mockImplementation((result: any) => ({
      version: '1.0',
      content: { markdown: result.markdown },
      metadata: result.metadata || {},
    }));
    processor.processOfflineMode = vi.fn().mockResolvedValue(createOfflineResult(offlineMarkdown));

    const result = await processor.processAIMode(
      '<article><h1>Title</h1><h2>Background</h2></article>',
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

    expect(result.aiOutcome).toBe('success');
    expect(result.warnings).not.toContain('ai_quality_gate:technical_token_loss');
  });

  it('accepts faithful AI markdown with small formatting improvements', async () => {
    byokSpy.mockResolvedValue({
      content: [
        '# Title',
        '',
        '## Install',
        '',
        'Use `npx` to install cleanly.',
        '',
        '## Configure',
        '',
        'Set `MILVUS_TOKEN` only for authenticated endpoints.',
      ].join('\n'),
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    });

    const processor = Object.create((EnhancedOffscreenProcessor as any).prototype) as any;
    processor.sendProgress = vi.fn();
    processor.sendComplete = vi.fn();
    processor.generateStructuredExport = vi.fn().mockImplementation((result: any) => ({
      version: '1.0',
      content: { markdown: result.markdown },
      metadata: result.metadata || {},
    }));
    processor.processOfflineMode = vi.fn().mockResolvedValue(createOfflineResult());

    const result = await processor.processAIMode(
      '<article><h1>Title</h1><h2>Install</h2><p>Use npx.</p><h2>Configure</h2><p>Set token.</p></article>',
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

    expect(result.exportMd).toContain('Use `npx` to install cleanly.');
    expect(result.aiOutcome).toBe('success');
    expect(result.warnings).not.toContain('ai_fallback:quality_gate_failed');
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
        stats: { fallbacksUsed: [] },
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
    expect(result.stats.fallbacksUsed).toContain('ai_fallback:request_failed');
    expect(result.exportJson.processing.warnings).toContain('ai_fallback:request_failed');
  });

  it('starts AI mode by preparing the offline baseline before OpenRouter progress', async () => {
    byokSpy.mockResolvedValue({
      content: [
        '# Title',
        '',
        '## Install',
        '',
        'Use `npx` to install.',
        '',
        '## Configure',
        '',
        'Set `MILVUS_TOKEN` only for authenticated endpoints.',
      ].join('\n'),
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    });

    const processor = Object.create((EnhancedOffscreenProcessor as any).prototype) as any;
    processor.sendProgress = vi.fn();
    processor.sendComplete = vi.fn();
    processor.generateStructuredExport = vi.fn().mockImplementation((result: any) => ({
      version: '1.0',
      content: { markdown: result.markdown },
      metadata: result.metadata || {},
      processing: { warnings: result.warnings || [] },
    }));
    processor.processOfflineMode = vi.fn().mockImplementation(async () => {
      processor.sendProgress('Preparing offline Markdown baseline...', 20, 'offline-baseline');
      return createOfflineResult();
    });

    await processor.processAIMode(
      '<article><h1>Title</h1><h2>Install</h2><h2>Configure</h2></article>',
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

    const stages = processor.sendProgress.mock.calls.map((call: any[]) => call[2]);
    expect(stages[0]).toBe('offline-baseline');
    expect(stages.indexOf('offline-baseline')).toBeLessThan(stages.indexOf('ai-processing'));
    expect(stages.indexOf('ai-processing')).toBeLessThan(stages.indexOf('byok-processing'));
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
        stats: { fallbacksUsed: [] },
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
    expect(result.stats.fallbacksUsed).toContain('ai_fallback:daily_limit_reached');
  });
});
