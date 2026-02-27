import { describe, expect, it, vi } from 'vitest';

class ControlledKV {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  constructor(private readonly onPut?: (key: string, value: string) => Promise<void> | void) {}

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
    if (this.onPut) await this.onPut(key, value);
    const expiresAt = options?.expirationTtl
      ? Date.now() + options.expirationTtl * 1000
      : undefined;
    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

describe('cost-tracker contention/drop behavior', () => {
  it('drops a batch when lock remains held beyond max wait (undercount semantics)', async () => {
    const mod = await import('../functions/cost-tracker/index');
    const worker = mod.default as { queue: (b: any, e: any) => Promise<void> };

    const lockKey = 'lock:weekly_spend_usd';
    const kv = new ControlledKV();
    const env = { BUDGET_KV: kv as any };

    await kv.put('weekly_spend_usd', '0');
    await kv.put(lockKey, 'held-by-other', { expirationTtl: 10 });

    const nowSpy = vi.spyOn(Date, 'now');
    // First call = start time. Subsequent calls force timeout path (>750ms).
    nowSpy.mockReturnValueOnce(0).mockReturnValue(1000);

    await worker.queue({ messages: [{ body: { cost: 5, timestamp: 1 } }] }, env);

    expect(await kv.get('weekly_spend_usd')).toBe('0');
    expect(await kv.get(lockKey)).toBe('held-by-other');

    nowSpy.mockRestore();
  });

  it('partial completion under contention yields undercount equal to dropped batches', async () => {
    const mod = await import('../functions/cost-tracker/index');
    const worker = mod.default as { queue: (b: any, e: any) => Promise<void> };

    let firstLockHolder: string | null = null;
    let releaseFirstLock: (() => void) | undefined;

    const kv = new ControlledKV(async (key, value) => {
      if (key === 'lock:weekly_spend_usd' && firstLockHolder === null) {
        firstLockHolder = value;
        await new Promise<void>((resolve) => {
          releaseFirstLock = resolve;
        });
      }
    });

    const env = { BUDGET_KV: kv as any };

    const nowSpy = vi.spyOn(Date, 'now');
    const timeline = [0, 10, 20, 780, 790, 800, 810, 820, 830, 840, 850, 860];
    nowSpy.mockImplementation(() => timeline.shift() ?? 1000);

    const slowWinner = worker.queue(
      { messages: [{ body: { cost: 3, timestamp: 1 } }] },
      env
    );

    await Promise.resolve();

    const losers = Promise.all([
      worker.queue({ messages: [{ body: { cost: 3, timestamp: 2 } }] }, env),
      worker.queue({ messages: [{ body: { cost: 3, timestamp: 3 } }] }, env),
    ]);

    const release = releaseFirstLock;
    if (typeof release === 'function') {
      release();
    }

    await Promise.all([slowWinner, losers]);

    const spend = parseFloat((await kv.get('weekly_spend_usd')) || '0');
    // 3 batches x $3 submitted, but only one should commit in this forced contention scenario.
    expect(spend).toBe(3);

    nowSpy.mockRestore();
  });
});
