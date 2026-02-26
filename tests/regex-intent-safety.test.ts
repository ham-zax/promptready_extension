import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import safeRegex from 'safe-regex2';
import safeRegexTest from 'safe-regex-test';
import { OfflineModeManager } from '../core/offline-mode-manager';

type RegexLiteral = {
  raw: string;
  pattern: string;
  flags: string;
  line: number;
};

const offlineManagerPath = path.join(process.cwd(), 'core', 'offline-mode-manager.ts');

function parseRegexLiteral(raw: string): { pattern: string; flags: string } {
  const closingSlash = raw.lastIndexOf('/');
  if (!raw.startsWith('/') || closingSlash <= 0) {
    throw new Error(`Invalid regex literal: ${raw}`);
  }
  return {
    pattern: raw.slice(1, closingSlash),
    flags: raw.slice(closingSlash + 1),
  };
}

function collectRegexLiteralsFromMethod(methodName: string): RegexLiteral[] {
  const source = readFileSync(offlineManagerPath, 'utf8');
  const sourceFile = ts.createSourceFile(
    offlineManagerPath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const found: RegexLiteral[] = [];

  function visit(node: ts.Node, activeMethod: string | null): void {
    let currentMethod = activeMethod;

    if (ts.isMethodDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
      currentMethod = node.name.text;
    }

    if (currentMethod === methodName && ts.isRegularExpressionLiteral(node)) {
      const raw = node.getText(sourceFile);
      const { pattern, flags } = parseRegexLiteral(raw);
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
      found.push({ raw, pattern, flags, line });
    }

    ts.forEachChild(node, (child) => visit(child, currentMethod));
  }

  visit(sourceFile, null);
  return found;
}

function runtimeSeed(pattern: string): string {
  if (/\\d|[0-9]/.test(pattern)) {
    return '9';
  }
  if (/\\s|\\n|\\r/.test(pattern)) {
    return ' ';
  }
  if (/[a-z]/i.test(pattern)) {
    return 'a';
  }
  return 'x';
}

function hasSuspiciousGrowth(tester: (value: string) => unknown, seed: string): boolean {
  const sizes = [2000, 4000, 8000];
  const durations: number[] = [];

  for (const size of sizes) {
    const input = seed.repeat(size) + '!';
    const started = performance.now();
    tester(input);
    durations.push(performance.now() - started);
  }

  const ratioOne = durations[1] / Math.max(durations[0], 0.05);
  const ratioTwo = durations[2] / Math.max(durations[1], 0.05);

  return durations[2] > 120 && (ratioOne > 3.8 || ratioTwo > 3.8);
}

describe('regex safety + intent checks', () => {
  it('keeps critical extraction regexes free from super-linear growth', () => {
    const criticalMethods = [
      'detectInputWarnings',
      'sanitizeRiskyMarkdown',
      'stripResidualUiNoiseLines',
      'findChunkBoundary',
    ];

    for (const methodName of criticalMethods) {
      const regexes = collectRegexLiteralsFromMethod(methodName);
      expect(regexes.length).toBeGreaterThan(0);

      for (const entry of regexes) {
        const re = new RegExp(entry.pattern, entry.flags);
        const matcher = safeRegexTest(re);

        // `safe-regex2` can over-report for some bounded patterns; require runtime
        // growth checks in all cases and demand static pass where available.
        const staticSafe = safeRegex(re);
        const suspiciousGrowth = hasSuspiciousGrowth(matcher, runtimeSeed(entry.pattern));

        expect(
          suspiciousGrowth,
          `Possible super-linear regex at line ${entry.line}: ${entry.raw} (safeRegex=${String(staticSafe)})`,
        ).toBe(false);
      }
    }
  });

  it('removes UI-noise lines without deleting real timestamp content', () => {
    const input = [
      '# PromptReady — One-click clean Markdown from any page',
      '14:43 (IST) Feb 25',
      'Cleaner input. Better model output.',
      'ANNOYING POPUP ADAccept all 500 tracking cookies to continue.',
      'Donate | Create account | Log in',
      'Privacy policy | About Wikipedia',
      'Preserves code fences',
    ].join('\n');

    const warnings: string[] = [];
    const stripped = (OfflineModeManager as unknown as {
      stripResidualUiNoiseLines: (markdown: string, warnings: string[]) => string;
    }).stripResidualUiNoiseLines(input, warnings);

    expect(stripped).toContain('14:43 (IST) Feb 25');
    expect(stripped).toContain('Cleaner input. Better model output.');
    expect(stripped).toContain('Preserves code fences');

    expect(stripped).not.toContain('ANNOYING POPUP AD');
    expect(stripped).not.toContain('Donate | Create account | Log in');
    expect(stripped).not.toContain('Privacy policy | About Wikipedia');
    expect(warnings).toContain('Removed residual UI-noise lines from markdown');
  });

  it('flags obfuscated script payload indicators in input warning scan', () => {
    const maliciousHtml = [
      '<div>safe</div>',
      '<a href="j&#x09;avascript:alert(1)">click</a>',
      '<img src="x" onerror="alert(1)">',
      '<script>window.location="/pwn"</script>',
    ].join('');

    const warnings = (OfflineModeManager as unknown as {
      detectInputWarnings: (html: string) => string[];
    }).detectInputWarnings(maliciousHtml);

    expect(warnings).toContain('protocol XSS sanitized');
    expect(warnings).toContain('event handler XSS removed');
    expect(warnings).toContain('script XSS content removed');
    expect(warnings).toContain('malicious payload indicators detected');
  });
});
