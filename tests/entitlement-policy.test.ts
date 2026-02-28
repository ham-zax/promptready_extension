import { describe, expect, it } from 'vitest';
import type { Settings } from '@/lib/types';
import { resolveEntitlements } from '@/lib/entitlement-policy';
import type { RuntimeProfile } from '@/lib/runtime-profile';

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    mode: 'ai',
    templates: { bundles: [] },
    byok: {
      provider: 'openrouter',
      apiBase: 'https://openrouter.ai/api/v1',
      apiKey: '',
      model: 'arcee-ai/trinity-large-preview:free',
      selectedByokModel: 'arcee-ai/trinity-large-preview:free',
      customPrompt: '',
    },
    byokUnlock: {
      isUnlocked: false,
      unlockCodeLast4: null,
      unlockedAt: null,
      unlockSchemeVersion: 1,
    },
    byokUsage: {
      dayKey: '2026-02-28',
      successfulAiCount: 0,
      inflightRuns: {},
      countedSuccessIds: [],
    },
    privacy: { telemetryEnabled: false },
    flags: {
      aiModeEnabled: true,
      byokEnabled: true,
      trialEnabled: true,
      developerMode: false,
    },
    ...overrides,
  };
}

function toLocalDayKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function makeProfile(overrides: Partial<RuntimeProfile> = {}): RuntimeProfile {
  return {
    isDevelopment: false,
    openAccessEnabled: false,
    premiumBypassEnabled: false,
    enforceDeveloperMode: false,
    useMockMonetization: false,
    monetizationApiBase: 'https://promptready.app',
    byokProxyUrl: 'https://promptready.app/api/proxy',
    trafilaturaServiceUrl: '',
    ...overrides,
  };
}

describe('resolveEntitlements', () => {
  it('locks AI mode when OpenRouter API key is missing', () => {
    const settings = makeSettings({
      byok: {
        provider: 'openrouter',
        apiBase: 'https://openrouter.ai/api/v1',
        apiKey: '',
        model: 'arcee-ai/trinity-large-preview:free',
        selectedByokModel: 'arcee-ai/trinity-large-preview:free',
        customPrompt: '',
      },
    });

    const result = resolveEntitlements(settings, makeProfile());

    expect(result.hasApiKey).toBe(false);
    expect(result.canUseAIMode).toBe(false);
    expect(result.aiLockReason).toBe('missing_api_key');
    expect(result.remainingFreeByokUsesToday).toBe(5);
  });

  it('allows AI mode when key exists and free usage remains', () => {
    const settings = makeSettings({
      byok: {
        provider: 'openrouter',
        apiBase: 'https://openrouter.ai/api/v1',
        apiKey: 'sk-or-v1-test',
        model: 'arcee-ai/trinity-large-preview:free',
        selectedByokModel: 'arcee-ai/trinity-large-preview:free',
        customPrompt: '',
      },
      byokUsage: {
        dayKey: toLocalDayKey(),
        successfulAiCount: 2,
        inflightRuns: {},
        countedSuccessIds: ['run_a', 'run_b'],
      },
    });

    const result = resolveEntitlements(settings, makeProfile());

    expect(result.hasApiKey).toBe(true);
    expect(result.canUseAIMode).toBe(true);
    expect(result.aiLockReason).toBe(null);
    expect(result.remainingFreeByokUsesToday).toBe(3);
    expect(result.remainingFreeByokStartsToday).toBe(3);
  });

  it('blocks AI mode when successful + inflight reaches daily cap', () => {
    const now = Date.now();
    const settings = makeSettings({
      byok: {
        provider: 'openrouter',
        apiBase: 'https://openrouter.ai/api/v1',
        apiKey: 'sk-or-v1-test',
        model: 'arcee-ai/trinity-large-preview:free',
        selectedByokModel: 'arcee-ai/trinity-large-preview:free',
        customPrompt: '',
      },
      byokUsage: {
        dayKey: toLocalDayKey(),
        successfulAiCount: 4,
        inflightRuns: {
          run_1: {
            startedAt: now,
            dayKey: toLocalDayKey(),
          },
        },
        countedSuccessIds: ['run_prev_1', 'run_prev_2', 'run_prev_3', 'run_prev_4'],
      },
    });

    const result = resolveEntitlements(settings, makeProfile());

    expect(result.canUseAIMode).toBe(false);
    expect(result.aiLockReason).toBe('daily_limit_reached');
    expect(result.inflightAiCount).toBe(1);
    expect(result.remainingFreeByokUsesToday).toBe(1);
    expect(result.remainingFreeByokStartsToday).toBe(0);
  });

  it('grants unlimited access when local unlock is active', () => {
    const settings = makeSettings({
      byok: {
        provider: 'openrouter',
        apiBase: 'https://openrouter.ai/api/v1',
        apiKey: 'sk-or-v1-test',
        model: 'arcee-ai/trinity-large-preview:free',
        selectedByokModel: 'arcee-ai/trinity-large-preview:free',
        customPrompt: '',
      },
      byokUnlock: {
        isUnlocked: true,
        unlockCodeLast4: '5A91',
        unlockedAt: '2026-02-28T01:23:45.000Z',
        unlockSchemeVersion: 1,
      },
      byokUsage: {
        dayKey: toLocalDayKey(),
        successfulAiCount: 5,
        inflightRuns: {},
        countedSuccessIds: ['a', 'b', 'c', 'd', 'e'],
      },
    });

    const result = resolveEntitlements(settings, makeProfile());

    expect(result.isUnlocked).toBe(true);
    expect(result.hasUnlimitedAccess).toBe(true);
    expect(result.canUseAIMode).toBe(true);
    expect(result.aiLockReason).toBe(null);
  });

  it('drops stale inflight runs and resets stale day buckets before gating', () => {
    const staleStartedAt = Date.now() - (15 * 60 * 1000);
    const settings = makeSettings({
      byok: {
        provider: 'openrouter',
        apiBase: 'https://openrouter.ai/api/v1',
        apiKey: 'sk-or-v1-test',
        model: 'arcee-ai/trinity-large-preview:free',
        selectedByokModel: 'arcee-ai/trinity-large-preview:free',
        customPrompt: '',
      },
      byokUsage: {
        dayKey: '2000-01-01',
        successfulAiCount: 999,
        inflightRuns: {
          run_old: {
            startedAt: staleStartedAt,
            dayKey: '2000-01-01',
          },
        },
        countedSuccessIds: ['run_old'],
      },
    });

    const result = resolveEntitlements(settings, makeProfile());

    expect(result.usageDayKey).not.toBe('2000-01-01');
    expect(result.successfulAiCountToday).toBe(0);
    expect(result.inflightAiCount).toBe(0);
    expect(result.remainingFreeByokStartsToday).toBe(5);
    expect(result.canUseAIMode).toBe(true);
  });
});
