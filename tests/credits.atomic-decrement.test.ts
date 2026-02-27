import { describe, expect, it, vi } from "vitest";
import creditWorker from "../functions/credit-service/index";
import aiProxyWorker from "../functions/ai-proxy/index";

const USER_ID = "00000000-0000-4000-8000-000000000000";

class InMemoryKV {
  private store = new Map<string, string>();
  async get(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  async put(key: string, value: string) {
    this.store.set(key, value);
  }
  async delete(key: string) {
    this.store.delete(key);
  }
}

class DeterministicKV {
  private store = new Map<string, string>();
  private readonly postReadHooks = new Map<string, Array<() => Promise<void>>>();

  constructor(seed?: Record<string, string>) {
    if (seed) {
      for (const [k, v] of Object.entries(seed)) this.store.set(k, v);
    }
  }

  schedulePostRead(key: string, hook: () => Promise<void> | void) {
    const q = this.postReadHooks.get(key) ?? [];
    q.push(async () => {
      await hook();
    });
    this.postReadHooks.set(key, q);
  }

  async get(key: string) {
    const value = this.store.has(key) ? this.store.get(key)! : null;
    const q = this.postReadHooks.get(key);
    if (q && q.length > 0) {
      const hook = q.shift()!;
      await hook();
      if (q.length === 0) this.postReadHooks.delete(key);
    }
    return value;
  }

  async put(key: string, value: string) {
    this.store.set(key, value);
  }

