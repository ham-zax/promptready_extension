import { afterEach, describe, expect, it, vi } from 'vitest';
import { OfflineModeManager } from '../core/offline-mode-manager';
import { ReadabilityConfigManager } from '../core/readability-config';

describe('Reddit Thread Fidelity', () => {
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
    },
  };

  const url = 'https://www.reddit.com/r/ClaudeAI/comments/1t1o43w/post_slug/';

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function redditPayload() {
    return [
      {
        data: {
          children: [
            {
              kind: 't3',
              data: {
                id: 't3_1t1o43w',
                title: 'I gave Claude Code a coworker',
                author: 'op_user',
                score: 120,
                created_utc: 1_767_200_000,
                selftext: [
                  'Was hitting my weekly Pro limit by Wednesday every single week.',
                  'Results after 3 weeks: 1. Haven\'t hit limits once 2. Kimi total spend: $0.38 3. Documentation updates went from ~5000 tokens to ~200 tokens',
                  'Wrote up the full implementation with code: [https://example.com/full-setup](https://example.com/full-setup)',
                ].join('\n\n'),
              },
            },
          ],
        },
      },
      {
        data: {
          children: [
            {
              kind: 't1',
              data: {
                id: 'c1',
                author: 'summary_user',
                score: 44,
                created_utc: 1_767_201_000,
                body: "**TL;DR of the discussion generated automatically after 80 comments.** The consensus says this delegation pattern works.",
                replies: '',
              },
            },
            {
              kind: 't1',
              data: {
                id: 'c2',
                author: 'example',
                score: 120,
                created_utc: 1_767_202_000,
                body: 'Top comment text here.',
                replies: {
                  data: {
                    children: [
                      {
                        kind: 't1',
                        data: {
                          id: 'c2_r1',
                          author: 'another',
                          score: 22,
                          created_utc: 1_767_203_000,
                          body: 'Nested reply text here.',
                          replies: {
                            data: {
                              children: [
                                {
                                  kind: 't1',
                                  data: {
                                    id: 'c2_r1_r1',
                                    author: 'third',
                                    score: 5,
                                    created_utc: 1_767_204_000,
                                    body: 'Deeper reply text here.',
                                    replies: '',
                                  },
                                },
                              ],
                            },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
            {
              kind: 't1',
              data: {
                id: 'c3',
                author: 'RemindMeBot',
                score: 1,
                created_utc: 1_767_205_000,
                body: 'I will be messaging you in 7 days on 2026-05-09 to remind you of this link.',
                replies: '',
              },
            },
          ],
        },
      },
    ];
  }

  async function processFixture() {
    vi.spyOn(ReadabilityConfigManager, 'extractContent').mockResolvedValue({
      content: '<h1>I gave Claude Code a coworker</h1><p>Skip to Navigation Skip to Right Sidebar</p>',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => redditPayload(),
    }));

    return OfflineModeManager.processContent(
      `
        <main>
          <h1>I gave Claude Code a coworker</h1>
          <a href="#left-sidebar-container">Skip to Navigation</a>
          <a href="#right-sidebar-container">Skip to Right Sidebar</a>
        </main>
      `,
      url,
      'I gave Claude Code a coworker',
      baseConfig
    );
  }

  it('defaults Reddit JSON recovery to a full-thread candidate', async () => {
    const result = await processFixture();

    expect(result.processingStats.strategyWinner).toBe('reddit:thread');
    expect(result.markdown).toContain('Was hitting my weekly Pro limit');
    expect(result.markdown).toContain('## Comments');
    expect(result.markdown).toContain('Top comment text here.');
    expect(result.markdown).toContain('Nested reply text here.');
    expect(result.markdown).not.toContain('Skip to Navigation');
  });

  it('preserves nested replies with readable hierarchy', async () => {
    const result = await processFixture();

    expect(result.markdown).toContain('### u/example · 120 points');
    expect(result.markdown).toContain('#### Reply from u/another · 22 points');
    expect(result.markdown).toContain('##### Reply from u/third · 5 points');
  });

  it('preserves auto summaries and bot comments instead of filtering them', async () => {
    const result = await processFixture();

    expect(result.markdown).toContain('### Reddit summary · generated automatically');
    expect(result.markdown).toContain('TL;DR of the discussion generated automatically');
    expect(result.markdown).toContain('### u/RemindMeBot · 1 point');
    expect(result.markdown).toContain('I will be messaging you in 7 days');
  });

  it('formats inline numbered lists in the main post as real Markdown lists', async () => {
    const result = await processFixture();

    expect(result.markdown).toContain([
      'Results after 3 weeks:',
      '',
      '1. Haven\'t hit limits once',
      '2. Kimi total spend: \\$0.38',
      '3. Documentation updates went from ~5000 tokens to ~200 tokens',
    ].join('\n'));
  });

  it('exposes Reddit post, comments, and thread candidates in diagnostics', async () => {
    const result = await processFixture();
    const traces = result.processingStats.extractionDiagnostics?.candidateTraces || [];

    expect(traces).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'reddit:post' }),
      expect.objectContaining({ source: 'reddit:comments' }),
      expect.objectContaining({ source: 'reddit:thread', selected: true }),
    ]));
    expect(result.processingStats.extractionDiagnostics?.redditThread).toEqual(expect.objectContaining({
      redditMode: 'full_thread_default',
      postCaptured: true,
      commentCount: 5,
      maxDepth: 2,
      candidates: ['reddit:post', 'reddit:comments', 'reddit:thread'],
      winner: 'reddit:thread',
      autoSummaryDetected: true,
      botLikeCommentsDetected: 1,
      contentRemoved: false,
    }));
  });
});
