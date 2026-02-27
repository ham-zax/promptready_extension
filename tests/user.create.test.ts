import { describe, expect, it } from 'vitest';

import worker from '../functions/credit-service';

describe('credit-service: /user/create', () => {
  it('requires service auth', async () => {
    const env = {
      CREDITS_KV: new Map() as any,
      SERVICE_SECRET: 'secret',
    } as any;

    const req = new Request('http://localhost/user/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: '00000000-0000-4000-8000-000000000000' }),
    });

    const res = await worker.fetch(req, env, {} as any);
    expect(res.status).toBe(401);
  });

  it('creates user with initial 150 credits (idempotent)', async () => {
    const store = new Map<string, string>();
    const env = {
      CREDITS_KV: {
        async get(key: string) {
          return store.has(key) ? store.get(key)! : null;
        },
        async put(key: string, value: string) {
          store.set(key, value);
        },
      },
      SERVICE_SECRET: 'secret',
    } as any;

    const makeReq = () =>
      new Request('http://localhost/user/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer secret',
        },
        body: JSON.stringify({ userId: '00000000-0000-4000-8000-000000000000' }),
      });

    const res1 = await worker.fetch(makeReq(), env, {} as any);
    expect(res1.status).toBe(201);
    const body1 = await res1.json();
    expect(body1).toEqual({
      userId: '00000000-0000-4000-8000-000000000000',
      balance: 150,
    });

    const res2 = await worker.fetch(makeReq(), env, {} as any);
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2).toEqual({
      userId: '00000000-0000-4000-8000-000000000000',
      balance: 150,
    });
  });
});
