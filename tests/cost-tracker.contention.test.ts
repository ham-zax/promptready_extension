import { describe, expect, it, vi } from 'vitest';

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

describe('cost-tracker weekly spend lock contention semantics', () => {
  it('drops spend update (fail-open for accounting) when lock cannot be acquired before timeout', async () => {
    const mod = await import('../functions/cost-tracker/index');
    const worker = mod.default as { queue: (b: any, e: any) => Promise<void> };

    const kv = new MockKV();
    await kv.put('weekly_spend_usd', '5');
    await kv.put('lock:weekly_spend_usd', 'someone-else');

    const env = { BUDGET_KV: kv as any };
    const batch = { messages: [{ body: { cost: 2, timestamp: Date.now() } }] };

    const dateNowSpy = vi.spyOn(Date, 'now');
    const timeline = [0, 0, 800, 800];
    let i = 0;
    dateNowSpy.mockImplementation(() => timeline[Math.min(i++, timeline.length - 1)]);

    await worker.queue(batch as any, env as any);

    expect(await kv.get('weekly_spend_usd')).toBe('5');
    expect(await kv.get('lock:weekly_spend_usd')).toBe('someone-else');

    dateNowSpy.mockRestore();
  });

  it('applies spend update when lock is acquired before timeout', async () => {
    const mod = await import('../functions/cost-tracker/index');
    const worker = mod.default as { queue: (b: any, e: any) => Promise<void> };

    const kv = new MockKV();
    await kv.put('weekly_spend_usd', '5');

    const env = { BUDGET_KV: kv as any };
    const batch = { messages: [{ body: { cost: 2, timestamp: Date.now() } }] };

    await worker.queue(batch as any, env as any);

    expect(await kv.get('weekly_spend_usd')).toBe('7');
    expect(await kv.get('lock:weekly_spend_usd')).toBeNull();
  });
});
