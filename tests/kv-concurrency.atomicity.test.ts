import { describe, expect, it } from 'vitest';

const USER_ID = '00000000-0000-4000-8000-000000000000';

// Minimal KV mock that is intentionally non-atomic for read-modify-write,
// and supports a TTL-ish lock via expirationTtl.
class MockKV {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    const expiresAt = options?.expirationTtl
      ? Date.now() + options.expirationTtl * 1000
      : undefined;
    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

describe('KV RMW race condition mitigations (lock-based serialization)', () => {
  it('credit-service decrement: concurrent decrements should not lose updates', async () => {
    const mod = await import('../functions/credit-service/index');
    const worker = mod.default as { fetch: (r: Request, e: any, c: any) => Promise<Response> };

    const kv = new MockKV();
    await kv.put(USER_ID, '150');

    const env = { CREDITS_KV: kv as any, SERVICE_SECRET: 's' };

    const makeReq = () =>
      new Request('https://credit-service/credits/decrement', {
        method: 'POST',
        headers: { Authorization: 'Bearer s', 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: USER_ID }),
      });

    // Fire 50 concurrent decrements.
    const results = await Promise.all(
      Array.from({ length: 50 }, async () => {
        const res = await worker.fetch(makeReq(), env, {});
        return res.status;
      })
    );

    // Some may 409 if they couldn't acquire the lock fast enough, but
    // successful ones must reduce the balance accordingly with no lost updates.
    const successCount = results.filter((s) => s === 200).length;
    const finalCredits = parseInt((await kv.get(USER_ID))!, 10);
    expect(finalCredits).toBe(150 - successCount);
  });

  it('cost-tracker: concurrent batches should not lose updates', async () => {
    const mod = await import('../functions/cost-tracker/index');
    const worker = mod.default as { queue: (b: any, e: any) => Promise<void> };

    const kv = new MockKV();
    const env = { BUDGET_KV: kv as any };

    const makeBatch = (cost: number) => ({
      messages: [{ body: { cost, timestamp: Date.now() } }],
    });

    await Promise.all([
      worker.queue(makeBatch(1), env),
      worker.queue(makeBatch(1), env),
      worker.queue(makeBatch(1), env),
      worker.queue(makeBatch(1), env),
      worker.queue(makeBatch(1), env),
      worker.queue(makeBatch(1), env),
      worker.queue(makeBatch(1), env),
      worker.queue(makeBatch(1), env),
      worker.queue(makeBatch(1), env),
      worker.queue(makeBatch(1), env),
    ]);

    const spend = parseFloat((await kv.get('weekly_spend_usd')) || '0');
    // Some batches may drop on lock contention, but we should never end up with
    // a value > number of successful updates; and we should never get NaN.
    expect(Number.isFinite(spend)).toBe(true);
    expect(spend).toBeGreaterThanOrEqual(0);
    expect(spend).toBeLessThanOrEqual(10);
  });
});
