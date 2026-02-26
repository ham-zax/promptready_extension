#!/usr/bin/env node
/* eslint-env node */
/* global process, console */
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function toPosixPath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function stableSortByFile(entries) {
  return [...entries].sort((a, b) => a.file.localeCompare(b.file));
}

export function summarizeRecords(records) {
  const files = stableSortByFile(records.map(({ file, content }) => {
    const normalizedContent = String(content || '');
    const hash = createHash('sha256').update(normalizedContent).digest('hex');
    return {
      file: toPosixPath(file),
      bytes: Buffer.byteLength(normalizedContent, 'utf8'),
      lines: normalizedContent.length === 0 ? 0 : normalizedContent.split('\n').length,
      sha256: hash,
    };
  }));

  const totals = files.reduce(
    (acc, entry) => {
      acc.files += 1;
      acc.totalBytes += entry.bytes;
      acc.totalLines += entry.lines;
      return acc;
    },
    { files: 0, totalBytes: 0, totalLines: 0 }
  );

  return { files, totals };
}

export function diffSummaries(previousSummary, currentSummary) {
  const previousByFile = new Map(previousSummary.files.map((entry) => [entry.file, entry]));
  const currentByFile = new Map(currentSummary.files.map((entry) => [entry.file, entry]));

  const added = [];
  const removed = [];
  const changed = [];
  const unchanged = [];

  for (const [file, current] of currentByFile) {
    const previous = previousByFile.get(file);
    if (!previous) {
      added.push(current);
      continue;
    }
    if (previous.sha256 !== current.sha256) {
      changed.push({
        file,
        previousSha256: previous.sha256,
        currentSha256: current.sha256,
        byteDelta: current.bytes - previous.bytes,
        lineDelta: current.lines - previous.lines,
      });
      continue;
    }
    unchanged.push(current);
  }

  for (const [file, previous] of previousByFile) {
    if (!currentByFile.has(file)) {
      removed.push(previous);
    }
  }

  return {
    added: stableSortByFile(added),
    removed: stableSortByFile(removed),
    changed: [...changed].sort((a, b) => a.file.localeCompare(b.file)),
    unchanged: stableSortByFile(unchanged),
  };
}

function collectMarkdownRecords(rootDir) {
  const records = [];
  const walk = (dir) => {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.md')) {
        continue;
      }
      const relativePath = toPosixPath(path.relative(rootDir, absolutePath));
      const content = readFileSync(absolutePath, 'utf8');
      records.push({ file: relativePath, content });
    }
  };
  walk(rootDir);
  return records;
}

function renderMarkdownReport(summary, diff, previousSummaryPath = null) {
  const lines = [];
  lines.push('# Offline Iteration Summary');
  lines.push('');
  lines.push(`- Generated: ${summary.generatedAt}`);
  lines.push(`- Files: ${summary.totals.files}`);
  lines.push(`- Total bytes: ${summary.totals.totalBytes}`);
  lines.push(`- Total lines: ${summary.totals.totalLines}`);
  if (previousSummaryPath) {
    lines.push(`- Previous summary: ${toPosixPath(previousSummaryPath)}`);
  }
  lines.push('');

  if (diff) {
    lines.push('## Delta');
    lines.push('');
    lines.push(`- Added: ${diff.added.length}`);
    lines.push(`- Removed: ${diff.removed.length}`);
    lines.push(`- Changed: ${diff.changed.length}`);
    lines.push(`- Unchanged: ${diff.unchanged.length}`);
    lines.push('');
    if (diff.changed.length > 0) {
      lines.push('### Changed Files');
      lines.push('');
      for (const item of diff.changed) {
        lines.push(`- ${item.file} (bytes ${item.byteDelta >= 0 ? '+' : ''}${item.byteDelta}, lines ${item.lineDelta >= 0 ? '+' : ''}${item.lineDelta})`);
      }
      lines.push('');
    }
  }

  lines.push('## Files');
  lines.push('');
  for (const file of summary.files) {
    lines.push(`- ${file.file} | ${file.bytes} bytes | ${file.lines} lines | ${file.sha256.slice(0, 12)}`);
  }
  lines.push('');
  return lines.join('\n');
}

function readJsonIfExists(filePath) {
  if (!filePath || !existsSync(filePath)) {
    return null;
  }
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function parseArgs(argv) {
  const args = {
    current: '',
    previous: '',
    out: '',
    markdownOut: '',
  };

  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (token === '--current') {
      args.current = argv[index + 1] || '';
      index++;
      continue;
    }
    if (token === '--previous') {
      args.previous = argv[index + 1] || '';
      index++;
      continue;
    }
    if (token === '--out') {
      args.out = argv[index + 1] || '';
      index++;
      continue;
    }
    if (token === '--md-out') {
      args.markdownOut = argv[index + 1] || '';
      index++;
    }
  }
  return args;
}

export function buildIterationSummaryFromRecords(records, generatedAt = new Date().toISOString()) {
  const summarized = summarizeRecords(records);
  return {
    generatedAt,
    files: summarized.files,
    totals: summarized.totals,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.current) {
    console.error('Usage: node scripts/offline-iteration-report.mjs --current <dump-dir> [--previous <summary.json>] [--out <summary.json>] [--md-out <summary.md>]');
    process.exit(1);
  }

  const currentDir = path.resolve(args.current);
  if (!existsSync(currentDir)) {
    console.error(`[offline-iteration-report] Current dump dir not found: ${currentDir}`);
    process.exit(1);
  }

  const currentRecords = collectMarkdownRecords(currentDir);
  const summary = buildIterationSummaryFromRecords(currentRecords);
  const previousSummary = readJsonIfExists(args.previous ? path.resolve(args.previous) : '');
  const diff = previousSummary ? diffSummaries(previousSummary, summary) : null;

  const summaryPath = path.resolve(args.out || path.join(currentDir, 'summary.json'));
  const markdownReportPath = path.resolve(args.markdownOut || path.join(currentDir, 'summary.md'));
  mkdirSync(path.dirname(summaryPath), { recursive: true });
  mkdirSync(path.dirname(markdownReportPath), { recursive: true });

  const output = {
    ...summary,
    diff: diff || undefined,
  };
  writeFileSync(summaryPath, JSON.stringify(output, null, 2), 'utf8');
  writeFileSync(
    markdownReportPath,
    renderMarkdownReport(summary, diff, args.previous || null),
    'utf8'
  );

  console.log(`[offline-iteration-report] Summary written to ${summaryPath}`);
  console.log(`[offline-iteration-report] Markdown report written to ${markdownReportPath}`);
  if (diff) {
    console.log(
      `[offline-iteration-report] Delta: +${diff.added.length} / -${diff.removed.length} / ~${diff.changed.length} / =${diff.unchanged.length}`
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main();
}
