import { describe, expect, it } from 'vitest';
import type { Settings } from '@/lib/types';
import { resolveEntitlements } from '@/lib/entitlement-policy';
import type { RuntimeProfile } from '@/lib/runtime-profile';

type SettingsOverrides = Omit<Partial<Settings>, 'byok' | 'privacy' | 'credits' | 'user' | 'flags' | 'templates'> & {
  byok?: Partial<Settings['byok']>;
  privacy?: Partial<Settings['privacy']>;
  credits?: Partial<NonNullable<Settings['credits']>>;
  user?: Partial<NonNullable<Settings['user']>>;
  flags?: Partial<NonNullable<Settings['flags']>>;
  templates?: Partial<Settings['templates']>;
};

function makeSettings(overrides: SettingsOverrides = {}): Settings {
  const base: Settings = {
    mode: 'ai',
    templates: { bundles: [] },
    byok: {
      provider: 'openrouter',
      apiBase: 'https://openrouter.ai/api/v1',
      apiKey: '',
      model: 'arcee-ai/trinity-large-preview:free',
      selectedByokModel: 'arcee-ai/trinity-large-preview:free',
    },
    privacy: { telemetryEnabled: false },
    isPro: false,
    credits: {
      remaining: 0,
      total: 150,
      lastReset: '2026-01-01T00:00:00.000Z',
    },
    user: { id: 'user_1' },
    flags: {
      aiModeEnabled: true,
      byokEnabled: true,
      trialEnabled: true,
      developerMode: false,
    },
  };
  const baseCredits = base.credits as NonNullable<Settings['credits']>;
  const baseUser = base.user as NonNullable<Settings['user']>;
  const baseFlags = base.flags as NonNullable<Settings['flags']>;

  return {
    ...base,
    ...overrides,
    byok: { ...base.byok, ...(overrides.byok || {}) },
    privacy: { ...base.privacy, ...(overrides.privacy || {}) },
    credits: { ...baseCredits, ...(overrides.credits || {}) },
    user: { ...baseUser, ...(overrides.user || {}) },
    flags: { ...baseFlags, ...(overrides.flags || {}) },
    templates: { ...base.templates, ...(overrides.templates || {}) },
  };
}

function makeProfile(overrides: Partial<RuntimeProfile> = {}): RuntimeProfile {
  return {
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
}

describe('resolveEntitlements', () => {
  it('disables remote credit fetch when open access is enabled', () => {
    const settings = makeSettings();
    const profile = makeProfile({
      openAccessEnabled: true,
      premiumBypassEnabled: false,
      enforceDeveloperMode: false,
      useMockMonetization: false,
    });

    const result = resolveEntitlements(settings, profile);

    expect(result.hasUnlimitedAccess).toBe(true);
    expect(result.isPro).toBe(true);
    expect(result.shouldFetchRemoteCredits).toBe(false);
  });

  it('enables remote credit fetch for production free users', () => {
    const settings = makeSettings({
      isPro: false,
      byok: { apiKey: '' },
      credits: { remaining: 0, total: 150 },
      flags: { developerMode: false },
      user: { id: 'prod_user' },
    });
    const profile = makeProfile({
      isDevelopment: false,
      openAccessEnabled: false,
      premiumBypassEnabled: false,
      enforceDeveloperMode: false,
      useMockMonetization: false,
      monetizationApiBase: 'https://promptready.app',
      byokProxyUrl: 'https://promptready.app/api/proxy',
      trafilaturaServiceUrl: '',
    });

    const result = resolveEntitlements(settings, profile);

    expect(result.hasUnlimitedAccess).toBe(false);
    expect(result.isPro).toBe(false);
    expect(result.shouldFetchRemoteCredits).toBe(true);
  });

  it('treats BYOK users as pro without forcing remote credit fetch', () => {
    const settings = makeSettings({
      byok: { apiKey: 'sk-test' },
      user: { id: 'prod_user' },
      credits: { remaining: 0, total: 150 },
    });
    const profile = makeProfile({
      isDevelopment: false,
      openAccessEnabled: false,
      premiumBypassEnabled: false,
      enforceDeveloperMode: false,
      useMockMonetization: false,
      monetizationApiBase: 'https://promptready.app',
      byokProxyUrl: 'https://promptready.app/api/proxy',
      trafilaturaServiceUrl: '',
    });

    const result = resolveEntitlements(settings, profile);

    expect(result.hasApiKey).toBe(true);
    expect(result.hasUnlimitedAccess).toBe(true);
    expect(result.isPro).toBe(true);
    expect(result.shouldFetchRemoteCredits).toBe(false);
  });
});
