#!/usr/bin/env node
/* eslint-env node */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(repoRoot, 'tests', 'fixtures', 'offline-websites', 'manifest.json');

function parseArgs(argv) {
  const args = {
    caseId: '',
    all: false,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (token === '--case') {
      args.caseId = argv[index + 1] || '';
      index++;
      continue;
    }
    if (token === '--all') {
      args.all = true;
      continue;
    }
    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (token === '--help' || token === '-h') {
      printUsage();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

function printUsage() {
  console.log('Usage: node scripts/capture-website-corpus.mjs --case <id> [--dry-run]');
  console.log('       node scripts/capture-website-corpus.mjs --all [--dry-run]');
  console.log('');
  console.log('Only manifest cases with "capture.enabled": true are refreshed.');
}

function loadManifest() {
  return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

function refreshableCases(manifest) {
  return manifest.cases.filter((fixture) => fixture.capture?.enabled === true);
}

function resolveTargetCases(manifest, args) {
  const refreshable = refreshableCases(manifest);
  if (args.caseId) {
    const fixture = manifest.cases.find((item) => item.id === args.caseId);
    if (!fixture) {
      throw new Error(`Unknown offline website fixture: ${args.caseId}`);
    }
    if (fixture.capture?.enabled !== true) {
      throw new Error(`Offline website fixture is not refreshable: ${args.caseId}`);
    }
    return [fixture];
  }
  if (args.all) {
    return refreshable;
  }
  throw new Error('Pass --case <id> or --all.');
}

function captureFixture(fixture, dryRun) {
  const outputPath = path.resolve(repoRoot, fixture.fixturePath);
  const relativeOutput = path.relative(repoRoot, outputPath);
  if (relativeOutput.startsWith('..') || path.isAbsolute(relativeOutput)) {
    throw new Error(`Fixture path escapes repo root: ${fixture.fixturePath}`);
  }

  const captureMode = fixture.capture?.mode || 'rendered';
  const env = {
    ...process.env,
    OFFLINE_CAPTURE_MODE: captureMode,
  };
  if (fixture.capture?.renderWaitMs) {
    env.OFFLINE_RENDER_WAIT_MS = String(fixture.capture.renderWaitMs);
  }
  if (fixture.capture?.renderViewport) {
    env.OFFLINE_RENDER_VIEWPORT = String(fixture.capture.renderViewport);
  }

  const command = ['bash', 'scripts/capture-fixture.sh', fixture.url, relativeOutput];
  console.log(`[offline-website-corpus] ${fixture.id}: ${command.join(' ')} (mode=${captureMode})`);
  if (dryRun) {
    return;
  }

  const result = spawnSync(command[0], command.slice(1), {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`Capture failed for ${fixture.id}`);
  }
}

function main() {
  if (!existsSync(manifestPath)) {
    throw new Error(`Offline website manifest not found: ${manifestPath}`);
  }
  const args = parseArgs(process.argv.slice(2));
  const manifest = loadManifest();
  const cases = resolveTargetCases(manifest, args);

  if (cases.length === 0) {
    console.log('[offline-website-corpus] No refreshable cases selected.');
    return;
  }

  for (const fixture of cases) {
    captureFixture(fixture, args.dryRun);
  }
}

try {
  main();
} catch (error) {
  console.error(`[offline-website-corpus] ${error instanceof Error ? error.message : String(error)}`);
  printUsage();
  process.exit(1);
}
