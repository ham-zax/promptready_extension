import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Storage } from '@/lib/storage';

const browserMock = vi.hoisted(() => ({
  runtime: {
    sendMessage: vi.fn(),
  },
}));

vi.mock('wxt/browser', () => ({
  browser: browserMock,
}));

async function createProcessor() {
  const { EnhancedContentProcessor } = await import('@/entrypoints/background');
  const processor = Object.create((EnhancedContentProcessor as any).prototype) as any;

  Object.assign(processor, {
    inProgressRequests: new Set(),
    pendingCaptureMap: new Map(),
    createRunId: vi.fn(() => 'run_test'),
    reserveAiRunSlot: vi.fn().mockResolvedValue({ canUseAIMode: true }),
    ensureOffscreenDocument: vi.fn().mockResolvedValue(undefined),
    waitForOffscreenRetryDelay: vi.fn().mockResolvedValue(undefined),
    handleProcessingComplete: vi.fn().mockResolvedValue(undefined),
    settleAiRunCompletion: vi.fn().mockResolvedValue(undefined),
    broadcastError: vi.fn().mockResolvedValue(undefined),
  });

  vi.spyOn(Storage, 'getSettings').mockResolvedValue({
    mode: 'ai',
    useReadability: true,
    renderer: 'turndown',
    templates: { bundles: [] },
    byok: {
      provider: 'openrouter',
      apiBase: 'https://openrouter.ai/api/v1',
      apiKey: 'sk-or-v1-test',
      selectedByokModel: 'openai/gpt-5.2',
    },
    privacy: { telemetryEnabled: false },
    flags: {
      aiModeEnabled: true,
      byokEnabled: true,
      trialEnabled: true,
      developerMode: false,
    },
  } as any);

  return processor;
}

async function runCapture(processor: any) {
  await processor.handleCaptureComplete(
    {
      type: 'CAPTURE_COMPLETE',
      payload: {
        html: '<main>Captured</main>',
        url: 'https://example.com/page',
        title: 'Captured page',
        selectionHash: 'selection_hash',
      },
    },
    { tab: { id: 42 } },
  );
}

describe('background offscreen processing response handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.stubGlobal('defineBackground', (setup: unknown) => setup);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries once when the offscreen processor returns no direct response', async () => {
    const processor = await createProcessor();
    const processingPayload = {
      exportMd: 'AI markdown',
      exportJson: { content: { markdown: 'AI markdown' }, metadata: {} },
      metadata: {},
      stats: {},
      warnings: [],
      originalHtml: '<main>Captured</main>',
      aiAttempted: true,
      aiProvider: 'openrouter',
      aiOutcome: 'success',
      runId: 'run_test',
    };

    browserMock.runtime.sendMessage
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ success: true, data: processingPayload });

    await runCapture(processor);

    expect(browserMock.runtime.sendMessage).toHaveBeenCalledTimes(2);
    expect(processor.ensureOffscreenDocument).toHaveBeenCalledTimes(2);
    expect(processor.handleProcessingComplete).toHaveBeenCalledWith({ payload: processingPayload });
    expect(processor.broadcastError).not.toHaveBeenCalled();
  });

  it('surfaces a stable orchestration error when the offscreen processor never responds', async () => {
    const processor = await createProcessor();
    browserMock.runtime.sendMessage.mockResolvedValue(undefined);

    await runCapture(processor);

    expect(browserMock.runtime.sendMessage).toHaveBeenCalledTimes(2);
    expect(processor.handleProcessingComplete).not.toHaveBeenCalled();
    expect(processor.broadcastError).toHaveBeenCalledWith(
      'Failed to process content: Offscreen processor did not return a valid response',
    );
    expect(processor.broadcastError).not.toHaveBeenCalledWith(
      expect.stringContaining("Cannot read properties of undefined"),
    );
  });
});
