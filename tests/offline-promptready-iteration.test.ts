import { describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { OfflineModeManager } from '../core/offline-mode-manager';

const fixtureFile = process.env.OFFLINE_FIXTURE_FILE
  ? path.resolve(process.env.OFFLINE_FIXTURE_FILE)
  : path.join(process.cwd(), 'tests', 'fixtures', 'offline-corpus', 'promptready-homepage.html');

const sourceUrl = process.env.OFFLINE_SOURCE_URL || 'https://promptready.app/';
const sourceTitle = process.env.OFFLINE_SOURCE_TITLE || 'PromptReady - One-click clean Markdown from any page';
const dumpDir = process.env.OFFLINE_DUMP_DIR ? path.resolve(process.env.OFFLINE_DUMP_DIR) : null;

function maybeDumpMarkdown(markdown: string, fileBaseName: string): void {
  if (!dumpDir) return;
  mkdirSync(dumpDir, { recursive: true });
  writeFileSync(path.join(dumpDir, `${fileBaseName}.md`), markdown, 'utf8');
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

function assertNoInlineCodeFenceMarkers(markdown: string): void {
  const lines = markdown.split('\n');
  for (const line of lines) {
    if (!line.includes('```')) continue;
    if (line.trimStart().startsWith('```')) continue;
    throw new Error(`Inline code fence marker found: "${line.slice(0, 160)}"`);
  }
}

function assertBalancedCodeFences(markdown: string): void {
  const lines = markdown.split('\n');
  let inFence = false;
  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
    }
  }
  if (inFence) {
    throw new Error('Unbalanced fenced code blocks detected (missing closing fence)');
  }
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

    // Dump early so failures still produce an inspectable artifact when OFFLINE_DUMP_DIR is set.
    maybeDumpMarkdown(result.markdown, 'promptready');

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('Cleaner input. Better model output.');
    // Avoid collapsed span boundaries from the source HTML (e.g. "into<span>precise" -> "intoprecise").
    expect(result.markdown).not.toContain('intoprecise');
    expect(result.markdown).toContain('Preserves code fences');
    expect(
      result.markdown.includes('Before / After Comparison') ||
      result.markdown.includes('See the transformation in one pass')
    ).toBe(true);
    expect(result.markdown).toContain('Trusted by builders, researchers,');
    expect(result.markdown).toContain('Simple pricing');
    expect(result.markdown).toContain('Early Access Plan');
    expect(result.markdown).toContain('Save 40% today!');
    expect(result.markdown).toContain('Subscribe to our newsletter | Related links | Footer text');
    expect(result.markdown).toContain('Source: example.com/rag-guide');

    expect(result.markdown).not.toContain('ANNOYING POPUP AD');
    expect(result.markdown).not.toContain('Accept all 500 tracking cookies to continue');
    expect(result.markdown).not.toContain('Donate | Create account | Log in');
    expect(result.markdown).not.toContain('Privacy policy | About Wikipedia');

    const suspiciousLines = collectSuspiciousSingleTokenLines(result.markdown);
    expect(suspiciousLines.length).toBeLessThanOrEqual(3);

    expect(() => assertNoInlineCodeFenceMarkers(result.markdown)).not.toThrow();
    expect(() => assertBalancedCodeFences(result.markdown)).not.toThrow();
  });
});
