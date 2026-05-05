#!/usr/bin/env node
/* eslint-env node */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(repoRoot, 'tests', 'fixtures', 'offline-websites', 'manifest.json');
const outputPath = path.join(repoRoot, 'tests', 'fixtures', 'offline-websites', 'WEBSITES.md');

function loadManifest() {
  return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

function escapeCell(value) {
  return String(value).replaceAll('|', '\\|').replace(/\s+/g, ' ').trim();
}

function captureStatus(fixture) {
  if (fixture.capture?.enabled) {
    return `refreshable (${fixture.capture.mode || 'rendered'})`;
  }
  return `pinned/manual: ${fixture.capture?.reason || 'not refreshable'}`;
}

function snippetSummary(snippets) {
  if (!Array.isArray(snippets) || snippets.length === 0) {
    return '';
  }
  return snippets.slice(0, 3).join('; ');
}

function renderManifest(manifest) {
  const lines = [
    '<!-- GENERATED FILE. Edit manifest.json instead. -->',
    '',
    '# Offline Website Corpus',
    '',
    manifest.description,
    '',
    'CI tests never download websites. Refresh/download is always explicit, and tests read checked-in fixture HTML only.',
    '',
    '## Commands',
    '',
    '```bash',
    'npm run test:offline:website-manifest',
    'npm run test:offline:websites',
    'npm run capture:fixtures:websites -- --all',
    'npm run docs:offline:websites',
    'npm run report:offline:websites',
    '```',
    '',
    '## Website Fixtures',
    '',
    '| ID | Name | URL | Fixture | Capture | Quality Floor | Required Snippets Preview |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];

  for (const fixture of manifest.cases) {
    lines.push(
      [
        escapeCell(fixture.id),
        escapeCell(fixture.name),
        escapeCell(fixture.url),
        escapeCell(fixture.fixturePath),
        escapeCell(captureStatus(fixture)),
        escapeCell(fixture.minQualityScore ?? 0),
        escapeCell(snippetSummary(fixture.requiredSnippets)),
      ].join(' | ').replace(/^/, '| ').replace(/$/, ' |')
    );
  }

  lines.push(
    '',
    '## Review Output',
    '',
    '`npm run report:offline:websites` writes a combined manual review artifact to `output/offline-website-corpus-report.md`.',
    'That report is intentionally ignored by git.'
  );

  return `${lines.join('\n')}\n`;
}

function main() {
  const manifest = loadManifest();
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, renderManifest(manifest), 'utf8');
  console.log(`[offline-websites] wrote ${path.relative(repoRoot, outputPath)}`);
}

main();
