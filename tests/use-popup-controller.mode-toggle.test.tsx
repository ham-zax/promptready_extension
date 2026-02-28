import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  setApiKey: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  runtimeSendMessage: vi.fn(),
  sessionGet: vi.fn(),
  sessionRemove: vi.fn(),
  tabsQuery: vi.fn(),
}));

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      onMessage: {
        addListener: mocks.addListener,
        removeListener: mocks.removeListener,
      },
      sendMessage: mocks.runtimeSendMessage,
    },
    storage: {
      session: {
        get: mocks.sessionGet,
        remove: mocks.sessionRemove,
      },
    },
    tabs: {
      query: mocks.tabsQuery,
    },
  },
}));

vi.mock('@/lib/storage', () => ({
  Storage: {
    getSettings: mocks.getSettings,
    updateSettings: mocks.updateSettings,
    setApiKey: mocks.setApiKey,
  },
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
}));

import { usePopupController } from '@/entrypoints/popup/hooks/usePopupController';

function toLocalDayKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function makeSettings(overrides: Record<string, unknown> = {}) {
  return {
    mode: 'offline',
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
      dayKey: toLocalDayKey(),
      successfulAiCount: 0,
      inflightRuns: {},
      countedSuccessIds: [],
    },
    flags: {
      aiModeEnabled: true,
      byokEnabled: true,
      trialEnabled: true,
      developerMode: false,
    },
    privacy: { telemetryEnabled: false },
    ui: {
      theme: 'auto',
      animations: true,
      compactMode: false,
      keepPopupOpen: true,
      autoCloseDelay: 3000,
    },
    ...overrides,
  };
}

describe('usePopupController mode toggle guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runtimeSendMessage.mockResolvedValue(undefined);
    mocks.sessionGet.mockResolvedValue({});
    mocks.sessionRemove.mockResolvedValue(undefined);
    mocks.updateSettings.mockResolvedValue(undefined);
    mocks.setApiKey.mockResolvedValue(undefined);
    mocks.tabsQuery.mockResolvedValue([]);
  });

  it('allows switching back to offline even when aiModeEnabled is now false', async () => {
    mocks.getSettings
      .mockResolvedValueOnce(
        makeSettings({
          mode: 'ai',
          byok: {
            provider: 'openrouter',
            apiBase: 'https://openrouter.ai/api/v1',
            apiKey: 'sk-or-v1-test',
            model: 'arcee-ai/trinity-large-preview:free',
            selectedByokModel: 'arcee-ai/trinity-large-preview:free',
            customPrompt: '',
          },
        })
      )
      .mockResolvedValue(
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

    expect(mocks.updateSettings).toHaveBeenCalledWith({ mode: 'offline' });
  });

  it('blocks switching into ai mode when AI feature flag is disabled', async () => {
    mocks.getSettings.mockResolvedValue(
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
    expect(result.current.state.toast?.type).toBe('info');
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

  it('does not auto-copy when PROCESSING_COMPLETE is received', async () => {
    let runtimeListener: ((message: any) => void) | undefined;
    mocks.addListener.mockImplementation((listener: any) => {
      runtimeListener = listener;
    });

    mocks.getSettings.mockResolvedValue(makeSettings());
    const { result } = renderHook(() => usePopupController());

    await waitFor(() => {
      expect(result.current.state.processing.status).toBe('idle');
    });

    mocks.runtimeSendMessage.mockClear();

    act(() => {
      runtimeListener?.({
        type: 'PROCESSING_COMPLETE',
        payload: {
          exportMd: '# Done',
          exportJson: { version: '1.0' },
          metadata: { title: 'Done', url: 'https://example.com' },
          aiOutcome: 'success',
        },
      });
    });

    expect(mocks.runtimeSendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'EXPORT_REQUEST' }),
    );
  });

  it('shows warning toast when AI falls back to offline output', async () => {
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
        type: 'PROCESSING_COMPLETE',
        payload: {
          exportMd: '# Done',
          exportJson: { version: '1.0' },
          metadata: { title: 'Done', url: 'https://example.com' },
          aiOutcome: 'fallback_request_failed',
        },
      });
    });

    expect(result.current.state.toast?.type).toBe('warning');
  });

  it('shows warning toast when daily limit fallback is received', async () => {
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
        type: 'PROCESSING_COMPLETE',
        payload: {
          exportMd: '# Done',
          exportJson: { version: '1.0' },
          metadata: { title: 'Done', url: 'https://example.com' },
          aiOutcome: 'fallback_daily_limit_reached',
        },
      });
    });

    expect(result.current.state.toast?.type).toBe('warning');
  });

  it('copies directly from popup clipboard before background fallback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    mocks.getSettings.mockResolvedValue(makeSettings());
    const { result } = renderHook(() => usePopupController());

    await waitFor(() => {
      expect(result.current.state.processing.status).toBe('idle');
    });

    mocks.runtimeSendMessage.mockClear();

    await act(async () => {
      await result.current.handleCopy('hello world');
    });

    expect(writeText).toHaveBeenCalledWith('hello world');
    expect(mocks.runtimeSendMessage).not.toHaveBeenCalled();
  });
});
