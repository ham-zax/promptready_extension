import { describe, it, expect } from 'vitest';
import { TurndownConfigManager } from '../core/turndown-config';

const sampleHtml = `
  <h1>Title</h1>
  <p>Paragraph with <a href="https://example.com">a link</a>.</p>
  <pre><code class="language-ts">const x: number = 1;</code></pre>
  <img src="/img.png" alt="Alt" title="T" />
`;

describe('TurndownConfigManager', () => {
  it('converts HTML to markdown with standard preset', async () => {
    const md = await TurndownConfigManager.convert(sampleHtml, 'standard');
    expect(md).toContain('# Title');
    expect(md).toContain('[a link](https://example.com)');
    expect(md).toMatch(/```[\s\S]*const x: number = 1;[\s\S]*```/);
    expect(md).toContain('![Alt](/img.png "T")');
  });

  it('applies post-processors and cleans whitespace', async () => {
    const md = await TurndownConfigManager.convert(sampleHtml + '\n\n\n', 'standard');
    expect(md).not.toMatch(/\n{3,}/);
  });

  it('drops inline data images while preserving normal images', async () => {
    const md = await TurndownConfigManager.convert(
      `
        <p>Meaningful paragraph.</p>
        <img src="data:image/png;base64,AAAA" alt="w9I8fQSbfzPEQAAAABJRU5ErkJggg==" />
        <img src="https://example.com/photo.png" alt="Diagram" />
      `,
      'standard'
    );

    expect(md).toContain('Meaningful paragraph.');
    expect(md).toContain('![Diagram](https://example.com/photo.png)');
    expect(md).not.toContain('data:image');
    expect(md).not.toContain('base64');
    expect(md).not.toContain('w9I8fQSbfzPEQAAAABJRU5ErkJggg==');
  });
});

