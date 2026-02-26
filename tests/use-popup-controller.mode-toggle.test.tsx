import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getUserId: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  checkCredits: vi.fn(),
  getCohort: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  sessionGet: vi.fn(),
  sessionRemove: vi.fn(),
}));

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      onMessage: {
        addListener: mocks.addListener,
        removeListener: mocks.removeListener,
      },
      sendMessage: vi.fn(),
    },
    storage: {
      session: {
        get: mocks.sessionGet,
        remove: mocks.sessionRemove,
      },
    },
    tabs: {
      query: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock('@/lib/user', () => ({
  getUserId: mocks.getUserId,
}));

vi.mock('@/lib/storage', () => ({
  Storage: {
    getSettings: mocks.getSettings,
    updateSettings: mocks.updateSettings,
    setApiKey: vi.fn(),
  },
}));

vi.mock('@/pro/monetization-client', () => ({
  MonetizationClient: {
    checkCredits: mocks.checkCredits,
  },
}));

vi.mock('@/pro/experimentation-client', () => ({
  ExperimentationClient: {
    getCohort: mocks.getCohort,
  },
}));

import { usePopupController } from '@/entrypoints/popup/hooks/usePopupController';

function makeSettings(overrides: Record<string, unknown> = {}) {
  return {
    mode: 'offline',
    byok: {
      provider: 'openrouter',
      apiBase: 'https://openrouter.ai/api/v1',
      apiKey: '',
      model: 'arcee-ai/trinity-large-preview:free',
      selectedByokModel: 'arcee-ai/trinity-large-preview:free',
    },
    credits: {
      remaining: 5,
      total: 5,
      lastReset: '2026-02-25T00:00:00.000Z',
    },
    flags: {
      aiModeEnabled: true,
      byokEnabled: true,
      trialEnabled: true,
      developerMode: false,
    },
    trial: {
      hasExhausted: false,
      showUpgradePrompt: false,
    },
    user: undefined,
    ...overrides,
  };
}

describe('usePopupController mode toggle guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserId.mockResolvedValue(null);
    mocks.checkCredits.mockResolvedValue({ balance: 999999, weeklyCap: 999999 });
    mocks.getCohort.mockResolvedValue(undefined);
    mocks.sessionGet.mockResolvedValue({});
    mocks.sessionRemove.mockResolvedValue(undefined);
    mocks.updateSettings.mockResolvedValue(undefined);
  });

  it('allows switching back to offline even when aiModeEnabled is now false', async () => {
    mocks.getSettings
      .mockResolvedValueOnce(
        makeSettings({
          mode: 'ai',
          flags: {
            aiModeEnabled: true,
            byokEnabled: true,
            trialEnabled: true,
            developerMode: false,
          },
        })
      )
      .mockResolvedValueOnce(
        makeSettings({
          mode: 'ai',
          flags: {
            aiModeEnabled: false,
            byokEnabled: true,
            trialEnabled: true,
            developerMode: false,
          },
        })
      );

    const { result } = renderHook(() => usePopupController());

    await waitFor(() => {
      expect(result.current.state.mode).toBe('ai');
    });

    await act(async () => {
      await result.current.handleModeToggle();
    });

    expect(mocks.updateSettings).toHaveBeenLastCalledWith({ mode: 'offline' });
  });

  it('still blocks switching into ai mode when aiModeEnabled is false', async () => {
    mocks.getSettings
      .mockResolvedValueOnce(
        makeSettings({
          mode: 'offline',
          flags: {
            aiModeEnabled: false,
            byokEnabled: true,
            trialEnabled: true,
            developerMode: false,
          },
        })
      )
      .mockResolvedValueOnce(
        makeSettings({
          mode: 'offline',
          flags: {
            aiModeEnabled: false,
            byokEnabled: true,
            trialEnabled: true,
            developerMode: false,
          },
        })
      );

    const { result } = renderHook(() => usePopupController());

    await waitFor(() => {
      expect(result.current.state.mode).toBe('offline');
    });

    await act(async () => {
      await result.current.handleModeToggle();
    });

    expect(mocks.updateSettings).not.toHaveBeenCalledWith({ mode: 'ai' });
  });

  it('ignores PROCESSING_ERROR when fallbackUsed=true', async () => {
    let runtimeListener: ((message: any) => void) | undefined;
    mocks.addListener.mockImplementation((listener: any) => {
      runtimeListener = listener;
    });

    mocks.getSettings.mockResolvedValue(makeSettings());

    const { result } = renderHook(() => usePopupController());

    await waitFor(() => {
      expect(result.current.state.processing.status).toBe('idle');
    });

    act(() => {
      runtimeListener?.({
        type: 'PROCESSING_ERROR',
        payload: { error: 'AI request failed', fallbackUsed: true },
      });
    });

    expect(result.current.state.processing.status).toBe('idle');
  });
});
