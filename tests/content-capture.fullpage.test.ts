import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ContentCapture } from '../content/capture';

describe('ContentCapture full-page snapshot', () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalNode = globalThis.Node;
  const originalNodeFilter = globalThis.NodeFilter;
  const originalMutationObserver = globalThis.MutationObserver;

  beforeEach(() => {
    const dom = new (globalThis as any).JSDOM(`
      <!doctype html>
      <html>
        <head><title>PromptReady — One-click clean Markdown from any page</title></head>
        <body>
          <nav>
            <a href="/home">Home</a>
            <a href="/pricing">Pricing</a>
          </nav>
          <main>
            <section>
              <h2>Cleaner input. Better model output.</h2>
              <p>PromptReady extracts the useful parts and preserves structure.</p>
              <a href="/docs/quickstart">Read quickstart</a>
            </section>
            <section>
              <h3>Core benefits</h3>
              <ul>
                <li>Preserves code fences</li>
                <li>Adds clean citations</li>
                <li>Privacy-first local parsing</li>
              </ul>
            </section>
            <section>
              <h2>Trusted by builders, researchers, and operators</h2>
              <p>Teams use PromptReady when they need reliable context.</p>
            </section>
          </main>
          <script>window.__noise = true;</script>
          <style>body { background: red; }</style>
        </body>
      </html>
    `, { url: 'https://promptready.app/' });

    (globalThis as any).window = dom.window;
    (globalThis as any).document = dom.window.document;
    (globalThis as any).Node = dom.window.Node;
    (globalThis as any).NodeFilter = dom.window.NodeFilter;
    (globalThis as any).MutationObserver = dom.window.MutationObserver;
  });

  afterEach(() => {
    vi.useRealTimers();
    (globalThis as any).window = originalWindow;
    (globalThis as any).document = originalDocument;
    (globalThis as any).Node = originalNode;
    (globalThis as any).NodeFilter = originalNodeFilter;
    (globalThis as any).MutationObserver = originalMutationObserver;
  });

  it('captures full sanitized DOM without pre-extraction truncation', async () => {
    const result = await ContentCapture.captureFullPage({
      settleTimeoutMs: 0,
      quietWindowMs: 200,
      deepCaptureEnabled: false,
      maxScrollSteps: 3,
      maxScrollDurationMs: 1_000,
      scrollStepDelayMs: 0,
      minTextGainRatio: 0.2,
      minHeadingGain: 1,
    });

    expect(result.url).toBe('https://promptready.app/');
    expect(result.title).toContain('PromptReady');
    expect(result).not.toHaveProperty('pipelineMetadata');

    expect(result.html).toContain('Cleaner input. Better model output.');
    expect(result.html).toContain('Core benefits');
    expect(result.html).toContain('Trusted by builders, researchers, and operators');

    expect(result.html).not.toContain('<script');
    expect(result.html).not.toContain('<style');
    expect(result.html).toContain('https://promptready.app/docs/quickstart');
    expect(result.captureDiagnostics).toBeDefined();
    expect(result.captureDiagnostics?.strategy).toBe('initial-body-html');
    expect(result.captureDiagnostics?.scrollStepsExecuted).toBe(0);
    expect(result.captureDiagnostics?.deepUsedReason).toBe('deep-capture-disabled-by-policy');
  });

  it('waits for Reddit body hydration before snapshot when initial shell has only skip navigation', async () => {
    vi.useFakeTimers();
    const dom = new (globalThis as any).JSDOM(`
      <!doctype html>
      <html>
        <head><title>Reddit Post</title></head>
        <body>
          <h1>I gave Claude Code a $0.02/call coworker and stopped hitting Pro limits</h1>
          <a href="#left-sidebar-container">Skip to Navigation</a>
          <a href="#right-sidebar-container">Skip to Right Sidebar</a>
        </body>
      </html>
    `, { url: 'https://www.reddit.com/r/ClaudeAI/comments/1t1o43w/i_gave_claude_code_a_002call_coworker_and_stopped/' });

    (globalThis as any).window = dom.window;
    (globalThis as any).document = dom.window.document;
    (globalThis as any).Node = dom.window.Node;
    (globalThis as any).NodeFilter = dom.window.NodeFilter;
    (globalThis as any).MutationObserver = dom.window.MutationObserver;

    setTimeout(() => {
      const post = dom.window.document.createElement('div');
      post.setAttribute('slot', 'text-body');
      post.textContent = 'Was hitting my weekly Pro limit by Wednesday, so I built a small coworker setup that handles cheap calls while Claude Code keeps the important work. The setup uses a simple command bridge, a budget guard, and repeatable prompts so the expensive model only sees the decisions that need it.';
      dom.window.document.body.appendChild(post);
    }, 25);

    const capturePromise = ContentCapture.captureFullPage({
      settleTimeoutMs: 0,
      quietWindowMs: 50,
      deepCaptureEnabled: false,
      maxScrollSteps: 0,
      maxScrollDurationMs: 500,
      scrollStepDelayMs: 0,
      minTextGainRatio: 0.2,
      minHeadingGain: 1,
    });

    await vi.advanceTimersByTimeAsync(3000);
    const result = await capturePromise;

    expect(result.html).toContain('Was hitting my weekly Pro limit by Wednesday');
    expect(result.captureDiagnostics?.deepUsedReason).toContain('reddit-hydration');
  });
});
