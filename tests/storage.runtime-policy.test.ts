import { describe, expect, it } from 'vitest';
import type { RuntimeProfile } from '@/lib/runtime-profile';
import { applyRuntimePolicyOverrides } from '@/lib/storage';
import type { Settings } from '@/lib/types';

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    mode: 'offline',
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
    flags: {
      aiModeEnabled: true,
      byokEnabled: true,
      trialEnabled: true,
      developerMode: false,
    },
    credits: {
      remaining: 10,
      total: 10,
      lastReset: '2026-02-25T00:00:00.000Z',
    },
    ...overrides,
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

describe('applyRuntimePolicyOverrides', () => {
  it('preserves user-selected offline mode in development open-access profile', () => {
    const settings = makeSettings({ mode: 'offline' });
    const profile = makeProfile({
      openAccessEnabled: true,
      premiumBypassEnabled: true,
      enforceDeveloperMode: true,
      useMockMonetization: true,
    });

    const result = applyRuntimePolicyOverrides(settings, profile, settings);

    expect(result.mode).toBe('offline');
    expect(result.flags?.developerMode).toBe(true);
    expect(result.byokUnlock?.isUnlocked).toBe(false);
    expect(result.byokUsage?.dayKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('is a no-op when no runtime dev overrides are enabled', () => {
    const settings = makeSettings({ mode: 'ai', isPro: false });
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

    const result = applyRuntimePolicyOverrides(settings, profile, settings);

    expect(result).toEqual(settings);
  });
});
