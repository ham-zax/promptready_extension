import { beforeEach, describe, expect, it, vi } from 'vitest';

const browserMock = vi.hoisted(() => ({
  runtime: {
    sendMessage: vi.fn().mockResolvedValue(undefined),
  },
  storage: {
    session: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

vi.mock('wxt/browser', () => ({
  browser: browserMock,
}));

describe('background COPY_COMPLETE handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.stubGlobal('defineBackground', (setup: unknown) => setup);
  });

  it('accepts content-script copy completion messages without unknown-message warnings', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { EnhancedContentProcessor } = await import('@/entrypoints/background');
    const processor = Object.create((EnhancedContentProcessor as any).prototype) as any;

    await processor.handleMessage(
      { type: 'COPY_COMPLETE', payload: { success: true, method: 'execCommand' } },
      {},
      vi.fn(),
    );

    expect(warnSpy).not.toHaveBeenCalledWith('Unknown message type:', 'COPY_COMPLETE');
  });
});
