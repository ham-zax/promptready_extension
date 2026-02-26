import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ContentCapture } from '../content/capture';

describe('ContentCapture full-page snapshot', () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalNode = globalThis.Node;
  const originalNodeFilter = globalThis.NodeFilter;

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
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
    (globalThis as any).document = originalDocument;
    (globalThis as any).Node = originalNode;
    (globalThis as any).NodeFilter = originalNodeFilter;
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
});
