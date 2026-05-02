import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Popup from '@/entrypoints/popup/Popup';

const mocks = vi.hoisted(() => ({
  usePopupController: vi.fn(),
  useToastManager: vi.fn(),
  runtimeAddListener: vi.fn(),
  runtimeRemoveListener: vi.fn(),
  tabsCreate: vi.fn(),
  unifiedSettings: vi.fn(),
}));

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      onMessage: {
        addListener: mocks.runtimeAddListener,
        removeListener: mocks.runtimeRemoveListener,
      },
    },
    tabs: {
      create: mocks.tabsCreate,
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
        apiKey: '',
        selectedByokModel: '',
        customPrompt: '',
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
        developerMode: true,
      },
    }),
    updateSettings: vi.fn(),
  },
}));

vi.mock('@/entrypoints/popup/hooks/usePopupController', () => ({
  usePopupController: () => mocks.usePopupController(),
}));

vi.mock('@/entrypoints/popup/hooks/useToastManager', () => ({
  useToastManager: () => mocks.useToastManager(),
}));

vi.mock('@/entrypoints/popup/components/UnifiedSettings', () => ({
  UnifiedSettings: (props: { initialView?: string }) => {
    mocks.unifiedSettings(props);
    return <div data-testid="settings-view">{props.initialView || 'main'}</div>;
  },
}));

vi.mock('@/entrypoints/popup/components/ToastContainer', () => ({
  ToastContainer: () => null,
}));

vi.mock('@/entrypoints/popup/components/ModeToggle', () => ({
  ModeToggle: () => <div>mode toggle</div>,
}));

vi.mock('@/entrypoints/popup/components/LoadingOverlay', () => ({
  LoadingOverlay: () => null,
}));

const settings = {
  mode: 'ai' as const,
  templates: { bundles: [] },
  byok: {
    provider: 'openrouter' as const,
    apiBase: 'https://openrouter.ai/api/v1',
    apiKey: '',
    selectedByokModel: '',
    customPrompt: '',
  },
  privacy: { telemetryEnabled: false },
  ui: {
    theme: 'auto' as const,
    animations: false,
    compactMode: false,
    keepPopupOpen: true,
    autoCloseDelay: 3000,
  },
  flags: {
    aiModeEnabled: true,
    byokEnabled: true,
    trialEnabled: true,
    developerMode: true,
  },
};

function renderPopupWithExport(aiOutcome = 'fallback_missing_key') {
  const handleCopy = vi.fn();
  const handleExport = vi.fn();

  mocks.usePopupController.mockReturnValue({
    state: {
      mode: 'ai',
      settings,
      hasApiKey: false,
      isUnlocked: false,
      canUseAIMode: false,
      aiLockReason: 'missing_api_key',
      remainingFreeByokUsesToday: 0,
      remainingFreeByokStartsToday: 0,
      processing: { status: 'complete' },
      exportData: {
        markdown: '# Captured',
        json: { content: { markdown: '# Captured' }, export: { html: '<main>Captured</main>' } },
        metadata: {},
        stats: { totalTime: 123, provider: 'local-offline' },
        qualityReport: { overallScore: 99 },
        aiOutcome,
      },
      toast: null,
    },
    hasContent: true,
    isProcessing: false,
    handleModeToggle: vi.fn(),
    handleCapture: vi.fn(),
    handleCopy,
    handleExport,
    onSettingsChange: vi.fn(),
  });

  render(<Popup />);

  return { handleCopy, handleExport };
}

async function showProviderFallbackDetails(error = 'OpenRouter provider returned 429 rate limited') {
  renderPopupWithExport('fallback_request_failed');

  const popupListener = mocks.runtimeAddListener.mock.calls[0]?.[0];
  expect(popupListener).toBeTypeOf('function');

  await act(async () => {
    popupListener({
      type: 'PROCESSING_FALLBACK',
      payload: {
        stage: 'ai-processing',
        error,
      },
    });
  });
}

