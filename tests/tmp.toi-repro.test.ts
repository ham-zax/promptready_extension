import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { OfflineModeManager } from '../core/offline-mode-manager';

describe('tmp toi repro', () => {
  it('extracts from saved TOI html', async () => {
    const html = fs.readFileSync('/tmp/toi_liveblog.html', 'utf8');
    const res = await OfflineModeManager.processContent(
      html,
      'https://timesofindia.indiatimes.com/india/pm-modi-israel-visit-live-updates-knesset-parliament-netanyahu-india-israel-address-defence-agreement-latest-news/liveblog/128776409.cms',
      ''
    );

    console.log('SUCCESS', res.success);
    console.log('WARNINGS', JSON.stringify(res.warnings));
    console.log('FALLBACKS', JSON.stringify(res.processingStats.fallbacksUsed));
    console.log('QUALITY', res.processingStats.qualityScore);

    const first = res.markdown.split('\n').slice(0, 100).join('\n');
    console.log('---MARKDOWN_START---');
    console.log(first);
    console.log('---MARKDOWN_END---');

    expect(res.success).toBe(true);
  });
});
