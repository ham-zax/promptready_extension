import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import Popup from '@/entrypoints/popup/Popup';

const mocks = vi.hoisted(() => ({
  usePopupController: vi.fn(),
  useByokManager: vi.fn(),
  useToastManager: vi.fn(),
}));

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      sendMessage: vi.fn(),
    },
    tabs: {
      query: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

vi.mock('@/lib/storage', () => ({
  Storage: {
    getSettings: vi.fn().mockResolvedValue({
      mode: 'ai',
      templates: { bundles: [] },
      byok: {
        provider: 'openrouter',
        apiBase: 'https://openrouter.ai/api/v1',
        apiKey: 'sk-or-v1-test',
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
        successfulAiCount: 2,
        inflightRuns: {},
        countedSuccessIds: ['run_a', 'run_b'],
      },
      privacy: { telemetryEnabled: false },
      ui: {
        theme: 'auto',
        animations: false,
        compactMode: false,
        keepPopupOpen: true,
        autoCloseDelay: 3000,
      },
      flags: {
        aiModeEnabled: true,
        byokEnabled: true,
        trialEnabled: true,
        developerMode: false,
      },
    }),
    updateSettings: vi.fn(),
  },
}));

vi.mock('@/entrypoints/popup/hooks/usePopupController', () => ({
  usePopupController: () => mocks.usePopupController(),
}));

vi.mock('@/entrypoints/popup/hooks/useByokManager', () => ({
  useByokManager: () => mocks.useByokManager(),
}));

vi.mock('@/entrypoints/popup/hooks/useToastManager', () => ({
  useToastManager: () => mocks.useToastManager(),
}));

vi.mock('@/entrypoints/popup/components/UnifiedSettings', () => ({
  UnifiedSettings: () => <div>settings</div>,
}));

vi.mock('@/entrypoints/popup/components/ToastContainer', () => ({
  ToastContainer: () => null,
}));

vi.mock('@/entrypoints/popup/components/LoadingOverlay', () => ({
  LoadingOverlay: () => null,
}));

describe('Popup runtime copy', () => {
  it('does not render legacy credits/trial/pro-upgrade copy', () => {
    mocks.usePopupController.mockReturnValue({
      state: {
        mode: 'ai',
        settings: {
          mode: 'ai',
          templates: { bundles: [] },
          byok: {
            provider: 'openrouter',
            apiBase: 'https://openrouter.ai/api/v1',
            apiKey: 'sk-or-v1-test',
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
            successfulAiCount: 2,
            inflightRuns: {},
            countedSuccessIds: ['run_a', 'run_b'],
          },
          privacy: { telemetryEnabled: false },
          ui: {
            theme: 'auto',
            animations: false,
            compactMode: false,
            keepPopupOpen: true,
            autoCloseDelay: 3000,
          },
          flags: {
            aiModeEnabled: true,
            byokEnabled: true,
            trialEnabled: true,
            developerMode: false,
          },
        },
        hasApiKey: true,
        isUnlocked: false,
        canUseAIMode: true,
        aiLockReason: null,
        remainingFreeByokUsesToday: 3,
        remainingFreeByokStartsToday: 3,
        processing: { status: 'idle' },
        exportData: null,
        toast: null,
      },
      isProcessing: false,
      hasContent: false,
      handleModeToggle: vi.fn(),
      handleCapture: vi.fn(),
      handleCopy: vi.fn(),
      handleExport: vi.fn(),
      onSettingsChange: vi.fn(),
    });

    mocks.useByokManager.mockReturnValue({ hasApiKey: true });
    mocks.useToastManager.mockReturnValue({
      toasts: [],
      hideToast: vi.fn(),
      showSuccess: vi.fn(),
      showError: vi.fn(),
      showWarning: vi.fn(),
      showInfo: vi.fn(),
    });

    const { container } = render(<Popup />);
    const text = container.textContent?.toLowerCase() || '';

    expect(text).not.toContain('out of credits');
    expect(text).not.toContain('start free trial');
    expect(text).not.toContain('pro upgrade');
    expect(text).not.toContain('upgrade to pro');
  });
});
