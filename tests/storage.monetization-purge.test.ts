import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', () => ({ browser: (globalThis as any).browser }));

import { Storage } from '@/lib/storage';

const SETTINGS_KEY = 'promptready_settings';

function toLocalDayKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

describe('storage monetization normalization', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
  });

  it('initializes new BYOK monetization defaults for fresh installs', async () => {
    const settings = await Storage.getSettings();

    expect(settings.settingsSchemaVersion).toBe(2);
    expect(settings.byokUnlock).toEqual({
      isUnlocked: false,
      unlockCodeLast4: null,
      unlockedAt: null,
      unlockSchemeVersion: 1,
    });
    expect(settings.byokUsage).toMatchObject({
      dayKey: toLocalDayKey(),
      successfulAiCount: 0,
      inflightRuns: {},
      countedSuccessIds: [],
    });

    const persistedResult = await browser.storage.local.get([SETTINGS_KEY]) as Record<string, any>;
    const persisted = persistedResult[SETTINGS_KEY];
    expect(persisted?.settingsSchemaVersion).toBe(2);
    expect(persisted?.byokUnlock?.isUnlocked).toBe(false);
  });

  it('purges legacy trial/pro/credits fields when loading schema < 2 settings', async () => {
    await browser.storage.local.set({
      [SETTINGS_KEY]: {
        settingsSchemaVersion: 1,
        mode: 'ai',
        byok: {
          provider: 'openrouter',
          apiBase: 'https://openrouter.ai/api/v1',
          apiKey: '',
          selectedByokModel: 'arcee-ai/trinity-large-preview:free',
        },
        privacy: { telemetryEnabled: false },
        isPro: true,
        credits: { remaining: 88, total: 100, lastReset: '2026-02-01T00:00:00.000Z' },
        trial: { hasExhausted: false, showUpgradePrompt: false },
      },
    });

    const settings = await Storage.getSettings();

    expect(settings.settingsSchemaVersion).toBe(2);
    expect(settings.isPro).toBeUndefined();
    expect(settings.credits).toBeUndefined();
    expect(settings.trial).toBeUndefined();

    const persistedResult = await browser.storage.local.get([SETTINGS_KEY]) as Record<string, any>;
    const persisted = persistedResult[SETTINGS_KEY] as Record<string, unknown>;
    expect(persisted.settingsSchemaVersion).toBe(2);
    expect('isPro' in persisted).toBe(false);
    expect('credits' in persisted).toBe(false);
    expect('trial' in persisted).toBe(false);
  });

  it('resets BYOK daily usage bucket on local day rollover', async () => {
    await browser.storage.local.set({
      [SETTINGS_KEY]: {
        settingsSchemaVersion: 2,
        mode: 'ai',
        byok: {
          provider: 'openrouter',
          apiBase: 'https://openrouter.ai/api/v1',
          apiKey: 'sk-test',
          selectedByokModel: 'arcee-ai/trinity-large-preview:free',
        },
        privacy: { telemetryEnabled: false },
        byokUsage: {
          dayKey: '2000-01-01',
          successfulAiCount: 4,
          inflightRuns: {
            run_1: {
              startedAt: Date.now(),
              dayKey: '2000-01-01',
            },
          },
          countedSuccessIds: ['run_1'],
        },
      },
    });

    const settings = await Storage.getSettings();

    expect(settings.byokUsage).toEqual({
      dayKey: toLocalDayKey(),
      successfulAiCount: 0,
      inflightRuns: {},
      countedSuccessIds: [],
    });
  });
});
