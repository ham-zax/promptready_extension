import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BYOKClient } from '@/pro/byok-client';

describe('BYOKClient OpenRouter workflow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('calls OpenRouter chat completions endpoint with attribution headers', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        choices: [{ message: { content: 'ok-openrouter' } }],
        usage: {
          prompt_tokens: 11,
          completion_tokens: 7,
          total_tokens: 18,
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await BYOKClient.makeRequest(
      { prompt: 'hello', maxTokens: 10, temperature: 0 },
      {
        apiBase: 'https://openrouter.ai/api/v1',
        apiKey: 'sk-or-v1-test-key',
        model: 'arcee-ai/trinity-large-preview:free',
      }
    );

    expect(result.content).toBe('ok-openrouter');
    expect(result.usage?.totalTokens).toBe(18);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://openrouter.ai/api/v1/chat/completions');
    const requestInit = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect((requestInit.headers as Record<string, string>).Authorization).toBe('Bearer sk-or-v1-test-key');
    expect((requestInit.headers as Record<string, string>)['HTTP-Referer']).toBe('https://promptready.app/');
    expect((requestInit.headers as Record<string, string>)['X-Title']).toBe('PromptReady Extension');
  });

  it('fails closed when API key is missing', async () => {
    await expect(BYOKClient.makeRequest(
      { prompt: 'hello', maxTokens: 10, temperature: 0.2 },
      {
        apiBase: 'https://openrouter.ai/api/v1',
        apiKey: '',
        model: 'arcee-ai/trinity-large-preview:free',
      },
    )).rejects.toThrow('OpenRouter API key is required');
  });
});
