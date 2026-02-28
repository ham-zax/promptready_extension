import { beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { OfflineModeManager } from '../core/offline-mode-manager';

interface FixtureCase {
  name: string;
  fixtureFile: string;
  url: string;
  title: string;
  requiredSnippets: string[];
  forbiddenSnippets: string[];
  minQualityScore?: number;
  maxSuspiciousSingleTokenLines?: number;
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
  {
    name: 'promptready landing page',
    fixtureFile: 'promptready-homepage.html',
    url: 'https://promptready.app/',
    title: 'PromptReady - One-click clean Markdown from any page',
    requiredSnippets: [
      'Cleaner input. Better model output.',
      'Preserves code fences',
      'See the transformation in one pass',
      'Trusted by builders, researchers,',
      'Simple pricing',
      'Save 40% today!',
      'Subscribe to our newsletter | Related links | Footer text',
      'Source: example.com/rag-guide',
    ],
    forbiddenSnippets: [
      'ANNOYING POPUP AD',
      'Accept all 500 tracking cookies to continue',
    ],
    minQualityScore: 50,
    maxSuspiciousSingleTokenLines: 3,
  },
  {
    name: 'mindsdb homepage',
    fixtureFile: 'mindsdb-homepage.html',
    url: 'https://mindsdb.com/',
    title: 'AI Analytics & Business Intelligence for any Data Source',
    requiredSnippets: [
      'AI Analytics & Business Intelligence for any Data Source',
      'From data to insights at the speed of thought.',
      'Decision-Making in Real-Time',
    ],
    forbiddenSnippets: [
      'Privacy Policy',
      'Cookie Policy',
      'Legal Documents',
      'framerusercontent.com/images/',
      '<path d=',
      'stroke-width=',
    ],
    minQualityScore: 45,
    maxSuspiciousSingleTokenLines: 10,
  },
  {
    name: 'reddit listing page',
    fixtureFile: 'reddit-programming-top.html',
    url: 'https://old.reddit.com/r/programming/top/?t=month',
    title: 'top scoring links : programming',
    requiredSnippets: [
      'Anthropic: AI assisted coding',
      'Microsoft Has Killed Widgets Six Times',
      'submitted 26 days ago by',
    ],
    forbiddenSnippets: [
      'limit my search to r/programming',
      'advanced search: by author, subreddit',
      'see the search faq for details',
      'Welcome to Reddit,the front page of the internet',
      '[past hour](https://old.reddit.com/r/programming/top/)',
    ],
    minQualityScore: 40,
    maxSuspiciousSingleTokenLines: 8,
  },
  {
    name: 'github trending page',
    fixtureFile: 'github-trending.html',
    url: 'https://github.com/trending',
    title: 'Trending repositories on GitHub today',
    requiredSnippets: [
      '# Trending',
      'See what the GitHub community is most excited about today.',
      'D4Vinci / Scrapling',
    ],
    forbiddenSnippets: [
      '[Skip to content](#start-of-content)',
      '[Sponsor](',
      '![@D4Vinci](https://avatars.githubusercontent.com',
      'Built by [',
      '[](/',
    ],
    minQualityScore: 40,
    maxSuspiciousSingleTokenLines: 15,
  },
];

const dumpDir = process.env.OFFLINE_DUMP_DIR ? path.resolve(process.env.OFFLINE_DUMP_DIR) : null;

function readFixtureHtml(fileName: string): string {
  const fixturePath = path.join(process.cwd(), 'tests', 'fixtures', 'offline-corpus', fileName);
  return readFileSync(fixturePath, 'utf8');
}

function maybeDumpMarkdown(markdown: string, fileBaseName: string): void {
  if (!dumpDir) return;
  mkdirSync(dumpDir, { recursive: true });
  writeFileSync(path.join(dumpDir, `${fileBaseName}.md`), markdown, 'utf8');
}

function toDumpBaseName(fixture: FixtureCase): string {
  const base = fixture.fixtureFile.replace(/\.[^.]+$/, '');
  return base.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function normalizeDynamicMetadata(markdown: string): string {
  return markdown
    .replace(/^> Captured: .+$/m, '> Captured: <timestamp>')
    .replace(/^> Hash: .+$/m, '> Hash: <hash>');
}

function collectSuspiciousSingleTokenLines(markdown: string): string[] {
  const lines = markdown.split('\n');
  return lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return false;
    }
    if (/^(>|#|-|\*|\d+\.)/.test(trimmed)) {
      return false;
    }
    if (trimmed.length < 2 || trimmed.length > 24) {
      return false;
    }
    return /^[A-Za-z][A-Za-z-]*$/.test(trimmed);
  });
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
      expect(result.processingStats.qualityScore).toBeGreaterThanOrEqual(fixture.minQualityScore ?? 0);

      for (const snippet of fixture.requiredSnippets) {
        expect(result.markdown).toContain(snippet);
      }
      for (const snippet of fixture.forbiddenSnippets) {
        expect(result.markdown).not.toContain(snippet);
      }
      if (fixture.maxSuspiciousSingleTokenLines !== undefined) {
        const suspiciousLines = collectSuspiciousSingleTokenLines(result.markdown);
        expect(suspiciousLines.length).toBeLessThanOrEqual(fixture.maxSuspiciousSingleTokenLines);
      }

      const normalized = normalizeDynamicMetadata(result.markdown);
      if (process.env.UPDATE_FIXTURE_SNAPSHOTS === '1') {
        expect(normalized).toMatchSnapshot();
      }

      maybeDumpMarkdown(result.markdown, toDumpBaseName(fixture));
    }, 20000);
  }
});
