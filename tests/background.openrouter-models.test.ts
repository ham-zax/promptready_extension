import { beforeEach, describe, expect, it, vi } from 'vitest';

const browserMock = vi.hoisted(() => ({
  runtime: {
    sendMessage: vi.fn().mockResolvedValue(undefined),
  },
  storage: {
    session: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

vi.mock('wxt/browser', () => ({
  browser: browserMock,
}));

describe('background OpenRouter model fetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.stubGlobal('defineBackground', (setup: unknown) => setup);
  });

  it('fetches all text models when freeOnly is false', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        data: [
          {
            id: 'paid/model',
            name: 'Paid Model',
            pricing: { prompt: '0.000001', completion: '0.000002' },
            context_length: 128000,
          },
          {
            id: 'free/model:free',
            name: 'Free Model',
            pricing: { prompt: '0', completion: '0' },
            context_length: 32000,
          },
        ],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { EnhancedContentProcessor } = await import('@/entrypoints/background');
    const processor = Object.create((EnhancedContentProcessor as any).prototype) as any;
    Object.assign(processor, {
      OPENROUTER_MODELS_CACHE_TTL_MS: 10 * 60 * 1000,
    });

    await processor.handleFetchModels({
      type: 'FETCH_MODELS',
      payload: {
        provider: 'openrouter',
        apiBase: 'https://openrouter.ai/api/v1',
        freeOnly: false,
        forceRefresh: true,
      },
    });

    expect(globalThis.fetch).toHaveBeenCalledWith('https://openrouter.ai/api/v1/models?output_modalities=text');
    expect(browserMock.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'MODELS_RESULT',
      payload: {
        freeOnly: false,
        models: expect.arrayContaining([
          expect.objectContaining({ id: 'paid/model', isFree: false }),
          expect.objectContaining({ id: 'free/model:free', isFree: true }),
        ]),
      },
    });
  });
});
