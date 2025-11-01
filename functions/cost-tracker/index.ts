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
    let totalCost = 0;
    for (const message of batch.messages) {
      totalCost += message.body.cost;
    }
    const currentSpend = await env.BUDGET_KV.get('weekly_spend_usd') || '0';
    const newSpend = parseFloat(currentSpend) + totalCost;
    await env.BUDGET_KV.put('weekly_spend_usd', newSpend.toString());
  }
}