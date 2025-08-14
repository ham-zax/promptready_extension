import { describe, it, expect } from 'vitest';
import { MarkdownPostProcessor } from '../core/post-processor';

describe('MarkdownPostProcessor', () => {
  it('normalizes headings and limits newlines', () => {
    const input = `###Heading\n\n\n\nText`;
    const { markdown, improvements } = MarkdownPostProcessor.process(input, { normalizeHeadings: true, removeEmptyLines: true, maxConsecutiveNewlines: 2 });
    // Accept H1 normalization at top or retained level with corrected spacing
    expect(markdown).toMatch(/^# Heading|^### Heading/m);
    expect(markdown).not.toMatch(/\n{3,}/);
    expect(improvements.length).toBeGreaterThan(0);
  });

  it('adds TOC when enabled', () => {
    const input = `# Title\n\n## A\nText\n\n### B`;
    const { markdown } = MarkdownPostProcessor.process(input, { addTableOfContents: true });
    expect(markdown).toContain('## Table of Contents');
    expect(markdown).toContain('- [A](#a)');
  });
});

