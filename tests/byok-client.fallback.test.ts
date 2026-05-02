import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BYOKClient } from '@/pro/byok-client';

describe('BYOKClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('calls proxy URL directly with proxy payload when proxyUrl is provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        content: 'ok-proxy',
        usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 },
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
      },
      { proxyUrl: 'https://promptready.app/api/proxy' }
    );

    expect(result.content).toBe('ok-proxy');
    expect(result.usage?.totalTokens).toBe(8);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // Must call proxy URL exactly, no /chat/completions appended.
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://promptready.app/api/proxy');
    const requestInit = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(requestInit.body as string);
    // Proxy payload shape.
    expect(body.prompt).toBe('hello');
    expect(body.settings).toBeDefined();
    expect(body.settings.apiBase).toBe('https://openrouter.ai/api/v1');
    expect(body.settings.apiKey).toBe('sk-or-v1-test-key');
    expect(body.settings.model).toBe('arcee-ai/trinity-large-preview:free');
  });

  it('throws when proxyUrl is not provided', async () => {
    await expect(BYOKClient.makeRequest(
      { prompt: 'hello', maxTokens: 10, temperature: 0 },
      {
        apiBase: 'https://openrouter.ai/api/v1',
        apiKey: 'sk-or-v1-test-key',
        model: 'arcee-ai/trinity-large-preview:free',
      }
      // no proxyUrl
    )).rejects.toThrow('proxyUrl is required for BYOK requests');
  });

  it('fails closed when API key is missing', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await expect(BYOKClient.makeRequest(
      { prompt: 'hello', maxTokens: 10, temperature: 0.2 },
      {
        apiBase: 'https://openrouter.ai/api/v1',
        apiKey: '',
        model: 'arcee-ai/trinity-large-preview:free',
      },
      { proxyUrl: 'https://promptready.app/api/proxy' }
    )).rejects.toThrow('BYOK API key is required');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fails closed when proxyUrl is set but upstream apiBase is missing', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        error: 'settings.apiBase is required',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(BYOKClient.makeRequest(
      { prompt: 'hello', maxTokens: 10, temperature: 0 },
      {
        apiBase: '',
        apiKey: 'sk-or-v1-test-key',
        model: 'arcee-ai/trinity-large-preview:free',
      },
      { proxyUrl: 'https://promptready.app/api/proxy' }
    )).rejects.toThrow();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('uses the proxy JSON error message instead of exposing the raw error envelope', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        error: 'OpenRouter returned no text for model=google/gemma-4-31b-it:free. Try another OpenRouter model.',
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(BYOKClient.makeRequest(
      { prompt: 'hello', maxTokens: 10, temperature: 0 },
      {
        apiBase: 'https://openrouter.ai/api/v1',
        apiKey: 'sk-or-v1-test-key',
        model: 'google/gemma-4-31b-it:free',
      },
      { proxyUrl: 'https://promptready.app/api/proxy' }
    )).rejects.toThrow(
      'BYOK request failed: OpenRouter returned no text for model=google/gemma-4-31b-it:free. Try another OpenRouter model.',
    );
  });

  it('reports proxy URL and dev remediation when browser fetch fails before a response', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(BYOKClient.makeRequest(
      { prompt: 'hello', maxTokens: 10, temperature: 0 },
      {
        apiBase: 'https://openrouter.ai/api/v1',
        apiKey: 'sk-or-v1-test-key',
        model: 'arcee-ai/trinity-large-preview:free',
      },
      { proxyUrl: 'http://127.0.0.1:8788/byok/proxy' }
    )).rejects.toThrow(
      'BYOK proxy network request failed for http://127.0.0.1:8788/byok/proxy',
    );
  });

  it('allows long OpenRouter BYOK requests before timing out', async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;

    vi.spyOn(globalThis, 'fetch').mockImplementationOnce((_input, init) => {
      capturedSignal = init?.signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) => {
        capturedSignal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    const pending = BYOKClient.makeRequest(
      { prompt: 'long page', maxTokens: 4000, temperature: 0.2 },
      {
        apiBase: 'https://openrouter.ai/api/v1',
        apiKey: 'sk-or-v1-test-key',
        model: 'openai/gpt-5.2',
      },
      { proxyUrl: 'https://promptready.app/api/proxy' },
    );
    const timeoutExpectation = expect(pending).rejects.toThrow('BYOK request timed out');

    await vi.advanceTimersByTimeAsync(89_999);
    expect(capturedSignal?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await timeoutExpectation;
  });
});
