import { describe, expect, it } from 'vitest';
import { validateRuntimeProfile, type RuntimeProfile } from '@/lib/runtime-profile';

function makeProfile(overrides: Partial<RuntimeProfile> = {}): RuntimeProfile {
  const profile: RuntimeProfile = {
    isDevelopment: true,
    premiumBypassEnabled: true,
    enforceDeveloperMode: true,
    useMockMonetization: true,
    monetizationApiBase: 'http://127.0.0.1:8788',
    byokProxyUrl: 'http://127.0.0.1:8788/byok/proxy',
    trafilaturaServiceUrl: 'http://127.0.0.1:8089',
    ...overrides,
  };
  return profile;
}

describe('runtime profile validation', () => {
  it('allows development profile and emits no errors', () => {
    const result = validateRuntimeProfile(makeProfile());
    expect(result.errors).toHaveLength(0);
  });

  it('rejects production profiles with development bypasses', () => {
    const result = validateRuntimeProfile(
      makeProfile({
        isDevelopment: false,
      }),
    );
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.join(' ')).toContain('outside development');
  });

  it('rejects production profiles pointing at localhost endpoints', () => {
    const result = validateRuntimeProfile(
      makeProfile({
        isDevelopment: false,
        premiumBypassEnabled: false,
        enforceDeveloperMode: false,
        useMockMonetization: false,
      }),
    );
    expect(result.errors.some((e) => e.includes('localhost'))).toBe(true);
  });
});
