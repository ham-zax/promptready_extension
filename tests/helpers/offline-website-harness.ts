import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';
import type { OfflineProcessingResult } from '../../core/offline-mode-manager';

export interface OfflineWebsiteCase {
  id: string;
  name: string;
  fixturePath: string;
  url: string;
  title: string;
  requiredSnippets: string[];
  forbiddenSnippets: string[];
  minQualityScore?: number;
  minMarkdownLength?: number;
  maxSuspiciousSingleTokenLines?: number;
  expectedStrategyWinnerOneOf?: string[];
  expectedPageType?: string;
  allowShell?: boolean;
  capture?: {
    enabled: boolean;
    mode?: string;
    renderWaitMs?: number;
    renderViewport?: string;
    reason?: string;
  };
}

export interface OfflineWebsiteManifest {
  version: 1;
  description: string;
  cases: OfflineWebsiteCase[];
}

const manifestPath = path.join(
  process.cwd(),
  'tests',
  'fixtures',
  'offline-websites',
  'manifest.json'
);

const dumpDir = process.env.OFFLINE_DUMP_DIR ? path.resolve(process.env.OFFLINE_DUMP_DIR) : null;

function assertStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`Offline website manifest field "${field}" must be a string array`);
  }
  return value;
}

function assertCase(value: unknown): OfflineWebsiteCase {
  if (!value || typeof value !== 'object') {
    throw new Error('Offline website manifest case must be an object');
  }
  const raw = value as Record<string, unknown>;
  for (const field of ['id', 'name', 'fixturePath', 'url', 'title']) {
    if (typeof raw[field] !== 'string' || !raw[field]) {
      throw new Error(`Offline website manifest case field "${field}" must be a non-empty string`);
    }
  }
  if (/^https?:\/\//i.test(raw.fixturePath as string)) {
    throw new Error(`Offline website fixturePath must be local, got "${raw.fixturePath}"`);
  }

  return {
    id: raw.id as string,
    name: raw.name as string,
    fixturePath: raw.fixturePath as string,
    url: raw.url as string,
    title: raw.title as string,
    requiredSnippets: assertStringArray(raw.requiredSnippets, `${raw.id}.requiredSnippets`),
    forbiddenSnippets: assertStringArray(raw.forbiddenSnippets, `${raw.id}.forbiddenSnippets`),
    minQualityScore: typeof raw.minQualityScore === 'number' ? raw.minQualityScore : undefined,
    minMarkdownLength: typeof raw.minMarkdownLength === 'number' ? raw.minMarkdownLength : undefined,
    maxSuspiciousSingleTokenLines:
      typeof raw.maxSuspiciousSingleTokenLines === 'number'
        ? raw.maxSuspiciousSingleTokenLines
        : undefined,
    expectedStrategyWinnerOneOf:
      raw.expectedStrategyWinnerOneOf === undefined
        ? undefined
        : assertStringArray(raw.expectedStrategyWinnerOneOf, `${raw.id}.expectedStrategyWinnerOneOf`),
    expectedPageType: typeof raw.expectedPageType === 'string' ? raw.expectedPageType : undefined,
    allowShell: raw.allowShell === true,
    capture: assertCaptureConfig(raw.capture, raw.id as string),
  };
}

function assertCaptureConfig(value: unknown, id: string): OfflineWebsiteCase['capture'] {
  if (value === undefined) {
    return undefined;
  }
  if (!value || typeof value !== 'object') {
    throw new Error(`Offline website manifest field "${id}.capture" must be an object`);
  }
  const raw = value as Record<string, unknown>;
  if (typeof raw.enabled !== 'boolean') {
    throw new Error(`Offline website manifest field "${id}.capture.enabled" must be boolean`);
  }
  return {
    enabled: raw.enabled,
    mode: typeof raw.mode === 'string' ? raw.mode : undefined,
    renderWaitMs: typeof raw.renderWaitMs === 'number' ? raw.renderWaitMs : undefined,
    renderViewport: typeof raw.renderViewport === 'string' ? raw.renderViewport : undefined,
    reason: typeof raw.reason === 'string' ? raw.reason : undefined,
  };
}