describe('Popup outcome rendering', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.useToastManager.mockReturnValue({
      toasts: [],
      hideToast: vi.fn(),
      showSuccess: vi.fn(),
      showError: vi.fn(),
      showWarning: vi.fn(),
      showInfo: vi.fn(),
    });
  });

  it('shows missing-key fallback as offline output ready with copy/save enabled', () => {
    const { handleCopy, handleExport } = renderPopupWithExport('fallback_missing_key');

    expect(screen.getByText('Offline output ready')).toBeInTheDocument();
    expect(screen.getByText('Add an API key to use AI. Offline capture still works.')).toBeInTheDocument();
    expect(screen.queryByText('AI failed (offline output generated)')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /copy md/i }));
    fireEvent.click(screen.getByRole('button', { name: /save md/i }));

    expect(handleCopy).toHaveBeenCalledWith('# Captured');
    expect(handleExport).toHaveBeenCalledWith('md');
  });

  it('keeps developer payloads collapsed until details are opened', () => {
    renderPopupWithExport('fallback_request_failed');

    expect(screen.queryByText(/Stats:/)).not.toBeInTheDocument();
    expect(screen.queryByText('Raw JSON')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /developer details/i }));

    expect(screen.getByText(/Stats:/)).toBeInTheDocument();
    expect(screen.getByText('Raw JSON')).toBeInTheDocument();
  });

  it('keeps outcome details separate from expanded exports', async () => {
    await showProviderFallbackDetails('OpenRouter provider returned 429 rate limited');

    fireEvent.click(screen.getByRole('button', { name: /view details/i }));

    expect(screen.getByText(/429 rate limited/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change model/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /copy json/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /raw md/i })).not.toBeInTheDocument();
  });

  it('keeps expanded exports separate from outcome details', async () => {
    await showProviderFallbackDetails('OpenRouter provider returned 429 rate limited');

    fireEvent.click(screen.getByRole('button', { name: /more exports/i }));

    expect(screen.getByRole('button', { name: /copy json/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /raw md/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /code block/i })).toBeInTheDocument();
    expect(screen.queryByText(/429 rate limited/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /change model/i })).not.toBeInTheDocument();
  });

  it('shows temporary checked feedback for copy and save actions', async () => {
    const { handleCopy, handleExport } = renderPopupWithExport('fallback_missing_key');

    fireEvent.click(screen.getByRole('button', { name: /copy md/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument());
    expect(handleCopy).toHaveBeenCalledWith('# Captured');

    fireEvent.click(screen.getByRole('button', { name: /save md/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /saved/i })).toBeInTheDocument());
    expect(handleExport).toHaveBeenCalledWith('md');
  });

  it('shows temporary checked feedback for Copy JSON', async () => {
    const { handleCopy } = renderPopupWithExport('fallback_missing_key');

    fireEvent.click(screen.getByRole('button', { name: /more exports/i }));
    fireEvent.click(screen.getByRole('button', { name: /copy json/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument());
    expect(handleCopy).toHaveBeenCalledWith(JSON.stringify({ content: { markdown: '# Captured' }, export: { html: '<main>Captured</main>' } }, null, 2));
  });

  it('routes Change model to BYOK model settings', async () => {
    await showProviderFallbackDetails('OpenRouter provider returned 429 rate limited');

    fireEvent.click(screen.getByRole('button', { name: /view details/i }));
    fireEvent.click(screen.getByRole('button', { name: /change model/i }));

    expect(screen.getByTestId('settings-view')).toHaveTextContent('byok');
  });

  it('routes Open settings to BYOK configuration for missing keys', () => {
    renderPopupWithExport('fallback_missing_key');

    fireEvent.click(screen.getByRole('button', { name: /view details/i }));
    fireEvent.click(screen.getByRole('button', { name: /open settings/i }));

    expect(screen.getByTestId('settings-view')).toHaveTextContent('byok');
  });
});
