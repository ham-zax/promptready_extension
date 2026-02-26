import { beforeEach, describe, expect, it } from 'vitest';
import { OfflineModeManager } from '../core/offline-mode-manager';

describe('Offline selection metadata enrichment', () => {
  beforeEach(async () => {
    await OfflineModeManager.clearCache();
  });

  it('keeps publish timestamp when selection HTML omits it but metadataHtml provides it', async () => {
    const selectionHtml = [
      '<article>',
      '<h1>PM Modi Israel Visit Live</h1>',
      ...Array.from({ length: 70 }).map(() => '<p>PM Modi will meet Israeli President Isaac Herzog in Jerusalem.</p>'),
      '</article>',
    ].join('');

    const metadataHtml = [
      '<!doctype html>',
      '<html>',
      '<head>',
      '<meta property="article:published_time" content="2026-02-25T14:43:57+05:30" />',
      '</head>',
      '<body>',
      '<time datetime="2026-02-25T14:43:57+05:30">14:43 (IST) Feb 25</time>',
      '</body>',
      '</html>',
    ].join('');

    const result = await OfflineModeManager.processContent(
      selectionHtml,
      'https://timesofindia.indiatimes.com/india/pm-modi-israel-visit-live-updates-knesset-parliament-netanyahu-india-israel-address-defence-agreement-latest-news/liveblog/128776409.cms',
      'PM Modi Israel Visit Live',
      {
        performance: {
          maxContentLength: 1_000_000,
          enableCaching: false,
          chunkSize: 100_000,
        },
      },
      metadataHtml
    );

    expect(result.success).toBe(true);
    expect(Boolean(result.metadata.publishedAt || result.metadata.publishedAtText)).toBe(true);
    expect(result.markdown).toMatch(/> Published:\s+\S[^\n]*14:43/i);
  });
});
