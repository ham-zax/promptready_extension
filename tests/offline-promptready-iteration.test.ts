import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { OfflineModeManager } from '../core/offline-mode-manager';

const fixtureFile = process.env.OFFLINE_FIXTURE_FILE
  ? path.resolve(process.env.OFFLINE_FIXTURE_FILE)
  : path.join(process.cwd(), 'tests', 'fixtures', 'offline-corpus', 'promptready-homepage.html');

const sourceUrl = process.env.OFFLINE_SOURCE_URL || 'https://promptready.app/';
const sourceTitle = process.env.OFFLINE_SOURCE_TITLE || 'PromptReady - One-click clean Markdown from any page';

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

describe('offline promptready extraction iteration', () => {
  it('extracts promptready fixture without popup/newsletter leakage', async () => {
    const html = readFileSync(fixtureFile, 'utf8');
    const appearsUnrenderedShell =
      html.includes('<div id="root"></div>') &&
      !html.includes('Cleaner input. Better model output.');
    expect(appearsUnrenderedShell).toBe(false);

    const result = await OfflineModeManager.processContent(html, sourceUrl, sourceTitle, {
      performance: {
        maxContentLength: 1_000_000,
        enableCaching: false,
        chunkSize: 100_000,
      },
    });

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('Cleaner input. Better model output.');
    expect(result.markdown).toContain('Preserves code fences');
    expect(
      result.markdown.includes('Before / After Comparison') ||
      result.markdown.includes('See the transformation in one pass')
    ).toBe(true);
    expect(result.markdown).toContain('Trusted by builders, researchers,');
    expect(result.markdown).toContain('Simple pricing');
    expect(result.markdown).toContain('Early Access Plan');

    expect(result.markdown).not.toContain('ANNOYING POPUP AD');
    expect(result.markdown).not.toContain('Accept all 500 tracking cookies to continue');
    expect(result.markdown).not.toContain('Subscribe to our newsletter | Related links | Footer text');
    expect(result.markdown).not.toContain('Source: example.com/rag-guide');

    const suspiciousLines = collectSuspiciousSingleTokenLines(result.markdown);
    expect(suspiciousLines.length).toBeLessThanOrEqual(3);
  });
});
