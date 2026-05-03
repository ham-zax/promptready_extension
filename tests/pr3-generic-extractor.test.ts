import { describe, it, expect, vi, afterEach } from 'vitest';
import { safeParseHTML } from '../lib/dom-utils';
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
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('normalizes Reddit JSON fallback URLs deterministically', () => {
    const buildUrl = (OfflineModeManager as any).buildRedditJsonUrl.bind(OfflineModeManager);

    expect(buildUrl('https://www.reddit.com/r/test/comments/abc/post_slug'))
      .toBe('https://www.reddit.com/r/test/comments/abc/post_slug/.json');
    expect(buildUrl('https://www.reddit.com/r/test/comments/abc/post_slug/'))
      .toBe('https://www.reddit.com/r/test/comments/abc/post_slug/.json');
    expect(buildUrl('https://www.reddit.com/r/test/comments/abc/post_slug/.json'))
      .toBe('https://www.reddit.com/r/test/comments/abc/post_slug/.json');
    expect(buildUrl('https://www.reddit.com/r/test/comments/abc/post_slug/?utm_source=x#comments'))
      .toBe('https://www.reddit.com/r/test/comments/abc/post_slug/.json');
    expect(buildUrl('https://www.reddit.com/r/test/')).toBeNull();
    expect(buildUrl('https://example.com/r/test/comments/abc/post_slug/')).toBeNull();
  });

  it('aborts Reddit JSON fallback fetches that exceed the bounded timeout', async () => {
    vi.useFakeTimers();
    const html = `
      <h1>Title only</h1>
      <a href="#left-sidebar-container">Skip to Navigation</a>
      <a href="#right-sidebar-container">Skip to Right Sidebar</a>
    `;
    const doc = safeParseHTML(html);
    if (!doc) throw new Error('fixture parse failed');
    let abortSignal: AbortSignal | undefined;
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      abortSignal = init?.signal as AbortSignal | undefined;
      return new Promise((_resolve, reject) => {
        abortSignal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const candidatePromise = (OfflineModeManager as any).fetchRedditJsonFallbackCandidate(
      doc,
      'https://www.reddit.com/r/test/comments/abc/post_slug/'
    );
    await vi.advanceTimersByTimeAsync(2600);

    await expect(candidatePromise).resolves.toBeNull();
    expect(abortSignal?.aborted).toBe(true);
  });

  it('does not let stale cached Reddit shell output bypass JSON recovery', async () => {
    await OfflineModeManager.clearCache();
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Reddit Shell</title></head>
        <body>
          <h1>Reddit Shell</h1>
          <a href="#left-sidebar-container">Skip to Navigation</a>
          <a href="#right-sidebar-container">Skip to Right Sidebar</a>
        </body>
      </html>
    `;
    const url = 'https://www.reddit.com/r/test/comments/cachecase/post_slug/';
    const cacheConfig = {
      ...baseConfig,
      performance: {
        ...baseConfig.performance,
        enableCaching: true,
      },
    };

    vi.spyOn(ReadabilityConfigManager, 'extractContent').mockResolvedValue({
      content: '<h1>Reddit Shell</h1>',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const stale = await OfflineModeManager.processContent(html, url, 'Reddit Shell', cacheConfig);
    expect(stale.markdown).not.toContain('Recovered body from Reddit JSON');

    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([
        {
          data: {
            children: [
              {
                kind: 't3',
                data: {
                  title: 'Reddit Shell',
                  selftext: 'Recovered body from Reddit JSON with enough detail to prove the stale shell cache was bypassed and the fallback ran during the second processing attempt.',
                },
              },
            ],
          },
        },
      ]),
    }));
    vi.spyOn(ReadabilityConfigManager, 'extractContent').mockResolvedValue({
      content: '<h1>Reddit Shell</h1>',
    });

    const recovered = await OfflineModeManager.processContent(html, url, 'Reddit Shell', cacheConfig);
    expect(recovered.markdown).toContain('Recovered body from Reddit JSON');
    expect(recovered.processingStats.fallbacksUsed).toContain('reddit-json-fallback');
  });

  it('recovers Reddit post body from same-page JSON when captured snapshot is only title and skip navigation', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>I gave Claude Code a $0.02/call coworker and stopped hitting Pro limits</title></head>
        <body>
          <h1>I gave Claude Code a $0.02/call coworker and stopped hitting Pro limits — here's the full setup : r/ClaudeAI</h1>
          <a href="#left-sidebar-container">Skip to Navigation</a>
          <a href="#right-sidebar-container">Skip to Right Sidebar</a>
        </body>
      </html>
    `;
    const url = 'https://www.reddit.com/r/ClaudeAI/comments/1t1o43w/i_gave_claude_code_a_002call_coworker_and_stopped/';
    const redditBody = 'Was hitting my weekly Pro limit by Wednesday, so I built a small coworker setup that handles cheap calls while Claude Code keeps the important work. The setup uses a simple command bridge, a budget guard, and repeatable prompts so the expensive model only sees the decisions that need it.';

    vi.spyOn(ReadabilityConfigManager, 'extractContent').mockResolvedValue({
      content: '<h1>I gave Claude Code a $0.02/call coworker and stopped hitting Pro limits</h1>',
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([
        {
          data: {
            children: [
              {
                kind: 't3',
                data: {
                  title: 'I gave Claude Code a $0.02/call coworker and stopped hitting Pro limits',
                  selftext: redditBody,
                },
              },
            ],
          },
        },
      ]),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await OfflineModeManager.processContent(
      html,
      url,
      'I gave Claude Code a $0.02/call coworker and stopped hitting Pro limits',
      baseConfig
    );

    expect(fetchMock).toHaveBeenCalledWith(`${url}.json`, expect.objectContaining({ method: 'GET' }));
    expect(result.markdown).toContain('Was hitting my weekly Pro limit by Wednesday');
    expect(result.markdown).not.toContain('Skip to Navigation');
    expect(result.processingStats.fallbacksUsed).toContain('reddit-json-fallback');
    expect(result.processingStats.strategyWinner).toMatch(/reddit-json|fallback-content-selection/);
    expect(result.processingStats.qualityScore).toBeGreaterThanOrEqual(60);
  });

  it('rescues incomplete Reddit shell markdown with forced JSON recovery after quality scoring', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Title only</title></head>
        <body>
          <main>
            <h1>Title only</h1>
            <a href="#left-sidebar-container">Skip to Navigation</a>
            <a href="#right-sidebar-container">Skip to Right Sidebar</a>
            <section class="post-shell">
              ${'Hydrated shell text that is long enough to suppress the normal shell-only JSON candidate path. '.repeat(10)}
            </section>
          </main>
        </body>
      </html>
    `;
    const url = 'https://www.reddit.com/r/ClaudeAI/comments/1t1o43w/post_slug/';
    const config = {
      ...baseConfig,
      fallbacks: {
        ...baseConfig.fallbacks,
        enableReadabilityFallback: false,
      },
    };

    vi.spyOn(ReadabilityConfigManager, 'extractContent').mockResolvedValue({
      content: `
        <h1>Title only</h1>
        <p>Skip to Navigation Skip to Right Sidebar</p>
      `,
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([
        {
          data: {
            children: [
              {
                kind: 't3',
                data: {
                  title: 'Title only',
                  selftext: "Was hitting my weekly Pro limit by Wednesday every single week. Built a simple pattern using cheap model delegation. Results after 3 weeks: Haven't hit limits once. Kimi total spend: $0.38.",
                },
              },
            ],
          },
        },
      ]),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await OfflineModeManager.processContent(html, url, 'Title only', config);

    expect(result.markdown).toContain('Was hitting my weekly Pro limit');
    expect(result.markdown).toContain('Kimi total spend');
    expect(result.markdown).not.toContain('Skip to Navigation');
    expect(result.processingStats.strategyWinner).toBe('reddit-json');
    expect(result.processingStats.fallbacksUsed).toContain('quality-gate:reddit-shell');
    expect(result.processingStats.fallbacksUsed).toContain('quality-gate-recovery:reddit-json');
    expect(result.processingStats.extractionDiagnostics?.candidateTraces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'reddit-json',
          selected: true,
        }),
      ])
    );
    expect(result.processingStats.qualityScore).toBeGreaterThanOrEqual(60);
  });

  it('extracts Reddit post body from schema articleBody DOM before shell candidates', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Title only</title></head>
        <body>
          <main id="main-content">
            <reddit-skip-to-sidebar>
              <a href="#left-sidebar-container">Skip to Navigation</a>
              <a href="#right-sidebar-container">Skip to Right Sidebar</a>
            </reddit-skip-to-sidebar>

            <shreddit-post post-title="Title only">
              <h1 slot="title">Title only</h1>

              <shreddit-post-text-body slot="text-body">
                <div slot="text-body">
                  <div id="t3_test-post-rtjson-content" property="schema:articleBody">
                    <p>Was hitting my weekly Pro limit by Wednesday every single week.</p>
                    <p>Built a simple pattern using cheap model delegation.</p>
                    <ol>
                      <li><p>Haven't hit limits once</p></li>
                      <li><p>Kimi total spend: $0.38</p></li>
                    </ol>
                  </div>
                </div>
              </shreddit-post-text-body>
            </shreddit-post>
          </main>
        </body>
      </html>
    `;

    vi.spyOn(ReadabilityConfigManager, 'extractContent').mockResolvedValue({
      content: '<h1>Title only</h1>',
    });

    const result = await OfflineModeManager.processContent(
      html,
      'https://www.reddit.com/r/ClaudeAI/comments/1t1o43w/post_slug/',
      'Title only',
      baseConfig
    );

    expect(result.markdown).toContain('Was hitting my weekly Pro limit');
    expect(result.markdown).toContain('Kimi total spend');
    expect(result.markdown).toContain('0.38');
    expect(result.markdown).not.toContain('Skip to Navigation');
    expect(result.processingStats.fallbacksUsed).toContain('reddit-dom-body');
    expect(result.processingStats.extractionDiagnostics?.candidateTraces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'reddit:dom-body',
          selected: true,
        }),
      ])
    );
  });

  it('adopts reddit:dom-body over readability shell in final output', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Title only</title></head>
        <body>
          <main id="main-content">
            <reddit-skip-to-sidebar>
              <a href="#left-sidebar-container">Skip to Navigation</a>
              <a href="#right-sidebar-container">Skip to Right Sidebar</a>
            </reddit-skip-to-sidebar>

            <shreddit-post post-title="Title only">
              <h1 slot="title">Title only</h1>

              <shreddit-post-text-body slot="text-body">
                <div slot="text-body">
                  <div id="t3_test-post-rtjson-content" property="schema:articleBody">
                    <p>Was hitting my weekly Pro limit by Wednesday every single week.</p>
                    <p>Built a simple pattern using cheap model delegation.</p>
                    <ol>
                      <li><p>Haven't hit limits once</p></li>
                      <li><p>Kimi total spend: $0.38</p></li>
                    </ol>
                  </div>
                </div>
              </shreddit-post-text-body>
            </shreddit-post>
          </main>
        </body>
      </html>
    `;

    vi.spyOn(ReadabilityConfigManager, 'extractContent').mockResolvedValue({
      content: `
        <h1>Title only</h1>
        <p>${'Skip to Navigation Skip to Right Sidebar '.repeat(20)}</p>
      `,
    });

    const result = await OfflineModeManager.processContent(
      html,
      'https://www.reddit.com/r/ClaudeAI/comments/1t1o43w/post_slug/',
      'Title only',
      baseConfig
    );

    expect(result.markdown).toContain('Was hitting my weekly Pro limit');
    expect(result.markdown).toContain('Kimi total spend');
    expect(result.markdown).toContain('0.38');
    expect(result.markdown).not.toContain('Skip to Navigation');
    expect(result.processingStats.strategyWinner).toBe('reddit:dom-body');
    expect(result.processingStats.fallbacksUsed).toContain('reddit-dom-body');
    expect(result.processingStats.fallbacksUsed).toContain('readability-ranked-fallback');
    expect(result.processingStats.fallbacksUsed).toContain('readability-fallback-source:reddit:dom-body');

    const selectedTrace = result.processingStats.extractionDiagnostics?.candidateTraces.find(t => t.selected);
    expect(selectedTrace?.source).toBe('reddit:dom-body');
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

  it('does not record reddit-dom-body for non-Reddit schema articleBody pages', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Article</title></head>
        <body>
          <main>
            <article>
              <div property="schema:articleBody">
                <p>${'This normal article body uses schema articleBody without being a Reddit page. '.repeat(10)}</p>
              </div>
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
      'https://example.com/schema-article',
      'Article',
      baseConfig
    );

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('This normal article body uses schema articleBody');
    expect(result.processingStats.fallbacksUsed).not.toContain('reddit-dom-body');
    expect(result.processingStats.strategiesAttempted || []).not.toContain('reddit-adapter');
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
