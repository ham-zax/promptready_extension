import { describe, expect, it } from 'vitest';
import { detectRuntimeDevelopment, validateRuntimeProfile, type RuntimeProfile } from '@/lib/runtime-profile';

function makeProfile(overrides: Partial<RuntimeProfile> = {}): RuntimeProfile {
  const profile: RuntimeProfile = {
    isDevelopment: true,
    openAccessEnabled: true,
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
  it('treats development mode as development when no explicit env override exists', () => {
    const result = detectRuntimeDevelopment({
      envDev: false,
      envMode: 'development',
      hasHotReload: false,
    });
    expect(result).toBe(true);
  });

  it('keeps production false when no development signals exist', () => {
    const result = detectRuntimeDevelopment({
      envDev: false,
      envMode: 'production',
      hasHotReload: false,
    });
    expect(result).toBe(false);
  });

  it('respects explicit runtime override even if local dev signals are present', () => {
    const result = detectRuntimeDevelopment({
      explicit: false,
      envDev: true,
      envMode: 'development',
      hasHotReload: true,
    });
    expect(result).toBe(false);
  });

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

  it('rejects production profiles with open access enabled', () => {
    const result = validateRuntimeProfile(
      makeProfile({
        isDevelopment: false,
        premiumBypassEnabled: false,
        enforceDeveloperMode: false,
        useMockMonetization: false,
      }),
    );
    expect(result.errors.some((e) => e.includes('openAccessEnabled'))).toBe(true);
  });

  it('rejects production profiles pointing at localhost endpoints', () => {
    const result = validateRuntimeProfile(
      makeProfile({
        isDevelopment: false,
        openAccessEnabled: false,
        premiumBypassEnabled: false,
        enforceDeveloperMode: false,
        useMockMonetization: false,
      }),
    );
    expect(result.errors.some((e) => e.includes('localhost'))).toBe(true);
  });

  it('warns when open access is disabled in development', () => {
    const result = validateRuntimeProfile(
      makeProfile({
        openAccessEnabled: false,
      }),
    );
    expect(result.warnings.some((w) => w.includes('openAccessEnabled is off in development'))).toBe(true);
  });
});
