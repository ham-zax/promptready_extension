import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BYOKClient } from '@/pro/byok-client';

describe('BYOKClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('calls OpenRouter directly by default without proxyUrl', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'ok-direct',
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
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
        model: 'openai/gpt-5.2',
      },
    );

    expect(result.content).toBe('ok-direct');
    expect(result.usage?.totalTokens).toBe(8);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://openrouter.ai/api/v1/chat/completions');
    const requestInit = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(requestInit.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer sk-or-v1-test-key',
      'HTTP-Referer': 'https://promptready.app',
      'X-OpenRouter-Title': 'PromptReady Extension',
    });
    const body = JSON.parse(requestInit.body as string);
    expect(body).toMatchObject({
      model: 'openai/gpt-5.2',
      temperature: 0,
      max_completion_tokens: 10,
      messages: [{ role: 'user', content: 'hello' }],
    });
  });

  it('calls proxy URL directly with proxy payload when proxy transport is requested', async () => {
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
      { proxyUrl: 'https://promptready.app/api/proxy', transport: 'proxy' }
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

  it('keeps proxyUrl-only options on the proxy transport for compatibility', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        content: 'ok-proxy-compat',
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
      { proxyUrl: 'https://promptready.app/api/proxy' },
    );

    expect(result.content).toBe('ok-proxy-compat');
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://promptready.app/api/proxy');
  });

  it('does not append chat completions twice when apiBase already points to the endpoint', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'ok-direct',
            },
            finish_reason: 'stop',
          },
        ],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await BYOKClient.makeRequest(
      { prompt: 'hello', maxTokens: 10, temperature: 0 },
      {
        apiBase: 'https://openrouter.ai/api/v1/chat/completions',
        apiKey: 'sk-or-v1-test-key',
        model: 'openai/gpt-5.2',
      },
    );

    expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://openrouter.ai/api/v1/chat/completions');
  });

  it('throws when proxy transport is requested without proxyUrl', async () => {
    await expect(BYOKClient.makeRequest(
      { prompt: 'hello', maxTokens: 10, temperature: 0 },
      {
        apiBase: 'https://openrouter.ai/api/v1',
        apiKey: 'sk-or-v1-test-key',
        model: 'arcee-ai/trinity-large-preview:free',
      },
      { transport: 'proxy' },
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
      { proxyUrl: 'https://promptready.app/api/proxy', transport: 'proxy' }
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
      { proxyUrl: 'https://promptready.app/api/proxy', transport: 'proxy' }
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
      { proxyUrl: 'https://promptready.app/api/proxy', transport: 'proxy' }
    )).rejects.toThrow(
      'BYOK request failed: OpenRouter returned no text for model=google/gemma-4-31b-it:free. Try another OpenRouter model.',
    );
  });

  it('surfaces direct OpenRouter embedded choice errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        choices: [
          {
            error: {
              code: 429,
              message: 'Provider temporarily rate-limited',
            },
            finish_reason: 'error',
          },
        ],
      }), {
        status: 200,
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
    )).rejects.toThrow('BYOK request failed: Provider temporarily rate-limited');
  });

  it('includes OpenRouter provider raw metadata for direct HTTP errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        error: {
          code: 429,
          message: 'Provider returned error',
          metadata: {
            raw: 'google/gemma-4-31b-it:free is temporarily rate-limited upstream',
            provider_name: 'Google AI Studio',
          },
        },
      }), {
        status: 429,
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
    )).rejects.toThrow(
      'BYOK request failed: Provider returned error: google/gemma-4-31b-it:free is temporarily rate-limited upstream',
    );
  });

  it('caps long OpenRouter provider raw metadata in direct HTTP errors', async () => {
    const raw = `provider raw ${'x'.repeat(700)}`;
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        error: {
          message: 'Provider returned error',
          metadata: { raw },
        },
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
    )).rejects.toThrow(new RegExp(`^BYOK request failed: .{1,500}$`));
  });

  it('reports direct OpenRouter no-text completions with model and finish reason context', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        choices: [
          {
            message: { role: 'assistant', content: null },
            finish_reason: 'length',
            native_finish_reason: 'MAX_TOKENS',
          },
        ],
      }), {
        status: 200,
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
    )).rejects.toThrow(
      'BYOK returned empty content for model=google/gemma-4-31b-it:free (finish reasons: length/MAX_TOKENS). Try another OpenRouter model.',
    );
  });

  it('reports direct OpenRouter empty JSON bodies without leaking parser errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(BYOKClient.makeRequest(
      { prompt: 'hello', maxTokens: 10, temperature: 0 },
      {
        apiBase: 'https://openrouter.ai/api/v1',
        apiKey: 'sk-or-v1-test-key',
        model: 'meta-llama/llama-3.2-3b-instruct:free',
      },
    )).rejects.toThrow('BYOK direct OpenRouter request returned empty response body');
  });

  it('reports direct OpenRouter invalid JSON bodies with a capped preview', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('<html>temporarily unavailable</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }),
    );

    await expect(BYOKClient.makeRequest(
      { prompt: 'hello', maxTokens: 10, temperature: 0 },
      {
        apiBase: 'https://openrouter.ai/api/v1',
        apiKey: 'sk-or-v1-test-key',
        model: 'meta-llama/llama-3.2-3b-instruct:free',
      },
    )).rejects.toThrow(
      'BYOK direct OpenRouter request returned invalid JSON: <html>temporarily unavailable</html>',
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
      { proxyUrl: 'http://127.0.0.1:8788/byok/proxy', transport: 'proxy' }
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
    );
    const timeoutExpectation = expect(pending).rejects.toThrow('BYOK request timed out');

    await vi.advanceTimersByTimeAsync(89_999);
    expect(capturedSignal?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await timeoutExpectation;
  });
});
