
/// <reference types="@cloudflare/workers-types" />

export interface Env {
  // This binding is provided by Cloudflare and holds our key-value store.
  BUDGET_KV: KVNamespace;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    try {
      // 1. Get the current weekly spend and the weekly cap from the KV store.
      const weeklySpendStr = await env.BUDGET_KV.get('weekly_spend_usd');
      const weeklyCapStr = await env.BUDGET_KV.get('weekly_cap_usd');

      const weeklySpend = weeklySpendStr ? parseFloat(weeklySpendStr) : 0;
      const weeklyCap = weeklyCapStr ? parseFloat(weeklyCapStr) : 100; // Default to $100 as a safeguard

      // 2. Check if the spend exceeds the cap.
      if (weeklySpend >= weeklyCap) {
        // If the circuit breaker is tripped, return a "Service Unavailable" response.
        // This prevents any further calls to the AI service.
        return new Response(
          JSON.stringify({
            status: 'SERVICE_AT_CAPACITY',
            error: 'The free trial is temporarily unavailable due to high demand. Please try again later.',
          }),
          {
            status: 503, // Service Unavailable
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // 3. If the budget is not exceeded, for now, we'll just return a success message.
      // In the future, this would chain to the actual AI proxy logic.
      return new Response(
        JSON.stringify({
          status: 'OK',
          message: 'Budget check passed. Request would be processed.',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );

    } catch (error) {
      console.error('Error in circuit breaker:', error);
      return new Response(
        JSON.stringify({
          status: 'INTERNAL_SERVER_ERROR',
          error: 'An unexpected error occurred.',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  },
};
