#!/usr/bin/env node
/* eslint-env node */
/* global process, console */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const LINTABLE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const IGNORED_DIR_PATTERNS = [
  /^node_modules\//,
  /^dist\//,
  /^coverage\//,
  /^output\//,
  /^\.wxt\//,
  /^\.git\//,
];

function toPosixPath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function isLintablePath(filePath) {
  const normalized = toPosixPath(String(filePath || '').trim());
  if (!normalized) {
    return false;
  }
  if (IGNORED_DIR_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return false;
  }
  return LINTABLE_EXTENSIONS.has(path.extname(normalized));
}

function chunkPaths(paths, chunkSize = 40) {
  const safeChunkSize = Math.max(1, Math.floor(chunkSize));
  const chunks = [];
  for (let index = 0; index < paths.length; index += safeChunkSize) {
    chunks.push(paths.slice(index, index + safeChunkSize));
  }
  return chunks;
}

function runGit(args, { allowFailure = false } = {}) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0 && !allowFailure) {
    const error = (result.stderr || result.stdout || '').trim();
    throw new Error(`git ${args.join(' ')} failed: ${error}`);
  }
  return {
    ok: result.status === 0,
    output: String(result.stdout || '').trim(),
  };
}

function collectWorkspaceChangedPaths() {
  const changedAgainstHead = runGit(
    ['diff', '--name-only', '--no-renames', '--diff-filter=ACMR', 'HEAD'],
    { allowFailure: true }
  ).output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const untracked = runGit(['ls-files', '--others', '--exclude-standard'], { allowFailure: true }).output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return Array.from(new Set([...changedAgainstHead, ...untracked]));
}

function collectStagedPaths() {
  return runGit(['diff', '--name-only', '--no-renames', '--diff-filter=ACMR', '--cached'], { allowFailure: true }).output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function resolveBaseRef(candidates) {
  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (!trimmed) {
      continue;
    }
    const exists = runGit(['rev-parse', '--verify', trimmed], { allowFailure: true }).ok;
    if (exists) {
      return trimmed;
    }
  }
  return null;
}

function collectRangePaths(baseCandidates) {
  const baseRef = resolveBaseRef(baseCandidates);
  if (!baseRef) {
    return [];
  }

  const diffRange = `${baseRef}...HEAD`;
  const files = runGit(['diff', '--name-only', '--no-renames', '--diff-filter=ACMR', diffRange], { allowFailure: true }).output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return files;
}

function filterLintablePaths(paths) {
  const unique = new Set();
  for (const filePath of paths) {
    const normalized = toPosixPath(String(filePath || '').trim());
    if (!isLintablePath(normalized)) {
      continue;
    }
    unique.add(normalized);
  }
  return Array.from(unique).sort((a, b) => a.localeCompare(b));
}

function runEslint(paths) {
  const chunks = chunkPaths(paths, Number(process.env.LINT_CHANGED_CHUNK_SIZE || '40'));
  for (const chunk of chunks) {
    const result = spawnSync('npx', ['--no-install', 'eslint', '--', ...chunk], { stdio: 'inherit' });
    if (result.status !== 0) {
      return result.status || 1;
    }
  }
  return 0;
}

function main() {
  const mode = process.env.LINT_CHANGED_MODE || 'workspace';
  const baseCandidates = (process.env.LINT_CHANGED_BASE || 'origin/main,origin/master,main,master')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  let candidatePaths;
  if (mode === 'staged') {
    candidatePaths = collectStagedPaths();
  } else if (mode === 'range') {
    candidatePaths = collectRangePaths(baseCandidates);
    if (candidatePaths.length === 0) {
      candidatePaths = collectWorkspaceChangedPaths();
    }
  } else {
    candidatePaths = collectWorkspaceChangedPaths();
  }

  const lintable = filterLintablePaths(candidatePaths);
  if (lintable.length === 0) {
    console.log('[lint:changed] No lintable changed files detected.');
    process.exit(0);
  }

  console.log(`[lint:changed] Linting ${lintable.length} changed file(s) in ${mode} mode.`);
  const status = runEslint(lintable);
  if (status !== 0) {
    process.exit(status);
  }
  console.log('[lint:changed] OK');
}

main();
