import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { OfflineModeManager } from '../core/offline-mode-manager';

interface NewsFixtureCase {
  name: string;
  fixtureFile: string;
  url: string;
  title: string;
  requiredSnippets: string[];
  forbiddenSnippets?: string[];
  minQualityScore: number;
  requireTimestampInOutput?: boolean;
}

const newsFixtures: NewsFixtureCase[] = [
  {
    name: 'times of india liveblog',
    fixtureFile: 'toi-liveblog.html',
    url: 'https://timesofindia.indiatimes.com/india/pm-modi-israel-visit-live-updates-knesset-parliament-netanyahu-india-israel-address-defence-agreement-latest-news/liveblog/128776409.cms',
    title: 'PM Modi Israel Visit Live',
    requiredSnippets: ['PM Modi Israel Visit Live', 'Israel'],
    forbiddenSnippets: ['- [News](', '- [India News](', '&mdash; ANI'],
    minQualityScore: 45,
    requireTimestampInOutput: true,
  },
  {
    name: 'bbc world article',
    fixtureFile: 'bbc-world-article.html',
    url: 'https://www.bbc.com/news/articles/cx2g3vmde0eo',
    title: 'Mexico drug violence',
    requiredSnippets: ['Mexico drug violence', 'Sinaloa'],
    minQualityScore: 55,
  },
  {
    name: 'guardian world article',
    fixtureFile: 'guardian-world-article.html',
    url: 'https://www.theguardian.com/global-development/2026/feb/25/zambia-us-health-aid-deal-exploitation-mining-concessions-data-sharing-targets',
    title: 'US accused over proposed Zambian health aid deal',
    requiredSnippets: ['Zambian', 'health aid'],
    minQualityScore: 55,
  },
  {
    name: 'indian express article',
    fixtureFile: 'indianexpress-article.html',
    url: 'https://indianexpress.com/article/india/bilateral-talks-today-pacts-on-table-pm-modi-in-israel-to-strengthen-ties-10552207/',
    title: 'PM Modi in Israel to strengthen ties',
    requiredSnippets: ['PM Modi', 'Israel'],
    minQualityScore: 55,
  },
  {
    name: 'al jazeera news article',
    fixtureFile: 'aljazeera-news-article.html',
    url: 'https://www.aljazeera.com/news/2026/2/25/cuban-border-agents-fire-upon-florida-tagged-speedboat-killing-four',
    title: 'Cuban border agents fire upon Florida-tagged speedboat, killing four',
    requiredSnippets: ['Cuban border agents', 'Florida-tagged speedboat'],
    minQualityScore: 55,
  },
];

function readNewsFixtureHtml(fileName: string): string {
  const fixturePath = path.join(process.cwd(), 'tests', 'fixtures', 'offline-corpus', 'news', fileName);
  return readFileSync(fixturePath, 'utf8');
}

describe('Offline news fixture regression', () => {
  beforeEach(async () => {
    await OfflineModeManager.clearCache();
  });

  for (const fixture of newsFixtures) {
    it(`extracts ${fixture.name} with publish metadata and low chrome leakage`, async () => {
      const html = readNewsFixtureHtml(fixture.fixtureFile);
      const result = await OfflineModeManager.processContent(html, fixture.url, fixture.title, {
        performance: {
          maxContentLength: 1_000_000,
          enableCaching: false,
          chunkSize: 100_000,
        },
      });

      if (process.env.DEBUG_NEWS_FIXTURE === '1') {
        console.log(`[offline-news-debug] ${fixture.name} quality=${result.processingStats.qualityScore} warnings=${result.warnings.length} errors=${result.errors.length}`);
        console.log(result.markdown.slice(0, 1600));
      }

      expect(result.success).toBe(true);
      expect(result.markdown.length).toBeGreaterThan(500);
      expect(result.processingStats.qualityScore).toBeGreaterThanOrEqual(fixture.minQualityScore);
      expect(result.markdown).toContain('> Source:');
      expect(result.markdown).toContain('> Captured:');
      expect(result.markdown).not.toMatch(/<script\b/i);
      expect(result.markdown).not.toContain('Accept all 500 tracking cookies to continue');

      for (const snippet of fixture.requiredSnippets) {
        expect(result.markdown).toContain(snippet);
      }
      for (const snippet of fixture.forbiddenSnippets || []) {
        expect(result.markdown).not.toContain(snippet);
      }

      expect(Boolean(result.metadata.publishedAt || result.metadata.publishedAtText)).toBe(true);
      if (fixture.requireTimestampInOutput) {
        expect(result.markdown).toMatch(/\b\d{1,2}:\d{2}\b/);
      }
    });
  }
});
