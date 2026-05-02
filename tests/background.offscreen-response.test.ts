import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Storage } from '@/lib/storage';

const browserMock = vi.hoisted(() => ({
  runtime: {
    sendMessage: vi.fn(),
  },
  storage: {
    session: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
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
    browserMock.storage.session.get.mockResolvedValue({});
    browserMock.storage.session.set.mockResolvedValue(undefined);
    browserMock.storage.session.remove.mockResolvedValue(undefined);
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
    expect(browserMock.runtime.sendMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: 'ENHANCED_OFFSCREEN_PROCESS',
        target: 'promptready-offscreen',
      }),
    );
    expect(processor.ensureOffscreenDocument).toHaveBeenCalledTimes(2);
    expect(processor.handleProcessingComplete).toHaveBeenCalledWith({ payload: processingPayload });
    expect(processor.broadcastError).not.toHaveBeenCalled();
  });

  it('retries once when the first sendMessage rejects and succeeds on retry', async () => {
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
      .mockRejectedValueOnce(new Error('Could not establish connection. Receiving end does not exist.'))
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

  it('recovers a completed offscreen result from session storage when direct responses are missing', async () => {
    const processor = await createProcessor();
    const processingPayload = {
      exportMd: 'Offline fallback markdown',
      exportJson: { content: { markdown: 'Offline fallback markdown' }, metadata: {} },
      metadata: {},
      stats: {},
      warnings: ['ai_fallback:request_failed'],
      originalHtml: '<main>Captured</main>',
      aiAttempted: true,
      aiProvider: 'openrouter',
      aiOutcome: 'fallback_request_failed',
      fallbackCode: 'ai_fallback:request_failed',
      runId: 'run_test',
    };

    browserMock.runtime.sendMessage.mockResolvedValue(undefined);
    browserMock.storage.session.get.mockResolvedValue({
      offscreen_process_response_run_test: { success: true, data: processingPayload },
    });

    await runCapture(processor);

    expect(browserMock.runtime.sendMessage).toHaveBeenCalledTimes(2);
    expect(processor.handleProcessingComplete).toHaveBeenCalledWith({ payload: processingPayload });
    expect(processor.broadcastError).not.toHaveBeenCalled();
    expect(browserMock.storage.session.remove).toHaveBeenCalledWith('offscreen_process_response_run_test');
  });

  it('treats fallback processing errors as degraded notices rather than extension errors', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const processor = await createProcessor();
    processor.broadcastMessage = vi.fn().mockResolvedValue(undefined);

    await processor.handleProcessingError({
      type: 'PROCESSING_ERROR',
      payload: {
        error: 'BYOK returned empty content for model=openrouter/free',
        stage: 'ai-processing',
        fallbackUsed: true,
        runId: 'run_test',
      },
    });

    expect(errorSpy).not.toHaveBeenCalledWith(
      'Processing error in ai-processing:',
      'BYOK returned empty content for model=openrouter/free',
    );
    expect(warnSpy).toHaveBeenCalledWith(
      'Processing fallback in ai-processing:',
      'BYOK returned empty content for model=openrouter/free',
    );
    expect(processor.broadcastMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'PROCESSING_FALLBACK',
        payload: expect.objectContaining({
          fallbackUsed: true,
          stage: 'ai-processing',
        }),
      }),
    );
    expect(processor.broadcastError).not.toHaveBeenCalled();
  });
});