export function loadOfflineWebsiteManifest(): OfflineWebsiteManifest {
  const parsed = JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Offline website manifest must be an object');
  }
  const raw = parsed as Record<string, unknown>;
  if (raw.version !== 1) {
    throw new Error('Offline website manifest version must be 1');
  }
  if (typeof raw.description !== 'string' || !raw.description) {
    throw new Error('Offline website manifest description must be a non-empty string');
  }
  if (!Array.isArray(raw.cases)) {
    throw new Error('Offline website manifest cases must be an array');
  }
  const cases = raw.cases.map(assertCase);
  const seen = new Set<string>();
  for (const fixture of cases) {
    if (seen.has(fixture.id)) {
      throw new Error(`Duplicate offline website fixture id "${fixture.id}"`);
    }
    seen.add(fixture.id);
  }
  return { version: 1, description: raw.description, cases };
}

export function loadOfflineWebsiteCase(id: string): OfflineWebsiteCase {
  const fixture = loadOfflineWebsiteManifest().cases.find((item) => item.id === id);
  if (!fixture) {
    throw new Error(`Offline website fixture "${id}" not found`);
  }
  return fixture;
}

export function readOfflineWebsiteFixture(fixture: OfflineWebsiteCase): string {
  const fixturePath = path.resolve(process.cwd(), fixture.fixturePath);
  const relative = path.relative(process.cwd(), fixturePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Offline website fixture escapes repository root: ${fixture.fixturePath}`);
  }
  return readFileSync(fixturePath, 'utf8');
}

export function maybeDumpOfflineWebsiteMarkdown(
  fixture: OfflineWebsiteCase,
  markdown: string
): void {
  if (!dumpDir) return;
  mkdirSync(dumpDir, { recursive: true });
  writeFileSync(path.join(dumpDir, `${fixture.id}.md`), markdown, 'utf8');
}

export function normalizeOfflineWebsiteDynamicMetadata(markdown: string): string {
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

function assertNoInlineCodeFenceMarkers(markdown: string): void {
  for (const line of markdown.split('\n')) {
    if (!line.includes('```')) continue;
    if (line.trimStart().startsWith('```')) continue;
    throw new Error(`Inline code fence marker found: "${line.slice(0, 160)}"`);
  }
}

function assertBalancedCodeFences(markdown: string): void {
  let inFence = false;
  for (const line of markdown.split('\n')) {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
    }
  }
  if (inFence) {
    throw new Error('Unbalanced fenced code blocks detected');
  }
}

function appearsUnrenderedShell(html: string, fixture: OfflineWebsiteCase): boolean {
  if (!html.includes('<div id="root"></div>')) {
    return false;
  }
  return fixture.requiredSnippets.every((snippet) => !html.includes(snippet));
}

export function assertOfflineWebsiteResult(
  fixture: OfflineWebsiteCase,
  html: string,
  result: OfflineProcessingResult
): void {
  if (!fixture.allowShell) {
    expect(appearsUnrenderedShell(html, fixture)).toBe(false);
  }

  expect(result.success).toBe(true);
  expect(result.markdown.length).toBeGreaterThan(fixture.minMarkdownLength ?? 200);
  expect(result.processingStats.readabilityTime).toBeGreaterThan(0);
  expect(result.processingStats.qualityScore).toBeGreaterThanOrEqual(fixture.minQualityScore ?? 0);
  expect(result.markdown).toContain('> Source:');
  expect(result.markdown).toContain('> Captured:');

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
  if (fixture.expectedStrategyWinnerOneOf) {
    expect(result.processingStats.strategyWinner).toBeDefined();
    expect(fixture.expectedStrategyWinnerOneOf).toContain(result.processingStats.strategyWinner);
  }
  if (fixture.expectedPageType) {
    expect(result.processingStats.extractionDiagnostics?.pageType?.profile).toBe(
      fixture.expectedPageType
    );
  }

  expect(() => assertNoInlineCodeFenceMarkers(result.markdown)).not.toThrow();
  expect(() => assertBalancedCodeFences(result.markdown)).not.toThrow();
}
