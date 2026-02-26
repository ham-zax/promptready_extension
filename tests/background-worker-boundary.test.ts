import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('background worker dependency boundaries', () => {
  it('does not import OfflineModeManager into service worker entrypoint', () => {
    const backgroundPath = path.resolve(process.cwd(), 'entrypoints/background.ts');
    const source = fs.readFileSync(backgroundPath, 'utf8');

    expect(source).not.toMatch(/offline-mode-manager/i);
  });
});

