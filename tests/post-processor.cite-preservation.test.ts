import { describe, it, expect } from 'vitest';
import { MarkdownPostProcessor } from '../core/post-processor';

describe('MarkdownPostProcessor - citation preservation', () => {
  it('preserves an existing cite-first block at the top of the output', () => {
    const citeBlock = `> Source: https://example.com/article\n> Captured: 2025-08-15T10:00:59.401Z\n> Hash: https://example.com/article-abcdef123\n`;

    // Content that the post-processor will transform (headings, lists, whitespace)
    const body = `\n# Article Title\n\nSome introductory text.\n\n## Section\n\n- Item 1\n- Item 2\n\n`;

    const input = citeBlock + '\n' + body;

    const result = MarkdownPostProcessor.process(input);

    // The processed markdown must contain the cite-first block and it should be
    // the first non-empty lines in the output.
    const normalized = result.markdown.replace(/^\n+/, '');
    expect(normalized.startsWith('> Source:')).toBe(true);

    // Ensure the exact cite lines are present (allowing whitespace normalization)
    const found = normalized.match(/^> Source:[^\n]*\n(?:>.*\n)*/m);
    expect(found).toBeTruthy();
    if (found) {
      const preserved = found[0].trim();
      expect(preserved).toContain('> Source: https://example.com/article');
      expect(preserved).toContain('> Captured: 2025-08-15T10:00:59.401Z');
      expect(preserved).toContain('> Hash: https://example.com/article-abcdef123');
    }

    // Ensure there is only one cite-first block present
    const occurrences = (result.markdown.match(/^> Source:/gm) || []).length;
    expect(occurrences).toBe(1);
  });
});
