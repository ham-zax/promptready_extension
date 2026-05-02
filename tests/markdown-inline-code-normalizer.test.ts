import { describe, expect, it } from 'vitest';
import { normalizeInlineCodeSpacing } from '@/lib/markdown-inline-code-normalizer';

describe('normalizeInlineCodeSpacing', () => {
  it('keeps inline-code spacing normalization stable', () => {
    const warnings: string[] = [];
    const input = [
      'The installer copies first-party`satori-search`,`satori-navigation`, and`satori-indexing`skills.',
      'MILVUS_TOKEN`is only needed for authenticated Milvus.',
      'Scope filtering`scope=runtime`excludes docs/tests,`docs`targets documentation, and`mixed`includes everything.',
    ].join('\n');

    expect({
      markdown: normalizeInlineCodeSpacing(input, warnings),
      warnings,
    }).toMatchSnapshot();
  });

  it('leaves fenced code blocks untouched', () => {
    const warnings: string[] = [];
    const input = [
      'Before`code`after.',
      '```ts',
      'const value = first`second`third;',
      '```',
      'After`code`again.',
    ].join('\n');

    expect({
      markdown: normalizeInlineCodeSpacing(input, warnings),
      warnings,
    }).toMatchSnapshot();
  });

  it('does not warn when markdown is already normalized', () => {
    const warnings: string[] = [];
    const input = 'Already has `inline_code` and `another` token.';

    expect({
      markdown: normalizeInlineCodeSpacing(input, warnings),
      warnings,
    }).toMatchSnapshot();
  });
});
