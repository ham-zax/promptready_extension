import { describe, it, expect, beforeEach } from 'vitest';
import { safeParseHTML } from '../lib/dom-utils';
import { PageTypeProfiler } from '../core/page-type-profiler';
import { OfflineModeManager, type ExtractionCandidateTrace } from '../core/offline-mode-manager';

describe('PR6 Page-Type Profiles Integration', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('classifies Documentation correctly based on URL and DOM', () => {
    const html = `
      <div class="docs-container">
        <h1>API Reference</h1>
        <pre><code>const api = new API();</code></pre>
        <pre><code>api.call();</code></pre>
        <pre><code>api.close();</code></pre>
        <h2>Methods</h2>
        <h3>Endpoint</h3>
        <h4>Headers</h4>
        <h5>Query Params</h5>
        <h6>Response</h6>
      </div>
    `;
    const doc = safeParseHTML(html);
    if (!doc) throw new Error('Failed to parse HTML');
    const result = PageTypeProfiler.classify(doc, 'https://example.com/docs/api');

    expect(result.profile).toBe('documentation');
    expect(result.signals).toContain('url:docs');
    expect(result.signals).toContain('dom:codeBlocks>=3');
    expect(result.signals).toContain('dom:headings>=5');
  });

  it('classifies Code-Heavy correctly and applies scoring boost', async () => {
    const html = `
      <div id="repo-content">
        <h1>My Cool Project</h1>
        <p>This is a project with lots of code.</p>
        <pre><code>line 1\\nline 2\\nline 3\\nline 4\\nline 5</code></pre>
        <pre><code>line 6\\nline 7\\nline 8\\nline 9\\nline 10</code></pre>
        <pre><code>line 11</code></pre>
        <pre><code>line 12</code></pre>
        <pre><code>line 13</code></pre>
        <pre><code>line 14</code></pre>
        <pre><code>line 15</code></pre>
        <pre><code>line 16</code></pre>
        <pre><code>line 17</code></pre>
        <pre><code>line 18</code></pre>
      </div>
    `;
    const doc = safeParseHTML(html);
    if (!doc) throw new Error('Failed to parse HTML');
    const classification = PageTypeProfiler.classify(doc, 'https://github.com/user/repo');

    expect(classification.profile).toBe('code-heavy');
    expect(classification.signals).toContain('dom:codeBlocks>=10');

    // Verify scoring boost in OfflineModeManager
    const result = await (OfflineModeManager as any).processContent(html, 'https://github.com/user/repo', 'Repo');
    const diagnostics = result.processingStats.extractionDiagnostics;

    expect(diagnostics?.pageType?.profile).toBe('code-heavy');
    expect(diagnostics?.pageType?.confidence).toBeLessThanOrEqual(1);
    expect(diagnostics?.pageType?.signals).toContain('dom:codeBlocks>=10');
    const boostedTrace = (diagnostics?.candidateTraces as ExtractionCandidateTrace[]).find((t: ExtractionCandidateTrace) => (t.profileScoreDelta || 0) > 0);
    expect(boostedTrace).toBeDefined();
  });

  it('classifies Forum correctly and avoids comment merging', async () => {
    const html = `
      <div id="thread">
        <h1>Discussion about thing</h1>
        <div class="comment">User A says hi</div>
        <div class="comment">User B says bye</div>
        <div class="comment">User C says maybe</div>
        <div class="post">The original post content goes here with enough detail to stand alone as the main discussion body without needing the reply thread.</div>
      </div>
    `;
    const doc = safeParseHTML(html);
    if (!doc) throw new Error('Failed to parse HTML');
    const classification = PageTypeProfiler.classify(doc, 'https://reddit.com/r/test/comments/123');

    expect(classification.profile).toBe('forum');
    expect(classification.signals).toContain('url:forum');
    expect(classification.signals).toContain('dom:comments>=3');

    const result = await (OfflineModeManager as any).processContent(html, 'https://reddit.com/r/test/comments/123', 'Thread');
    const diagnostics = result.processingStats.extractionDiagnostics;

    expect(diagnostics?.pageType?.profile).toBe('forum');
    expect(result.markdown).toContain('The original post content goes here');
    expect(result.markdown).not.toContain('User A says hi');
    expect(result.markdown).not.toContain('User B says bye');
    expect(result.markdown).not.toContain('User C says maybe');
    // Ensure comment containers were penalized (scoreDelta should be negative for comments)
    const commentTrace = (diagnostics?.candidateTraces as ExtractionCandidateTrace[]).find((t: ExtractionCandidateTrace) => t.source.includes('comment'));
    if (commentTrace) {
      expect((commentTrace.profileScoreDelta || 0)).toBeLessThan(0);
    }
  });

  it('classifies Product correctly', () => {
    const html = `
      <div class="product-page">
        <h1>Awesome Gadget</h1>
        <div class="price">$19.99</div>
        <button id="add-to-cart">Add to Cart</button>
        <table>
          <tr><td>Spec A</td><td>Value A</td></tr>
        </table>
      </div>
    `;
    const doc = safeParseHTML(html);
    if (!doc) throw new Error('Failed to parse HTML');
    const result = PageTypeProfiler.classify(doc, 'https://store.com/p/123');

    expect(result.profile).toBe('product');
    expect(result.signals).toContain('dom:product_signals');
  });

  it('adjusts assessQuality thresholds for technical content', async () => {
    // Short code-heavy content that would normally be penalized
    const html = `
      <h1>Snippet</h1>
      <pre><code>function test() {\\n  console.log("This is a short snippet that should not be marked as incomplete because it is code-heavy.");\\n}</code></pre>
      <pre><code>test();</code></pre>
      <pre><code>// more code</code></pre>
    `;

    const result = await (OfflineModeManager as any).processContent(html, 'https://github.com/short', 'Short Code');

    // Normally < 160 chars gets -25 penalty.
    // "Snippet\\n\\nfunction test() {\\n  console.log(\\"This is a short snippet...\\");\\n}\\n\\ntest();\\n\\n// more code" is ~120 chars.
    // If penalty is skipped, score should be high.
    expect(result.processingStats.qualityScore).toBeGreaterThan(75);
  });

  it('does not relax code-heavy quality when captured markdown dropped the code', () => {
    const sourceHtml = `
      <main>
        <h1>Snippet</h1>
        <pre><code>${'console.log("source only");\n'.repeat(8)}</code></pre>
        <pre><code>${'runSourceOnly();\n'.repeat(8)}</code></pre>
        <pre><code>${'// source code not captured\n'.repeat(8)}</code></pre>
      </main>
    `;
    const droppedCodeMarkdown = '# Snippet\n\nShort summary.';

    const score = (OfflineModeManager as any).assessQuality(
      droppedCodeMarkdown,
      sourceHtml,
      [],
      [],
      { profile: 'code-heavy', confidence: 0.8, signals: ['dom:codeBlocks>=3'] }
    );

    expect(score).toBeLessThanOrEqual(60);
  });
});
