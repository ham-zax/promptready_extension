import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Popup from '@/entrypoints/popup/Popup';
import { derivePopupOutcome, type PopupOutcomeInput } from '@/entrypoints/popup/lib/popup-outcome';

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
  processing: {
    profile: 'standard',
    contentStrategy: 'auto',
    outputFormat: 'clean-markdown',
    readabilityPreset: 'standard',
    turndownPreset: 'standard',
    capturePolicy: {
      settleTimeoutMs: 600,
      quietWindowMs: 150,
      deepCaptureEnabled: false,
      maxScrollSteps: 5,
      maxScrollDurationMs: 3000,
      scrollStepDelayMs: 180,
      minTextGainRatio: 0.2,
      minHeadingGain: 2,
    },
    customOptions: {
      preserveCodeBlocks: true,
      includeImages: true,
      preserveTables: true,
      preserveLinks: true,
    },
  },
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

function renderPopupWithExport(
  aiOutcome = 'fallback_missing_key',
  qualityReport: Record<string, unknown> = { overallScore: 99 },
) {
  const handleCopy = vi.fn();
  const handleExport = vi.fn();
  const onSettingsChange = vi.fn();

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
        qualityReport,
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
    onSettingsChange,
  });

  render(<Popup />);

  return { handleCopy, handleExport, onSettingsChange };
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

  it('shows deep capture on the main capture surface and updates capture policy', () => {
    const { onSettingsChange } = renderPopupWithExport('fallback_missing_key');

    const checkbox = screen.getByRole('checkbox', { name: /deep capture/i }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    fireEvent.click(checkbox);

    expect(onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({
        processing: expect.objectContaining({
          capturePolicy: expect.objectContaining({
            deepCaptureEnabled: true,
          }),
        }),
      }),
    );
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

  it('does not describe quality-gate fallback output as failed finalization', async () => {
    renderPopupWithExport('fallback_quality_gate_failed');

    const popupListener = mocks.runtimeAddListener.mock.calls[0]?.[0];
    expect(popupListener).toBeTypeOf('function');

    await act(async () => {
      popupListener({
        type: 'PROCESSING_COMPLETE',
        payload: {
          aiOutcome: 'fallback_quality_gate_failed',
          fallbackCode: 'ai_fallback:quality_gate_failed',
          warnings: ['ai_quality_gate:heading_order_loss'],
        },
      });
    });

    expect(screen.getAllByText('Offline output ready').length).toBeGreaterThan(0);
    expect(screen.getByText(/AI quality gate failed: heading_order_loss/i)).toBeInTheDocument();
    expect(screen.queryByText(/Failed at Checking and finalizing Markdown/i)).not.toBeInTheDocument();
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

  it('renders title-only captures as incomplete instead of ready output', () => {
    renderPopupWithExport('not_attempted', {
      completenessStatus: 'incomplete_title_only',
      overallScore: 20,
      issues: [{ message: 'quality:title_only_capture', category: 'content' }],
    });

    expect(screen.getByText('Capture incomplete')).toBeInTheDocument();
    expect(screen.getByText(/found the page title/i)).toBeInTheDocument();
    expect(screen.queryByText('Offline output ready')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /copy md/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save md/i })).not.toBeInTheDocument();
  });

  it('renders metadata-only captures as incomplete instead of ready output', () => {
    renderPopupWithExport('not_attempted', {
      completenessStatus: 'incomplete_empty_body',
      overallScore: 15,
      issues: [{ message: 'quality:empty_body', category: 'content' }],
    });

    expect(screen.getByText('Capture incomplete')).toBeInTheDocument();
    expect(screen.getByText(/only metadata/i)).toBeInTheDocument();
    expect(screen.queryByText('Offline output ready')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /copy md/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save md/i })).not.toBeInTheDocument();
  });

  it('renders partial captures as degraded instead of neutral ready', () => {
    renderPopupWithExport('not_attempted', {
      completenessStatus: 'partial',
      overallScore: 40,
      issues: [{ message: 'quality:short_body', category: 'content' }],
    });

    expect(screen.getByText('Partial capture ready')).toBeInTheDocument();
    expect(screen.getByText(/some page content may be missing/i)).toBeInTheDocument();
    expect(screen.queryByText('Offline output ready')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy md/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save md/i })).toBeInTheDocument();
  });
});

describe('derivePopupOutcome for incomplete captures', () => {
  it('should classify markdown with only title and metadata as incomplete, not ready', () => {
    const input: PopupOutcomeInput = {
      mode: 'offline',
      hasContent: true,
      processingStatus: 'complete',
      qualityReport: {
        completenessStatus: 'incomplete_title_only',
        overallScore: 20,
        issues: [{ message: 'quality:title_only_capture', category: 'content' }],
      },
    };

    const outcome = derivePopupOutcome(input);

    expect(outcome).not.toBeNull();
    expect(outcome?.kind).not.toBe('ready_offline');
    expect(outcome?.kind).not.toBe('ready_ai');
    expect(outcome?.tone).toBe('error');
    expect(outcome?.message).toMatch(/incomplete|not.*body|only.*title/i);
  });

  it('should classify metadata-only markdown (no body) as failed, not ready', () => {
    const input: PopupOutcomeInput = {
      mode: 'offline',
      hasContent: true,
      processingStatus: 'complete',
      qualityReport: {
        completenessStatus: 'incomplete_empty_body',
        overallScore: 15,
        issues: [{ message: 'quality:empty_body', category: 'content' }],
      },
    };

    const outcome = derivePopupOutcome(input);

    expect(outcome).not.toBeNull();
    expect(outcome?.kind).toBe('failed');
    expect(outcome?.message).toMatch(/incomplete|empty|no.*content/i);
  });

  it('should still classify valid markdown with body content as ready_offline', () => {
    const input: PopupOutcomeInput = {
      mode: 'offline',
      hasContent: true,
      processingStatus: 'complete',
      qualityReport: {
        completenessStatus: 'complete',
        overallScore: 85,
        issues: [],
      },
    };

    const outcome = derivePopupOutcome(input);

    expect(outcome).not.toBeNull();
    expect(outcome?.kind).toBe('ready_offline');
    expect(outcome?.tone).toBe('neutral');
  });

  it('should classify partial captures as degraded but exportable', () => {
    const input: PopupOutcomeInput = {
      mode: 'offline',
      hasContent: true,
      processingStatus: 'complete',
      qualityReport: {
        completenessStatus: 'partial',
        overallScore: 40,
        issues: [{ message: 'quality:short_body', category: 'content' }],
      },
    };

    const outcome = derivePopupOutcome(input);

    expect(outcome).not.toBeNull();
    expect(outcome?.kind).toBe('ready_offline_degraded');
    expect(outcome?.tone).toBe('degraded');
    expect(outcome?.primaryActions).toEqual(['copy_md', 'save_md']);
    expect(outcome?.title).toBe('Partial capture ready');
  });
});
