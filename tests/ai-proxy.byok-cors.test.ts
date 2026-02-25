import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import worker from '../functions/ai-proxy/index';

function createEnv(overrides: Record<string, any> = {}) {
  return {
    CREDITS_KV: {} as any,
    BUDGET_KV: {} as any,
    AI_API_KEY: 'test-ai-key',
    SERVICE_SECRET: 'test-secret',
    OPENROUTER_HTTP_REFERER: 'https://promptready.app',
    OPENROUTER_TITLE: 'PromptReady Extension',
    OPENROUTER_API_KEY: '',
    ALLOWED_ORIGINS: '',
    costTrackingQueue: {} as any,
    CREDIT_SERVICE: { fetch: vi.fn() } as any,
    ...overrides,
  } as any;
}

function createCtx() {
  return {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
  } as any;
}

describe('ai-proxy BYOK CORS', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('handles OPTIONS preflight for allowed localhost origin', async () => {
    const env = createEnv();
    const req = new Request('https://worker.test/byok/proxy', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://127.0.0.1:5173',
        'Access-Control-Request-Method': 'POST',
      },
    });

    const res = await worker.fetch(req, env, createCtx());
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://127.0.0.1:5173');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('rejects disallowed origins with 403', async () => {
    const env = createEnv();
    const req = new Request('https://worker.test/byok/proxy', {
      method: 'POST',
      headers: {
        Origin: 'https://evil.example',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'hello',
        settings: {
          apiBase: 'https://openrouter.ai/api/v1',
          model: 'arcee-ai/trinity-large-preview:free',
        },
      }),
    });

    const res = await worker.fetch(req, env, createCtx());
    expect(res.status).toBe(403);
    const payload = await res.json() as any;
    expect(payload.error).toContain('Origin not allowed');
  });

  it('returns 400 for OpenRouter requests without key in settings or env', async () => {
    const env = createEnv();
    const req = new Request('https://worker.test/byok/proxy', {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:5173',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'hello',
        settings: {
          apiBase: 'https://openrouter.ai/api/v1',
          model: 'arcee-ai/trinity-large-preview:free',
        },
      }),
    });

    const res = await worker.fetch(req, env, createCtx());
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toContain('OpenRouter API key is required');
  });

  it('routes BYOK OpenRouter calls with env key + attribution headers', async () => {
    const env = createEnv({ OPENROUTER_API_KEY: 'sk-or-v1-env-test-key' });
    const upstreamFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'ok' } }],
          usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    global.fetch = upstreamFetch as any;

    const req = new Request('https://worker.test/byok/proxy', {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:5173',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'hello',
        settings: {
          apiBase: 'https://openrouter.ai/api/v1',
          model: 'arcee-ai/trinity-large-preview:free',
        },
      }),
    });

    const res = await worker.fetch(req, env, createCtx());
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.content).toBe('ok');
    expect(body.usage.totalTokens).toBe(3);

    expect(upstreamFetch).toHaveBeenCalledTimes(1);
    const [url, options] = upstreamFetch.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(options.headers.Authorization).toBe('Bearer sk-or-v1-env-test-key');
    expect(options.headers['HTTP-Referer']).toBe('https://promptready.app');
    expect(options.headers['X-Title']).toBe('PromptReady Extension');
  });
});
