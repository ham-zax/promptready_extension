import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('content clipboard logging', () => {
  it('does not report expected focus fallback as a warning', () => {
    const source = readFileSync('entrypoints/content.ts', 'utf8');

    expect(source).toContain(
      "console.info('[BMAD_CLIPBOARD] navigator.clipboard failed; proceeding to fallback.'",
    );
    expect(source).not.toContain(
      "console.warn('[BMAD_CLIPBOARD] navigator.clipboard failed; proceeding to fallback.'",
    );
    expect(source).not.toContain(
      "console.warn('[BMAD_CLIPBOARD] window.focus() failed or was blocked:'",
    );
  });
});