  async delete(key: string) {
    this.store.delete(key);
  }
}

const baseHeaders = {
  "Content-Type": "application/json",
  Authorization: "Bearer s",
};

function decrementRequest(body: Record<string, unknown>) {
  return new Request("http://worker.test/credits/decrement", {
    method: "POST",
    headers: baseHeaders,
    body: JSON.stringify(body),
  });
}

describe("economic controls (atomic decrement + idempotency)", () => {
  it("credit-service /credits/decrement is idempotent (same idempotencyKey does not double-charge)", async () => {
    const kv = new InMemoryKV() as any;
    const env = { CREDITS_KV: kv, SERVICE_SECRET: "s" } as any;

    // seed user
    await kv.put(USER_ID, "2");

    const req1 = decrementRequest({
      userId: USER_ID,
      amount: 1,
      idempotencyKey: "k1",
    });

    const res1 = await creditWorker.fetch(req1, env, {} as any);
    expect(res1.status).toBe(200);
    const body1 = (await res1.json()) as any;
    expect(body1.balance).toBe(1);

    const req2 = decrementRequest({
      userId: USER_ID,
      amount: 1,
      idempotencyKey: "k1",
    });

    const res2 = await creditWorker.fetch(req2, env, {} as any);
    expect(res2.status).toBe(200);
    const body2 = (await res2.json()) as any;
    expect(body2.balance).toBe(1);

    expect(await kv.get(USER_ID)).toBe("1");
  });

  it("serializes same-user parallel decrements (no lost update)", async () => {
    const kv = new DeterministicKV({ [USER_ID]: "2" }) as any;
    const env = { CREDITS_KV: kv, SERVICE_SECRET: "s" } as any;

    const [res1, res2] = await Promise.all([
      creditWorker.fetch(decrementRequest({ userId: USER_ID, amount: 1 }), env, {} as any),
      creditWorker.fetch(decrementRequest({ userId: USER_ID, amount: 1 }), env, {} as any),
    ]);

    expect([res1.status, res2.status].sort()).toEqual([200, 200]);
    const b1 = (await res1.json()) as any;
    const b2 = (await res2.json()) as any;
    expect([b1.balance, b2.balance].sort((a: number, b: number) => a - b)).toEqual([0, 1]);
    expect(await kv.get(USER_ID)).toBe("0");
  });

  it("deduplicates concurrent duplicate idempotency keys", async () => {
    const kv = new DeterministicKV({ [USER_ID]: "3" }) as any;
    const env = { CREDITS_KV: kv, SERVICE_SECRET: "s" } as any;

    const [res1, res2] = await Promise.all([
      creditWorker.fetch(
        decrementRequest({ userId: USER_ID, amount: 1, idempotencyKey: "dup-k" }),
        env,
        {} as any,
      ),
      creditWorker.fetch(
        decrementRequest({ userId: USER_ID, amount: 1, idempotencyKey: "dup-k" }),
        env,
        {} as any,
      ),
    ]);

    expect([res1.status, res2.status]).toEqual([200, 200]);
    const b1 = (await res1.json()) as any;
    const b2 = (await res2.json()) as any;
    expect(b1.balance).toBe(2);
    expect(b2.balance).toBe(2);
    expect(await kv.get(USER_ID)).toBe("2");
    expect(await kv.get(`idem:${USER_ID}:dup-k`)).toBe("2");
  });

  it("returns 409 when lock is continuously contended past timeout", async () => {
    const kv = new DeterministicKV({
      [USER_ID]: "5",
      [`lock:${USER_ID}`]: "held-by-other",
    }) as any;
    const env = { CREDITS_KV: kv, SERVICE_SECRET: "s" } as any;

    vi.useFakeTimers();
    const nowSpy = vi.spyOn(Date, "now");
    let now = 0;
    nowSpy.mockImplementation(() => now);

    const req = decrementRequest({ userId: USER_ID, amount: 1 });
    const pending = creditWorker.fetch(req, env, {} as any);

    for (let i = 0; i < 200; i++) {
      now += 20;
      await vi.advanceTimersByTimeAsync(20);
    }

    const res = await pending;
    expect(res.status).toBe(409);
    expect(await kv.get(USER_ID)).toBe("5");

    nowSpy.mockRestore();
    vi.useRealTimers();
  });

  it("demonstrates crash-window limitation: idem write after debit can double-charge on retry", async () => {
    const kv = new DeterministicKV({ [USER_ID]: "3" });
    let crashed = false;
    const originalPut = kv.put.bind(kv);
    kv.put = (async (key: string, value: string) => {
      await originalPut(key, value);
      if (key === USER_ID && !crashed) {
        crashed = true;
        throw new Error("simulated crash after debit write");
      }
    }) as any;

    const env = { CREDITS_KV: kv as any, SERVICE_SECRET: "s" } as any;

    const first = await creditWorker.fetch(
      decrementRequest({ userId: USER_ID, amount: 1, idempotencyKey: "crash-k" }),
      env,
      {} as any,
    );
    expect(first.status).toBe(500);
    expect(await kv.get(USER_ID)).toBe("2");
    expect(await kv.get(`idem:${USER_ID}:crash-k`)).toBeNull();

    const retry = await creditWorker.fetch(
      decrementRequest({ userId: USER_ID, amount: 1, idempotencyKey: "crash-k" }),
      env,
      {} as any,
    );
    expect(retry.status).toBe(200);
    const retryBody = (await retry.json()) as any;
    expect(retryBody.balance).toBe(1);
    expect(await kv.get(USER_ID)).toBe("1");
  });

  it("ai-proxy reserves credits before calling upstream AI (no free calls)", async () => {
    const creditFetch = vi.fn(async (input: any, init?: RequestInit) => {
      const req = input instanceof Request ? input : new Request(String(input), init);
      const url = new URL(req.url);
      if (url.pathname === "/credits/decrement") {
        return new Response(JSON.stringify({ userId: "pr_u1_test_1234567890", balance: 0 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("not found", { status: 404 });
    });

    const mem = new Map<string, { value: string; expiresAt: number }>();
    const kv = {
      async get(key: string) {
        const v = mem.get(key);
        if (!v) return null;
        if (Date.now() > v.expiresAt) {
          mem.delete(key);
          return null;
        }
        return v.value;
      },
      async put(key: string, value: string, opts?: { expirationTtl?: number }) {
        const ttl = opts?.expirationTtl ?? 60;
        mem.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
      },
    } as any;

    const env = {
      CREDITS_KV: {} as any,
      BUDGET_KV: kv,
      AI_API_KEY: "k",
      SERVICE_SECRET: "s",
      costTrackingQueue: {} as any,
      CREDIT_SERVICE: { fetch: creditFetch } as any,
      ALLOWED_ORIGINS: "",
    } as any;

    const upstreamFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const originalFetch = global.fetch;
    global.fetch = upstreamFetch as any;

    const req = new Request("https://worker.test/", {
      method: "POST",
      headers: {
        Origin: "http://localhost:5173",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: "pr_u1_test_1234567890", content: "hi" }),
    });

    const ctx = { waitUntil: vi.fn() } as any;

    const res = await aiProxyWorker.fetch(req, env, ctx);
    expect(res.status).toBe(200);

    // decrement must happen before upstream call
    expect(creditFetch).toHaveBeenCalledTimes(1);
    expect(upstreamFetch).toHaveBeenCalledTimes(1);

    const creditCallIndex = (creditFetch.mock.invocationCallOrder?.[0] ?? 0) as number;
    const upstreamCallIndex = (upstreamFetch.mock.invocationCallOrder?.[0] ?? 0) as number;
    expect(creditCallIndex).toBeLessThan(upstreamCallIndex);

    global.fetch = originalFetch;
  });
});
