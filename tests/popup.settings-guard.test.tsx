import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Popup from '@/entrypoints/popup/Popup';

const mocks = vi.hoisted(() => ({
  usePopupController: vi.fn(),
  useByokManager: vi.fn(),
  useProManager: vi.fn(),
  useToastManager: vi.fn(),
  runtimeAddListener: vi.fn(),
  runtimeRemoveListener: vi.fn(),
  runtimeSendMessage: vi.fn(),
  tabsQuery: vi.fn(),
}));

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      onMessage: {
        addListener: mocks.runtimeAddListener,
        removeListener: mocks.runtimeRemoveListener,
      },
      sendMessage: mocks.runtimeSendMessage,
    },
    tabs: {
      query: mocks.tabsQuery,
    },
  },
}));

vi.mock('@/lib/storage', () => ({
  Storage: {
    getSettings: vi.fn().mockResolvedValue({
      mode: 'offline',
      templates: { bundles: [] },
      byok: {
        provider: 'openrouter',
        apiBase: 'https://openrouter.ai/api/v1',
        apiKey: '',
        selectedByokModel: 'arcee-ai/trinity-large-preview:free',
      },
      privacy: { telemetryEnabled: false },
      ui: {
        theme: 'auto',
        animations: true,
        compactMode: false,
        keepPopupOpen: true,
        autoCloseDelay: 3000,
      },
      flags: {
        aiModeEnabled: true,
        byokEnabled: true,
        trialEnabled: true,
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

vi.mock('@/entrypoints/popup/hooks/useProManager', () => ({
  useProManager: () => mocks.useProManager(),
}));

vi.mock('@/entrypoints/popup/hooks/useToastManager', () => ({
  useToastManager: () => mocks.useToastManager(),
}));

vi.mock('@/entrypoints/popup/components/UnifiedSettings', () => ({
  UnifiedSettings: () => <div data-testid="unified-settings">settings</div>,
}));

vi.mock('@/entrypoints/popup/components/ToastContainer', () => ({
  ToastContainer: () => null,
}));

vi.mock('@/entrypoints/popup/components/ProBadge', () => ({
  ProBadge: () => null,
}));

vi.mock('@/entrypoints/popup/components/ModeToggle', () => ({
  ModeToggle: () => <div data-testid="mode-toggle">mode</div>,
}));

vi.mock('@/entrypoints/popup/components/PrimaryButton', () => ({
  PrimaryButton: ({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}));

vi.mock('@/entrypoints/popup/components/ProUpgradePrompt', () => ({
  ProUpgradePrompt: () => null,
}));

vi.mock('@/entrypoints/popup/components/LoadingOverlay', () => ({
  LoadingOverlay: () => null,
}));

describe('Popup settings mount guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    mocks.usePopupController.mockReturnValue({
      state: {
        mode: 'offline',
        isPro: false,
        settings: undefined,
        credits: { remaining: 10, total: 10, lastReset: new Date().toISOString() },
        trial: { hasExhausted: false },
        hasApiKey: false,
        processing: { status: 'idle' },
        exportData: null,
        showUpgrade: false,
      },
      hasContent: false,
      handleModeToggle: vi.fn(),
      handleCapture: vi.fn(),
      handleCopy: vi.fn(),
      handleExport: vi.fn(),
      handleUpgradeClose: vi.fn(),
      onSettingsChange: vi.fn(),
    });

    mocks.useByokManager.mockReturnValue({ hasApiKey: false });
    mocks.useProManager.mockReturnValue({ isInTrial: false });
    mocks.useToastManager.mockReturnValue({ toasts: [], hideToast: vi.fn(), showSuccess: vi.fn() });
    mocks.tabsQuery.mockResolvedValue([]);
  });

  it('does not render settings panel before settings are loaded', () => {
    render(<Popup />);

    expect(screen.queryByTestId('unified-settings')).not.toBeInTheDocument();
    expect(screen.getByText('Capture Content')).toBeInTheDocument();
  });
});
