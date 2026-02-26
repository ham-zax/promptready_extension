/* eslint-env node */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { performance } from 'node:perf_hooks';
import ts from 'typescript';
import safeRegex from 'safe-regex2';
import safeRegexTest from 'safe-regex-test';

const ROOT = process.cwd();
const DEFAULT_SCAN_DIRS = ['core', 'entrypoints', 'content', 'lib', 'services', 'components'];
const VALID_EXTENSIONS = new Set(['.ts', '.tsx']);

function shouldIgnoreFile(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  return (
    normalized.includes('/node_modules/') ||
    normalized.includes('/.wxt/') ||
    normalized.includes('/dist/') ||
    normalized.includes('/build/') ||
    normalized.includes('/output/') ||
    normalized.includes('/tests/') ||
    normalized.includes('/docs/') ||
    normalized.endsWith('.d.ts')
  );
}

function collectFilesFromDirectory(directoryPath) {
  const files = [];
  if (!fs.existsSync(directoryPath)) {
    return files;
  }

  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFilesFromDirectory(absolutePath));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name);
    if (!VALID_EXTENSIONS.has(extension)) {
      continue;
    }
    if (shouldIgnoreFile(absolutePath)) {
      continue;
    }

    files.push(absolutePath);
  }
  return files;
}

function resolveScanTargets(argvTargets) {
  const targets = argvTargets.length > 0 ? argvTargets : DEFAULT_SCAN_DIRS;
  const files = new Set();

  for (const target of targets) {
    const absolute = path.resolve(ROOT, target);
    if (!fs.existsSync(absolute)) {
      continue;
    }

    const stat = fs.statSync(absolute);
    if (stat.isDirectory()) {
      for (const file of collectFilesFromDirectory(absolute)) {
        files.add(file);
      }
      continue;
    }

    if (stat.isFile() && VALID_EXTENSIONS.has(path.extname(absolute)) && !shouldIgnoreFile(absolute)) {
      files.add(absolute);
    }
  }

  return [...files].sort((a, b) => a.localeCompare(b));
}

function parseRegexLiteral(rawLiteral) {
  const closingSlashIndex = rawLiteral.lastIndexOf('/');
  if (!rawLiteral.startsWith('/') || closingSlashIndex <= 0) {
    return null;
  }

  return {
    pattern: rawLiteral.slice(1, closingSlashIndex),
    flags: rawLiteral.slice(closingSlashIndex + 1),
  };
}

function collectRegexLiterals(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const literals = [];

  function visit(node) {
    if (ts.isRegularExpressionLiteral(node)) {
      const raw = node.getText(sourceFile);
      const parsed = parseRegexLiteral(raw);
      if (parsed) {
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
        literals.push({
          raw,
          line,
          pattern: parsed.pattern,
          flags: parsed.flags,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return literals;
}

function buildAdversarialInput(pattern) {
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

function assessRuntimeGrowth(tester, seedChar) {
  const sizes = [2000, 4000, 8000];
  const durations = [];
  for (const size of sizes) {
    const sample = seedChar.repeat(size) + '!';
    const started = performance.now();
    tester(sample);
    durations.push(performance.now() - started);
  }

  const ratioOne = durations[1] / Math.max(durations[0], 0.05);
  const ratioTwo = durations[2] / Math.max(durations[1], 0.05);
  const suspicious =
    durations[2] > 120 &&
    (ratioOne > 3.8 || ratioTwo > 3.8);

  return {
    durations,
    ratioOne,
    ratioTwo,
    suspicious,
  };
}

function main() {
  const targets = process.argv.slice(2);
  const files = resolveScanTargets(targets);

  if (files.length === 0) {
    console.error('[check:regex] No files matched target paths.');
    process.exit(1);
  }

  let totalRegexCount = 0;
  const violations = [];
  const warnings = [];

  for (const file of files) {
    const regexLiterals = collectRegexLiterals(file);
    totalRegexCount += regexLiterals.length;

    for (const literal of regexLiterals) {
      let compiled;
      try {
        compiled = new RegExp(literal.pattern, literal.flags);
      } catch (error) {
        violations.push({
          type: 'invalid',
          file,
          line: literal.line,
          raw: literal.raw,
          detail: error instanceof Error ? error.message : String(error),
        });
        continue;
      }

      const safe = safeRegex(compiled);
      const robustTest = safeRegexTest(compiled);
      const runtimeAssessment = assessRuntimeGrowth(robustTest, buildAdversarialInput(literal.pattern));

      if (!safe) {
        warnings.push({
          file,
          line: literal.line,
          raw: literal.raw,
          detail: 'safeRegex returned false (review intent and runtime profile)',
        });
      }

      if (runtimeAssessment.suspicious) {
        violations.push({
          type: 'super-linear',
          file,
          line: literal.line,
          raw: literal.raw,
          detail: `durationsMs=[${runtimeAssessment.durations.map((n) => n.toFixed(2)).join(', ')}], ratios=[${runtimeAssessment.ratioOne.toFixed(2)}, ${runtimeAssessment.ratioTwo.toFixed(2)}]`,
        });
      }
    }
  }

  const relative = (absolutePath) => path.relative(ROOT, absolutePath) || absolutePath;

  if (violations.length > 0) {
    console.error(`\n[check:regex] Found ${violations.length} regex safety issue(s) across ${totalRegexCount} regex literal(s).`);
    for (const violation of violations) {
      console.error(`- ${relative(violation.file)}:${violation.line} ${violation.raw}`);
      console.error(`  ${violation.type}: ${violation.detail}`);
    }
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn(`\n[check:regex] Advisory: ${warnings.length} pattern(s) marked potentially unsafe by safeRegex (no super-linear growth detected).`);
    for (const warning of warnings.slice(0, 10)) {
      console.warn(`- ${relative(warning.file)}:${warning.line} ${warning.raw}`);
      console.warn(`  ${warning.detail}`);
    }
    if (warnings.length > 10) {
      console.warn(`- ... ${warnings.length - 10} more advisory item(s)`); 
    }
  }

  console.log(`[check:regex] OK: ${totalRegexCount} regex literal(s) validated in ${files.length} file(s).`);
}

main();
