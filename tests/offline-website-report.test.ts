import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OfflineModeManager } from '../core/offline-mode-manager';
import {
  assertOfflineWebsiteResult,
  loadOfflineWebsiteManifest,
  readOfflineWebsiteFixture,
} from './helpers/offline-website-harness';

interface WebsiteReportEntry {
  id: string;
  name: string;
  url: string;
  fixturePath: string;
  status: 'pass' | 'fail';
  qualityScore?: number;
  pageType?: string;
  strategyWinner?: string;
  markdown?: string;
  error?: string;
}

const reportPath = path.resolve(
  process.cwd(),
  process.env.OFFLINE_WEBSITE_REPORT_PATH || 'output/offline-website-corpus-report.md'
);

function renderReport(entries: WebsiteReportEntry[]): string {
  const generatedAt = new Date().toISOString();
  const passed = entries.filter((entry) => entry.status === 'pass').length;
  const failed = entries.length - passed;
  const lines = [
    '# Offline Website Corpus Report',
    '',
    `Generated: ${generatedAt}`,
    `Cases: ${entries.length}`,
    `Passed: ${passed}`,
    `Failed: ${failed}`,
    '',
    'This report is for manual review. It is generated from checked-in fixture HTML and should not be committed by default.',
    '',
    '## Summary',
    '',
    '| Status | ID | Name | Quality | Page Type | Strategy |',
    '| --- | --- | --- | --- | --- | --- |',
  ];

  for (const entry of entries) {
    lines.push(
      `| ${entry.status} | ${entry.id} | ${entry.name} | ${entry.qualityScore ?? ''} | ${entry.pageType ?? ''} | ${entry.strategyWinner ?? ''} |`
    );
  }

  for (const entry of entries) {
    lines.push(
      '',
      `## ${entry.id}: ${entry.name}`,
      '',
      `- Status: ${entry.status}`,
      `- URL: ${entry.url}`,
      `- Fixture: ${entry.fixturePath}`,
      `- Quality: ${entry.qualityScore ?? 'n/a'}`,
      `- Page type: ${entry.pageType ?? 'n/a'}`,
      `- Strategy: ${entry.strategyWinner ?? 'n/a'}`
    );

    if (entry.error) {
      lines.push('', '### Error', '', entry.error);
    }

    lines.push(
      '',
      '### Extracted PromptReady Markdown',
      '',
      `<!-- offline-website-markdown:start ${entry.id} -->`,
      '',
      entry.markdown || '_No Markdown produced._',
      '',
      `<!-- offline-website-markdown:end ${entry.id} -->`
    );
  }

  return `${lines.join('\n')}\n`;
}

describe('Offline website corpus report', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes one Markdown report with extracted output for manual review', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      throw new Error('Offline website report must not fetch live websites');
    }));

    const entries: WebsiteReportEntry[] = [];
    for (const fixture of loadOfflineWebsiteManifest().cases) {
      await OfflineModeManager.clearCache();
      try {
        const html = readOfflineWebsiteFixture(fixture);
        const config = await OfflineModeManager.getOptimalConfig(fixture.url);
        const result = await OfflineModeManager.processContent(html, fixture.url, fixture.title, {
          ...config,
          performance: {
            ...config.performance,
            enableCaching: false,
          },
        });
        assertOfflineWebsiteResult(fixture, html, result);
        entries.push({
          id: fixture.id,
          name: fixture.name,
          url: fixture.url,
          fixturePath: fixture.fixturePath,
          status: 'pass',
          qualityScore: result.processingStats.qualityScore,
          pageType: result.processingStats.extractionDiagnostics?.pageType?.profile,
          strategyWinner: result.processingStats.strategyWinner,
          markdown: result.markdown,
        });
      } catch (error) {
        entries.push({
          id: fixture.id,
          name: fixture.name,
          url: fixture.url,
          fixturePath: fixture.fixturePath,
          status: 'fail',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    expect(globalThis.fetch).not.toHaveBeenCalled();
    mkdirSync(path.dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, renderReport(entries), 'utf8');
    expect(entries.filter((entry) => entry.status === 'fail')).toEqual([]);
  }, 120000);
});
