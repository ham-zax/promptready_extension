import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { OfflineModeManager } from '../core/offline-mode-manager';

interface FixtureCase {
  name: string;
  fixtureFile: string;
  url: string;
  title: string;
  requiredSnippets: string[];
  forbiddenSnippets: string[];
  minQualityScore: number;
}

const fixtureCases: FixtureCase[] = [
  {
    name: 'wikipedia-style article',
    fixtureFile: 'wikipedia-prompt-engineering.html',
    url: 'https://en.wikipedia.org/wiki/Prompt_engineering',
    title: 'Prompt engineering',
    requiredSnippets: [
      'Prompt engineering',
      'Context engineering',
      'Common prompting techniques include',
      '# Terminology',
      '## Prompt',
    ],
    forbiddenSnippets: ['WIKI_NAVIGATION_NOISE_TOKEN', 'WIKI_FOOTER_NOISE_TOKEN'],
    minQualityScore: 68,
  },
  {
    name: 'technical docs page',
    fixtureFile: 'docs-sdk-quickstart.html',
    url: 'https://openrouter.ai/docs/quickstart',
    title: 'OpenRouter Quickstart',
    requiredSnippets: [
      'Quickstart',
      'npm install @openrouter/sdk',
      "import { OpenRouter } from '@openrouter/sdk';",
      'https://openrouter.ai/api/v1/chat/completions',
      '```',
    ],
    forbiddenSnippets: ['DOCS_TOP_NAV_NOISE_TOKEN', 'DOCS_SIDEBAR_NOISE_TOKEN'],
    minQualityScore: 65,
  },
  {
    name: 'news article page',
    fixtureFile: 'news-open-data-program.html',
    url: 'https://blog.cloudflare.com/vinext/',
    title: 'How we rebuilt Next.js with AI in one week',
    requiredSnippets: [
      'How we rebuilt Next.js with AI in one week',
      'cost about \\$1,100 in tokens.',
      'vinext deploy',
      '# The Next.js deployment problem',
    ],
    forbiddenSnippets: ['NEWS_NAVIGATION_NOISE_TOKEN', 'RELATED_NEWS_NOISE_TOKEN'],
    minQualityScore: 70,
  },
  {
    name: 'forum thread page',
    fixtureFile: 'forum-prompt-strategy-thread.html',
    url: 'https://en.wikipedia.org/wiki/Talk:Prompt_engineering',
    title: 'Talk:Prompt engineering',
    requiredSnippets: [
      'Talk:Prompt engineering',
      'Restrictions of a Context Window',
      'Context Window (or simply Context Length)',
      'Maximum Fixed Allocation of Tokens',
    ],
    forbiddenSnippets: ['FORUM_SIDEBAR_AD_TOKEN'],
    minQualityScore: 60,
  },
];

function readFixtureHtml(fileName: string): string {
  const fixturePath = path.join(process.cwd(), 'tests', 'fixtures', 'offline-corpus', fileName);
  return readFileSync(fixturePath, 'utf8');
}

function normalizeDynamicMetadata(markdown: string): string {
  return markdown
    .replace(/^> Captured: .+$/m, '> Captured: <timestamp>')
    .replace(/^> Hash: .+$/m, '> Hash: <hash>');
}

describe('Offline extractor fixture corpus regression', () => {
  beforeEach(async () => {
    await OfflineModeManager.clearCache();
  });

  for (const fixture of fixtureCases) {
    it(`extracts ${fixture.name} with quality gate`, async () => {
      const html = readFixtureHtml(fixture.fixtureFile);
      const result = await OfflineModeManager.processContent(html, fixture.url, fixture.title, {
        performance: {
          maxContentLength: 1_000_000,
          enableCaching: false,
          chunkSize: 100_000,
        },
      });

      expect(result.success).toBe(true);
      expect(result.markdown.length).toBeGreaterThan(200);
      expect(result.processingStats.readabilityTime).toBeGreaterThan(0);
      expect(result.processingStats.qualityScore).toBeGreaterThanOrEqual(fixture.minQualityScore);

      for (const snippet of fixture.requiredSnippets) {
        expect(result.markdown).toContain(snippet);
      }
      for (const snippet of fixture.forbiddenSnippets) {
        expect(result.markdown).not.toContain(snippet);
      }

      const normalized = normalizeDynamicMetadata(result.markdown);
      expect(normalized).toMatchSnapshot();
    });
  }
});
