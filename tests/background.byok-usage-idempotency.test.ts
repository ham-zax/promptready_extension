import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Storage } from '@/lib/storage';

vi.mock('wxt/browser', () => ({
  browser: {},
}));

vi.mock('@/lib/runtime-profile', () => ({
  getRuntimeProfile: () => ({
    isDevelopment: false,
    openAccessEnabled: false,
    premiumBypassEnabled: false,
    enforceDeveloperMode: false,
    useMockMonetization: false,
    monetizationApiBase: 'https://promptready.app',
    byokProxyUrl: 'https://promptready.app/api/proxy',
    trafilaturaServiceUrl: '',
  }),
  validateRuntimeProfile: () => ({ warnings: [], errors: [] }),
  assertRuntimeProfileSafe: () => undefined,
}));

function toLocalDayKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

describe('background BYOK usage idempotency', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('defineBackground', (setup: unknown) => setup);
  });

  it('counts successful runId once and releases inflight reservation deterministically', async () => {
    const { EnhancedContentProcessor } = await import('@/entrypoints/background');

    const processor = Object.create((EnhancedContentProcessor as any).prototype) as any;
    Object.assign(processor, {
      usageWriteQueue: Promise.resolve(),
      BYOK_STALE_INFLIGHT_TIMEOUT_MS: 10 * 60 * 1000,
      COUNTED_SUCCESS_RING_SIZE: 20,
    });

    const dayKey = toLocalDayKey();

    let persistedSettings: any = {
      mode: 'ai',
      templates: { bundles: [] },
      byok: {
        provider: 'openrouter',
        apiBase: 'https://openrouter.ai/api/v1',
        apiKey: 'sk-or-v1-test',
        selectedByokModel: 'arcee-ai/trinity-large-preview:free',
      },
      byokUnlock: {
        isUnlocked: false,
        unlockCodeLast4: null,
        unlockedAt: null,
        unlockSchemeVersion: 1,
      },
      byokUsage: {
        dayKey,
        successfulAiCount: 0,
        inflightRuns: {
          run_1: {
            startedAt: Date.now(),
            dayKey,
          },
        },
        countedSuccessIds: [],
      },
      privacy: { telemetryEnabled: false },
      flags: {
        aiModeEnabled: true,
        byokEnabled: true,
        trialEnabled: true,
        developerMode: false,
      },
    };

    vi.spyOn(Storage, 'getSettings').mockImplementation(async () => JSON.parse(JSON.stringify(persistedSettings)));
    vi.spyOn(Storage, 'updateSettings').mockImplementation(async (updates: any) => {
      if (updates.byokUsage) {
        persistedSettings = {
          ...persistedSettings,
          byokUsage: updates.byokUsage,
        };
      }
    });

    await processor.settleAiRunCompletion('run_1', 'success');
    await processor.settleAiRunCompletion('run_1', 'success');

    expect(persistedSettings.byokUsage.successfulAiCount).toBe(1);
    expect(persistedSettings.byokUsage.inflightRuns.run_1).toBeUndefined();
    expect(persistedSettings.byokUsage.countedSuccessIds).toEqual(['run_1']);
  });

  it('blocks new reservation when successful+inflight reaches the daily gate', async () => {
    const { EnhancedContentProcessor } = await import('@/entrypoints/background');

    const processor = Object.create((EnhancedContentProcessor as any).prototype) as any;
    Object.assign(processor, {
      usageWriteQueue: Promise.resolve(),
      BYOK_STALE_INFLIGHT_TIMEOUT_MS: 10 * 60 * 1000,
      COUNTED_SUCCESS_RING_SIZE: 20,
    });

    const dayKey = toLocalDayKey();

    let persistedSettings: any = {
      mode: 'ai',
      templates: { bundles: [] },
      byok: {
        provider: 'openrouter',
        apiBase: 'https://openrouter.ai/api/v1',
        apiKey: 'sk-or-v1-test',
        selectedByokModel: 'arcee-ai/trinity-large-preview:free',
      },
      byokUnlock: {
        isUnlocked: false,
        unlockCodeLast4: null,
        unlockedAt: null,
        unlockSchemeVersion: 1,
      },
      byokUsage: {
        dayKey,
        successfulAiCount: 4,
        inflightRuns: {
          run_existing: {
            startedAt: Date.now(),
            dayKey,
          },
        },
        countedSuccessIds: ['run_a', 'run_b', 'run_c', 'run_d'],
      },
      privacy: { telemetryEnabled: false },
      flags: {
        aiModeEnabled: true,
        byokEnabled: true,
        trialEnabled: true,
        developerMode: false,
      },
    };

    vi.spyOn(Storage, 'getSettings').mockImplementation(async () => JSON.parse(JSON.stringify(persistedSettings)));
    vi.spyOn(Storage, 'updateSettings').mockImplementation(async (updates: any) => {
      if (updates.byokUsage) {
        persistedSettings = {
          ...persistedSettings,
          byokUsage: updates.byokUsage,
        };
      }
    });

    const reservation = await processor.reserveAiRunSlot(persistedSettings, 'run_new');

    expect(reservation.canUseAIMode).toBe(false);
    expect(reservation.lockReason).toBe('daily_limit_reached');
    expect(reservation.fallbackCode).toBe('ai_fallback:daily_limit_reached');
    expect(persistedSettings.byokUsage.inflightRuns.run_new).toBeUndefined();
  });
});
