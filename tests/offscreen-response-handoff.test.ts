import { describe, expect, it, vi } from "vitest";

const browserMock = vi.hoisted(() => ({
  runtime: {
    onMessage: {
      addListener: vi.fn(),
    },
    sendMessage: vi.fn(),
  },
  storage: undefined as
    | undefined
    | {
        session?: {
          set?: ReturnType<typeof vi.fn>;
        };
      },
}));

vi.mock("wxt/browser", () => ({
  browser: browserMock,
}));

describe("offscreen processing response handoff", () => {
  it("does not log a TypeError when session storage is unavailable", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { EnhancedOffscreenProcessor } =
      await import("@/entrypoints/offscreen/enhanced-processor");
    const processor = Object.create(
      (EnhancedOffscreenProcessor as any).prototype,
    ) as any;

    await processor.storeProcessResponse("run_test", {
      success: false,
      error: "Processing failed",
    });

    expect(warnSpy).not.toHaveBeenCalledWith(
      "[EnhancedOffscreenProcessor] Failed to store processing response handoff:",
      expect.objectContaining({
        message: expect.stringContaining("Cannot read properties of undefined"),
      }),
    );
  });
});
