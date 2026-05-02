import { describe, expect, it } from 'vitest';

import { buildByokPrompt } from '@/core/prompts/byok-prompt';

describe('BYOK markdown prompt template', () => {
  it('injects source metadata, optional metadata HTML, and HTML payload into prompt template', () => {
    const prompt = buildByokPrompt({
      html: '<article><h1>Hello</h1><p>World</p></article>',
      offlineMarkdownBaseline: '# Hello\n\nWorld',
      url: 'https://example.com/post',
      title: 'Example Post',
      capturedAt: '2026-02-28T00:00:00.000Z',
      selectionHash: 'sel-abc-123',
      metadataHtml: '<meta property="article:published_time" content="2026-02-27T10:00:00Z" />',
      customPrompt: 'Prefer concise bullet points for long sections.',
    });

    expect(prompt).toContain('Title: Example Post');
    expect(prompt).toContain('URL: https://example.com/post');
    expect(prompt).toContain('Captured At: 2026-02-28T00:00:00.000Z');
    expect(prompt).toContain('Selection Hash: sel-abc-123');
    expect(prompt).toContain('<user_preference>');
    expect(prompt).toContain('Prefer concise bullet points for long sections.');
    expect(prompt).toContain('<offline_markdown_baseline>');
    expect(prompt).toContain('# Hello\n\nWorld');
    expect(prompt).toContain('Treat the offline Markdown baseline as the primary source for section order, heading hierarchy, lists, code fences, inline code, and config blocks.');
    expect(prompt).toContain('Use captured HTML only as secondary recovery context when the baseline is clearly missing or malformed.');
    expect(prompt).toContain('Do not convert Markdown headings into bold labels.');
    expect(prompt).toContain('Do not drop sections from the offline Markdown baseline.');
    expect(prompt).toContain('<metadata_html>');
    expect(prompt).toContain('article:published_time');
    expect(prompt).toContain('<captured_html>');
    expect(prompt).toContain('<article><h1>Hello</h1><p>World</p></article>');
  });

  it('prunes noisy script/style blocks while keeping JSON-LD in HTML prompt payload', () => {
    const prompt = buildByokPrompt({
      html: [
        '<style>.hero{display:none}</style>',
        '<script>window.__analytics = true;</script>',
        '<script type="application/ld+json">{"@type":"WebPage"}</script>',
        '<article><h1>Signal</h1><p>Body</p></article>',
      ].join('\n'),
      url: 'https://example.com/signal',
      title: 'Signal',
      capturedAt: '2026-02-28T00:00:00.000Z',
      selectionHash: 'sel-prune',
    });

    expect(prompt).not.toContain('window.__analytics');
    expect(prompt).not.toContain('.hero{display:none}');
    expect(prompt).toContain('application/ld+json');
    expect(prompt).toContain('<article><h1>Signal</h1><p>Body</p></article>');
  });

  it('adds a deterministic truncation marker when HTML exceeds prompt limit', () => {
    const veryLargeHtml = `<div>${'x'.repeat(130_000)}</div>`;

    const prompt = buildByokPrompt({
      html: veryLargeHtml,
      url: 'https://example.com/huge',
      title: 'Huge Input',
      capturedAt: '2026-02-28T00:00:00.000Z',
      selectionHash: 'sel-huge',
    });

    expect(prompt).toContain('PROMPTREADY_HTML_TRUNCATED');
    expect(prompt.length).toBeLessThan(130_000 + 3_000);
  });

  it('prioritizes offline baseline and caps total source payload when both baseline and HTML are large', () => {
    const prompt = buildByokPrompt({
      html: `<article>${'h'.repeat(130_000)}</article>`,
      offlineMarkdownBaseline: `# Baseline\n\n${'b'.repeat(130_000)}`,
      url: 'https://example.com/large-ai',
      title: 'Large AI Input',
      capturedAt: '2026-02-28T00:00:00.000Z',
      selectionHash: 'sel-large-ai',
    });

    expect(prompt).toContain('# Baseline');
    expect(prompt).toContain('PROMPTREADY_OFFLINE_MARKDOWN_TRUNCATED');
    expect(prompt).toContain('PROMPTREADY_HTML_TRUNCATED');
    expect(prompt.length).toBeLessThan(155_000);
  });

  it('does not let leftover source budget raise the HTML payload cap', () => {
    const prompt = buildByokPrompt({
      html: `<article>${'h'.repeat(130_000)}</article>`,
      offlineMarkdownBaseline: '# Small baseline',
      url: 'https://example.com/small-baseline-large-html',
      title: 'Small Baseline Large HTML',
      capturedAt: '2026-02-28T00:00:00.000Z',
      selectionHash: 'sel-small-baseline-large-html',
    });

    const truncation = prompt.match(/PROMPTREADY_HTML_TRUNCATED:(\d+)/);
    expect(truncation?.[1]).toBeDefined();
    expect(Number(truncation?.[1])).toBeGreaterThan(9_000);
  });

  it('adds a deterministic truncation marker when metadata HTML exceeds prompt limit', () => {
    const hugeMetadata = `<meta data-x="${'m'.repeat(25_000)}" />`;

    const prompt = buildByokPrompt({
      html: '<p>small</p>',
      url: 'https://example.com/meta',
      title: 'Meta Input',
      capturedAt: '2026-02-28T00:00:00.000Z',
      selectionHash: 'sel-meta',
      metadataHtml: hugeMetadata,
    });

    expect(prompt).toContain('PROMPTREADY_METADATA_HTML_TRUNCATED');
  });

  it('normalizes and caps custom prompt preference deterministically', () => {
    const customPrompt = `  Keep   headings concise.\n\n\n${'x'.repeat(1200)}  `;

    const prompt = buildByokPrompt({
      html: '<p>small</p>',
      url: 'https://example.com/custom',
      title: 'Custom Prompt',
      capturedAt: '2026-02-28T00:00:00.000Z',
      selectionHash: 'sel-custom',
      customPrompt,
    });

    expect(prompt).toContain('<user_preference>');
    expect(prompt).toContain('Keep headings concise.');
    expect(prompt).toContain('PROMPTREADY_CUSTOM_PROMPT_TRUNCATED');
  });
});
