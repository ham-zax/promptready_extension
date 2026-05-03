import { describe, it, expect, vi, afterEach } from 'vitest';
import { OfflineModeManager } from '../core/offline-mode-manager';
import { RedditShadowExtractor } from '../core/reddit-shadow-extractor';
import { ReadabilityConfigManager } from '../core/readability-config';

describe('PR3 Generic Extractor Regression Fixtures', () => {
  const baseConfig = {
    turndownPreset: 'standard' as const,
    postProcessing: {
      enabled: false,
      addTableOfContents: false,
      optimizeForPlatform: 'standard' as const,
    },
    performance: {
      maxContentLength: 1_000_000,
      enableCaching: false,
      chunkSize: 100000,
    },
    fallbacks: {
      enableReadabilityFallback: true,
      enableTurndownFallback: true,
      maxRetries: 1,
    },
    extractionTuning: {
      mode: 'balanced' as const,
      slider: 50,
      minTextLength: 100,
      highQualityThreshold: 0.8,
      lowQualityPenalty: 20,
    }
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not record reddit-adapter:null for non-Reddit pages', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Article</title></head>
        <body>
          <main>
            <h1>Article</h1>
            <p>${'This is a normal article body with enough useful text to be extracted successfully. '.repeat(10)}</p>
          </main>
        </body>
      </html>
    `;
    
    // Force Readability to return empty so fallback selector runs
    vi.spyOn(ReadabilityConfigManager, 'extractContent').mockResolvedValue({
      content: '',
    });

    const result = await OfflineModeManager.processContent(
      html,
      'https://example.com/article',
      'Article',
      baseConfig
    );

    expect(result.success).toBe(true);
    expect(result.processingStats.strategiesAttempted || []).not.toContain('reddit-adapter');
    expect(result.processingStats.fallbacksUsed).not.toContain('reddit-adapter:null');
    expect(result.processingStats.strategyWinner).toMatch(/generic|fallback-content-selection/);
  });

  it('handles invalid URLs safely without crashing during fallback selection', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Bad URL Page</title></head>
        <body>
          <main>
            <article>
              <p>${'Some substantial content that can be extracted gracefully even if the URL is completely broken. '.repeat(10)}</p>
            </article>
          </main>
        </body>
      </html>
    `;

    vi.spyOn(ReadabilityConfigManager, 'extractContent').mockResolvedValue({
      content: '',
    });

    const result = await OfflineModeManager.processContent(
      html,
      'not-a-valid-url-at-all://%',
      'Bad URL Page',
      baseConfig
    );

    expect(result.success).toBe(true);
    expect(result.processingStats.strategiesAttempted || []).not.toContain('reddit-adapter');
  });

  it('does not trigger reddit-adapter for non-Reddit pages with slot="text-body"', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Custom Web Component Page</title></head>
        <body>
          <my-custom-element>
            <div slot="text-body">
              <p>${'This is a normal article body that happens to use a slot named text-body. '.repeat(10)}</p>
            </div>
          </my-custom-element>
        </body>
      </html>
    `;
    
    vi.spyOn(ReadabilityConfigManager, 'extractContent').mockResolvedValue({
      content: '',
    });

    const result = await OfflineModeManager.processContent(
      html,
      'https://example.com/web-component',
      'Custom Web Component Page',
      baseConfig
    );

    expect(result.success).toBe(true);
    expect(result.processingStats.strategiesAttempted || []).not.toContain('reddit-adapter');
    expect(result.processingStats.fallbacksUsed).not.toContain('reddit-adapter:null');
  });

  it('does not demote short but valid Reddit adapter content', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Short Valid Reddit Post</title></head>
        <body>
          <shreddit-post>
             <p>This is a short but valid post. It contains just enough characters to pass the validation check without needing multiple paragraphs.</p>
          </shreddit-post>
        </body>
      </html>
    `;
    const url = 'https://www.reddit.com/r/test/comments/789';

    // Mock Reddit extractor to return short valid content
    const shortValidContent = '<p>This is a short but valid post. It contains just enough characters to pass the validation check without needing multiple paragraphs.</p>';
    vi.spyOn(RedditShadowExtractor, 'extractContent').mockReturnValue({
      content: shortValidContent,
      metadata: { strategy: 'shadow-dom', qualityScore: 80, noiseFiltered: false, shadowDomDepth: 0 }
    });
    
    vi.spyOn(ReadabilityConfigManager, 'extractContent').mockResolvedValue({
      content: '',
    });

    const result = await OfflineModeManager.processContent(
      html,
      url,
      'Short Valid Reddit Post',
      baseConfig
    );

    expect(result.success).toBe(true);
    expect(result.processingStats.fallbacksUsed || []).not.toContain('reddit-adapter:incomplete');
    expect(result.processingStats.strategiesAttempted).toContain('reddit-adapter');
    expect(result.markdown).toContain('short but valid post');
  });

  it('proves generic selector recovery when shreddit-post is missing', async () => {
    // TASK #10.2: Add a fixture with no shreddit-post element but with visible post body in generic article/main/content containers.
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Reddit Post Without Shreddit</title></head>
        <body>
          <main>
            <article>
              <h1>Substantial Article Title</h1>
              <p>${'This is the main body content that should be extracted even if Reddit-specific shreddit elements are missing. '.repeat(20)}</p>
              <p>${'More substantial content to ensure it passes quality gates. '.repeat(10)}</p>
            </article>
          </main>
        </body>
      </html>
    `;
    const url = 'https://www.reddit.com/r/test/comments/123';

    // Force Readability to return empty to prove GenericExtractor recovery
    vi.spyOn(ReadabilityConfigManager, 'extractContent').mockResolvedValue({
      content: '<h1>Substantial Article Title</h1>',
    });

    const result = await OfflineModeManager.processContent(
      html,
      url,
      'Reddit Post Without Shreddit',
      baseConfig
    );

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('This is the main body content');
    expect(result.markdown).toContain('More substantial content');
    expect(result.processingStats.strategiesAttempted).toContain('generic-selector');
    expect(result.processingStats.strategyWinner).toMatch(/generic|fallback-content-selection/);
    expect(result.processingStats.fallbacksUsed).toContain('reddit-adapter:null');
    expect(result.processingStats.qualityScore).toBeGreaterThan(45);
  });

  it('marks title-only content as incomplete (PR1 completeness gate)', async () => {
    // TASK #10.3: Add a fixture with title/metadata only and assert PR1 marks it incomplete.
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Only a Title</title></head>
        <body>
          <h1>Only a Title</h1>
          <div class="metadata">Posted by u/user 2 hours ago</div>
          <div class="footer">Footer links</div>
        </body>
      </html>
    `;

    const result = await OfflineModeManager.processContent(
      html,
      'https://example.com/title-only',
      'Only a Title',
      baseConfig
    );

    // Should score low due to the < 80 chars penalty
    expect(result.processingStats.qualityScore).toBeLessThan(60);
  });

  it('demotes Reddit adapter when it returns title-only content', async () => {
    // TASK #13: Reddit adapter returns title-only -> generic visible body wins.
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Reddit Title Only Page</title></head>
        <body>
          <shreddit-post>
             <h1>Title Only In Shreddit</h1>
          </shreddit-post>
          <main>
             <article>
                <h2>Real Content Below</h2>
                <p>${'This substantial content should win because the Reddit adapter content is too short. '.repeat(20)}</p>
             </article>
          </main>
        </body>
      </html>
    `;
    const url = 'https://www.reddit.com/r/test/comments/456';

    // Mock Reddit extractor to return title-only
    vi.spyOn(RedditShadowExtractor, 'extractContent').mockReturnValue({
      content: '<h1>Title Only In Shreddit</h1>',
      metadata: { strategy: 'shadow-dom', qualityScore: 30, noiseFiltered: false, shadowDomDepth: 0 }
    });
    
    // Force Readability failure
    vi.spyOn(ReadabilityConfigManager, 'extractContent').mockResolvedValue({
      content: '',
    });

    const result = await OfflineModeManager.processContent(
      html,
      url,
      'Reddit Title Only Page',
      baseConfig
    );

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('Real Content Below');
    expect(result.processingStats.fallbacksUsed).toContain('reddit-adapter:incomplete');
    expect(result.processingStats.strategyWinner).toMatch(/generic|fallback-content-selection/);
  });

  it('chooses article over main when article is more focused', async () => {
    // Test for stricter noise handling / candidate selection
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Focused Article</title></head>
        <body>
          <main>
            <nav>Noise links <ul>${'<li>Link</li>'.repeat(10)}</ul></nav>
            <article>
              <h2>The Real Meat</h2>
              <p>${'Focused content inside article tag. '.repeat(10)}</p>
            </article>
            <aside>More noise <ul>${'<li>Link</li>'.repeat(10)}</ul></aside>
          </main>
        </body>
      </html>
    `;

    const result = await OfflineModeManager.processContent(
      html,
      'https://example.com/focused',
      'Focused Article',
      baseConfig
    );

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('The Real Meat');
    // It should prefer the article candidate over the main candidate if main contains noise
    expect(result.processingStats.strategyWinner).toContain('generic:article');
  });
});