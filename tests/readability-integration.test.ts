import { describe, it, expect } from 'vitest';
import { OfflineModeManager } from '../core/offline-mode-manager';

describe('Readability Integration Tests', () => {
  it('should extract and process blog article with Readability', async () => {
    const html = `
      <html>
        <body>
          <article>
            <h1>Test Blog Post Title</h1>
            <p>This is a test blog article with enough content to pass the character threshold for extraction. We need to make sure this has sufficient length to test the Readability algorithm properly.</p>
            <p>Additional content to ensure we meet the minimum character requirements for blog article extraction.</p>
            <blockquote>This is a quote from the blog post that should be preserved.</blockquote>
          </article>
          <nav>Navigation content should be ignored</nav>
          <footer>Footer content should be ignored</footer>
        </body>
      </html>
    `;
    const url = 'https://blog.example.com/test-post';
    const title = 'Test Blog Post';

    const result = await OfflineModeManager.processContent(html, url, title);

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('# Test Blog Post Title');
    expect(result.markdown).toContain('This is a test blog article');
    expect(result.markdown).toContain('This is a quote from the blog post');
    expect(result.processingStats.readabilityTime).toBeGreaterThan(0);
    expect(result.processingStats.fallbacksUsed).not.toContain('readability-fallback');
  });

  it('should use technical-documentation preset for docs sites', async () => {
    const html = `
      <html>
        <body>
          <main>
            <h2>API Reference</h2>
            <pre><code>function testFunction(param: string): boolean {
  return param.length > 0;
}</code></pre>
            <p>Explanation of the API function with code examples.</p>
            <div class="api-endpoint">GET /api/test</div>
          </main>
          <aside>Sidebar content should be lower priority</aside>
        </body>
      </html>
    `;
    const url = 'https://docs.example.com/api-reference';

    const result = await OfflineModeManager.processContent(html, url, 'API Documentation');

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('```');
    expect(result.markdown).toContain('function testFunction');
    expect(result.markdown).toContain('param: string');
    expect(result.processingStats.readabilityTime).toBeGreaterThan(0);
  });

  it('should use wiki-content preset for Wikipedia-style pages', async () => {
    const html = `
      <html>
        <body>
          <div id="mw-content-text">
            <h1>Test Wiki Page</h1>
            <p>This is wiki content with references and infobox data.</p>
            <div class="infobox">Infobox content should be preserved</div>
            <div class="references">Reference content should be preserved</div>
          </div>
          <div id="mw-navigation">Navigation should be ignored</div>
        </body>
      </html>
    `;
    const url = 'https://wiki.example.com/Test_Page';

    const result = await OfflineModeManager.processContent(html, url, 'Test Wiki Page');

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('# Test Wiki Page');
    expect(result.markdown).toContain('This is wiki content');
    expect(result.processingStats.readabilityTime).toBeGreaterThan(0);
  });

  it('should fallback when Readability extraction fails', async () => {
    const html = `<div>Minimal content</div>`;
    const url = 'https://example.com/minimal';

    const result = await OfflineModeManager.processContent(html, url, 'Minimal Test');

    expect(result.success).toBe(true); // Should succeed with fallback
    expect(result.processingStats.fallbacksUsed).toContain('readability-fallback');
    expect(result.markdown).toContain('Minimal content'); // Should have some content
  });

  it('should handle news articles with appropriate preset', async () => {
    const html = `
      <html>
        <body>
          <article>
            <h1>Breaking News Story</h1>
            <div class="dateline">January 1, 2024</div>
            <div class="byline">By Test Reporter</div>
            <div class="lead">This is the lead paragraph of the news story with important information.</div>
            <p>Main content of the news article follows here with sufficient details.</p>
            <blockquote>Quote from a source involved in the story.</blockquote>
          </article>
          <div class="related-articles">Related content should be lower priority</div>
        </body>
      </html>
    `;
    const url = 'https://news.example.com/breaking-story';

    const result = await OfflineModeManager.processContent(html, url, 'Breaking News Story');

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('# Breaking News Story');
    expect(result.markdown).toContain('This is the lead paragraph');
    expect(result.processingStats.readabilityTime).toBeGreaterThan(0);
  });

  it('should handle academic papers with proper structure preservation', async () => {
    const html = `
      <html>
        <body>
          <div class="paper-content">
            <h1>Research Paper Title</h1>
            <div class="abstract">This is the abstract of the research paper.</div>
            <div class="citation">[1] Reference citation</div>
            <div class="theorem">Theorem statement with mathematical content.</div>
            <div class="proof">Proof of the theorem with logical steps.</div>
            <div class="figure">Figure 1: Diagram showing results</div>
            <table><tr><th>Header</th><td>Data</td></tr></table>
          </div>
          <div class="references">References section with detailed bibliography.</div>
        </body>
      </html>
    `;
    const url = 'https://arxiv.example.com/abs/2401.12345';

    const result = await OfflineModeManager.processContent(html, url, 'Research Paper Title');

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('# Research Paper Title');
    expect(result.markdown).toContain('This is the abstract');
    expect(result.markdown).toContain('[1] Reference citation');
    expect(result.processingStats.readabilityTime).toBeGreaterThan(0);
  });

  it('should properly process forum discussions', async () => {
    const html = `
      <html>
        <body>
          <div class="forum-thread">
            <div class="post">
              <div class="user">Username123</div>
              <div class="timestamp">2024-01-01 12:00:00</div>
              <div class="comment">This is the main post content in the discussion thread.</div>
            </div>
            <div class="thread">
              <div class="reply">
                <div class="user">Responder456</div>
                <div class="timestamp">2024-01-01 12:30:00</div>
                <div class="comment">This is a reply to the original post.</div>
              </div>
              <div class="reply">
                <div class="user">AnotherUser789</div>
                <div class="timestamp">2024-01-01 13:00:00</div>
                <div class="comment">Another reply in the thread.</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
    const url = 'https://forum.example.com/discussion-thread';

    const result = await OfflineModeManager.processContent(html, url, 'Forum Discussion Thread');

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('Username123');
    expect(result.markdown).toContain('This is the main post content');
    expect(result.processingStats.readabilityTime).toBeGreaterThan(0);
  });
});