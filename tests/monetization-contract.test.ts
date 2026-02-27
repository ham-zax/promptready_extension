import { describe, expect, it } from 'vitest';

/**
 * Contract test: /user/status response shape as consumed by the extension.
 * Canonical shape for the UI is { balance, weeklyCap }.
 * We also accept legacy { creditsRemaining } for backward compatibility.
 */

describe('monetization contract: /user/status', () => {
  it('maps credit-service shape { creditsRemaining } into UI shape { balance, weeklyCap }', () => {
    const creditServicePayload = {
      userId: '00000000-0000-4000-8000-000000000000',
      creditsRemaining: 123,
    };

    // Minimal mapping logic (mirrors MonetizationClient.checkCredits)
    const mapped = {
      balance:
        typeof (creditServicePayload as any).balance === 'number'
          ? (creditServicePayload as any).balance
          : typeof (creditServicePayload as any).creditsRemaining === 'number'
            ? (creditServicePayload as any).creditsRemaining
            : 0,
      weeklyCap: 999999,
    };

    expect(mapped).toEqual({ balance: 123, weeklyCap: 999999 });
  });

  it('accepts canonical ai-proxy shape { balance, weeklyCap } without losing information', () => {
    const aiProxyPayload = {
      userId: '00000000-0000-4000-8000-000000000000',
      balance: 50,
      weeklyCap: 150,
    };

    const mapped = {
      balance:
        typeof (aiProxyPayload as any).balance === 'number'
          ? (aiProxyPayload as any).balance
          : typeof (aiProxyPayload as any).creditsRemaining === 'number'
            ? (aiProxyPayload as any).creditsRemaining
            : 0,
      weeklyCap:
        typeof (aiProxyPayload as any).weeklyCap === 'number' ? (aiProxyPayload as any).weeklyCap : 999999,
    };

    expect(mapped).toEqual({ balance: 50, weeklyCap: 150 });
  });
});
