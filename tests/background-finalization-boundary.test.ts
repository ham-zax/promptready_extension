import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('background finalization boundary', () => {
  it('treats offscreen markdown as canonical in handleProcessingComplete', () => {
    const backgroundPath = path.resolve(process.cwd(), 'entrypoints/background.ts');
    const source = fs.readFileSync(backgroundPath, 'utf8');

    const functionStart = source.indexOf('async handleProcessingComplete');
    expect(functionStart).toBeGreaterThanOrEqual(0);
    const functionBody = source.slice(functionStart, functionStart + 2200);

    expect(functionBody).toContain("typeof exportMd === 'string' ? exportMd : ''");
    expect(functionBody).not.toContain('this.canonicalizeDeliveredMarkdown(exportMd');
  });
});
