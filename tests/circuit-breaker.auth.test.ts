import { describe, expect, it, vi } from 'vitest';
import worker from '../functions/circuit-breaker/index';

function createEnv(overrides: Record<string, unknown> = {}) {
  const values = new Map<string, string>();

  return {
    BUDGET_KV: {
      get: vi.fn(async (key: string) => values.get(key) ?? null),
      put: vi.fn(async (key: string, value: string) => {
        values.set(key, value);
      }),
    } as any,
    SERVICE_SECRET: 'test-secret',
    ALLOWED_ORIGINS: 'https://promptready.app,http://localhost:5173',
    ...overrides,
  } as any;
}

function createCtx() {
  return {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
  } as any;
}

describe('circuit-breaker auth/runtime behavior', () => {
  it('rejects unauthenticated requests from disallowed origins', async () => {
    const env = createEnv();
    const req = new Request('https://worker.test/', {
      method: 'POST',
      headers: {
        Origin: 'https://evil.example',
      },
    });

    const res = await worker.fetch(req, env, createCtx());
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({
      status: 'UNAUTHORIZED',
      error: 'Access denied',
    });
  });

  it('allows service-authenticated internal requests without Origin', async () => {
    const env = createEnv({ ALLOWED_ORIGINS: '' });
    const req = new Request('https://worker.test/', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-secret',
      },
    });

    const res = await worker.fetch(req, env, createCtx());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      status: 'OK',
    });
  });

  it('allows configured allowed origins without service auth', async () => {
    const env = createEnv();
    const req = new Request('https://worker.test/', {
      method: 'POST',
      headers: {
        Origin: 'https://promptready.app',
      },
    });

    const res = await worker.fetch(req, env, createCtx());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      status: 'OK',
    });
  });

  it('returns SERVICE_AT_CAPACITY when weekly spend reaches cap for authorized caller', async () => {
    const env = createEnv({
      BUDGET_KV: {
        get: vi.fn(async (key: string) => {
          if (key === 'weekly_spend_usd') return '101';
          if (key === 'weekly_cap_usd') return '100';
          return null;
        }),
      } as any,
    });

    const req = new Request('https://worker.test/', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-secret',
      },
    });

    const res = await worker.fetch(req, env, createCtx());
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({
      status: 'SERVICE_AT_CAPACITY',
    });
  });
});
