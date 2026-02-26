import { describe, expect, it } from 'vitest';
import { chunkPaths, filterLintablePaths, isLintablePath, toPosixPath } from '../lib/dev/lint-changed';

describe('lint-changed path selection', () => {
  it('normalizes Windows separators into posix paths', () => {
    expect(toPosixPath('core\\offline-mode-manager.ts')).toBe('core/offline-mode-manager.ts');
  });

  it('accepts lintable JS/TS files and rejects non-source artifacts', () => {
    expect(isLintablePath('core/offline-mode-manager.ts')).toBe(true);
    expect(isLintablePath('entrypoints/popup/Popup.tsx')).toBe(true);
    expect(isLintablePath('scripts/check-regex-safety.mjs')).toBe(true);

    expect(isLintablePath('tests/fixtures/offline-corpus/promptready-homepage.html')).toBe(false);
    expect(isLintablePath('README.md')).toBe(false);
    expect(isLintablePath('coverage/lcov-report/index.html')).toBe(false);
    expect(isLintablePath('node_modules/pkg/index.js')).toBe(false);
  });

  it('filters, deduplicates and sorts changed paths deterministically', () => {
    const paths = [
      'core/offline-mode-manager.ts',
      'core/offline-mode-manager.ts',
      'tests/offline-mode-manager.hardening.test.ts',
      'README.md',
      'output/offline-dumps/promptready.md',
      'scripts/check-regex-safety.mjs',
    ];

    expect(filterLintablePaths(paths)).toEqual([
      'core/offline-mode-manager.ts',
      'scripts/check-regex-safety.mjs',
      'tests/offline-mode-manager.hardening.test.ts',
    ]);
  });

  it('chunks lint targets without dropping order', () => {
    const paths = ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'];
    expect(chunkPaths(paths, 2)).toEqual([
      ['a.ts', 'b.ts'],
      ['c.ts', 'd.ts'],
      ['e.ts'],
    ]);
  });
});
