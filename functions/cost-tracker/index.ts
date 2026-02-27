// New file: functions/cost-tracker/index.ts
/// <reference types="@cloudflare/workers-types" />

interface Env {
  BUDGET_KV: KVNamespace;
}

interface CostData {
  cost: number;
  timestamp: number;
}

export default {
  async queue(batch: MessageBatch<CostData>, env: Env) {
    // Validate + aggregate costs for this batch.
    let totalCost = 0;
    for (const message of batch.messages) {
      const cost = message.body?.cost;
      if (typeof cost !== 'number' || !Number.isFinite(cost) || cost < 0) {
        // Skip invalid data rather than poisoning the spend total.
        continue;
      }
      totalCost += cost;
    }

    if (totalCost === 0) return;

    // KV is not atomic for read-modify-write. Serialize updates using a KV lock.
    const spendKey = 'weekly_spend_usd';
    const lockKey = 'lock:weekly_spend_usd';
    const lockId = crypto.randomUUID();
    const lockTtlSeconds = 10;
    const maxWaitMs = 750;
    const start = Date.now();

    while (true) {
      const currentLock = await env.BUDGET_KV.get(lockKey);
      if (currentLock === null) {
        await env.BUDGET_KV.put(lockKey, lockId, { expirationTtl: lockTtlSeconds });
        const confirmed = await env.BUDGET_KV.get(lockKey);
        if (confirmed === lockId) break;
      }
      if (Date.now() - start > maxWaitMs) {
        // Best-effort: drop this batch's write rather than corrupting totals.
        return;
      }
      await new Promise((r) => setTimeout(r, 15));
    }

    try {
      const currentSpendStr = (await env.BUDGET_KV.get(spendKey)) || '0';
      const currentSpend = parseFloat(currentSpendStr);
      const safeCurrentSpend = Number.isFinite(currentSpend) ? currentSpend : 0;
      const newSpend = safeCurrentSpend + totalCost;
      await env.BUDGET_KV.put(spendKey, newSpend.toString());
    } finally {
      const confirmed = await env.BUDGET_KV.get(lockKey);
      if (confirmed === lockId) {
        await (env.BUDGET_KV as any).delete?.(lockKey);
      }
    }
  },
};
