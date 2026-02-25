import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RuntimeProfile } from '@/lib/runtime-profile';

const getRuntimeProfileMock = vi.fn<[], RuntimeProfile>();

vi.mock('@/lib/runtime-profile', () => ({
  getRuntimeProfile: () => getRuntimeProfileMock(),
}));

import { MonetizationClient } from '@/pro/monetization-client';

function makeProfile(overrides: Partial<RuntimeProfile> = {}): RuntimeProfile {
  return {
    isDevelopment: true,
    openAccessEnabled: true,
    premiumBypassEnabled: true,
    enforceDeveloperMode: true,
    useMockMonetization: false,
    monetizationApiBase: 'http://127.0.0.1:8788',
    byokProxyUrl: 'http://127.0.0.1:8788/byok/proxy',
    trafilaturaServiceUrl: 'http://127.0.0.1:8089',
    ...overrides,
  };
}

describe('MonetizationClient fallback logging', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    getRuntimeProfileMock.mockReturnValue(makeProfile());
  });

  it('suppresses 405 warnings for checkCredits in development-like mode', async () => {
    getRuntimeProfileMock.mockReturnValue(
      makeProfile({
        isDevelopment: true,
        openAccessEnabled: true,
        premiumBypassEnabled: true,
        useMockMonetization: false,
      })
    );

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 405,
    } as Response);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await MonetizationClient.checkCredits('dev-user');

    expect(result.balance).toBeGreaterThan(100000);
    expect(result.weeklyCap).toBeGreaterThan(100000);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('preserves warnings for server errors in production mode', async () => {
    getRuntimeProfileMock.mockReturnValue(
      makeProfile({
        isDevelopment: false,
        openAccessEnabled: false,
        premiumBypassEnabled: false,
        enforceDeveloperMode: false,
        useMockMonetization: false,
        monetizationApiBase: 'https://promptready.app',
        byokProxyUrl: 'https://promptready.app/api/proxy',
        trafilaturaServiceUrl: '',
      })
    );

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await MonetizationClient.checkCredits('prod-user');

    expect(result.balance).toBeGreaterThan(100000);
    expect(result.weeklyCap).toBeGreaterThan(100000);
    expect(warnSpy).toHaveBeenCalledWith('[MonetizationClient] checkCredits returned 500');
  });
});
