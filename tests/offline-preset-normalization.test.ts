import { describe, expect, it } from 'vitest';
import { OfflineModeManager } from '../core/offline-mode-manager';

function buildLongText(minChars: number): string {
  const seed =
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ';
  let text = '';
  while (text.length < minChars) text += seed;
  return text;
}

describe('offline preset normalization', () => {
  it('treats readabilityPreset="standard" as auto and maps turndownPreset aliases (no fallback)', async () => {
    const longText = buildLongText(700);
    const html = `<!doctype html><html><body>
      <article>
        <h1>Example Title</h1>
        <p>${longText}</p>
        <p>${longText}</p>
        <pre><code class="language-js">const x = 1;\nconsole.log(x);\n</code></pre>
      </article>
    </body></html>`;

    const result = await OfflineModeManager.processContent(
      html,
      'https://example.com/docs/guide',
      'Example Title',
      {
        readabilityPreset: 'standard',
        turndownPreset: 'github-flavored',
        performance: {
          maxContentLength: 1_000_000,
          enableCaching: false,
          chunkSize: 100_000,
        },
      }
    );

    expect(result.success).toBe(true);
    expect(result.processingStats.fallbacksUsed).not.toContain('readability-fallback');
    expect(result.processingStats.fallbacksUsed).not.toContain('turndown-fallback');
    expect(result.markdown).toContain('Example Title');
    expect(result.markdown).toContain('```');
    expect(result.markdown).toContain('const x = 1');
  }, 10000);

  it('applies processing profile presets and normalizes alias names', async () => {
    const settings = {
      processing: {
        profile: 'technical',
        readabilityPreset: 'technical-documentation',
        turndownPreset: 'github-flavored',
      },
    };

    const config = await OfflineModeManager.getOptimalConfig('https://example.com/', settings);
    expect(config.readabilityPreset).toBe('technical-documentation');
    expect(config.turndownPreset).toBe('github');
  });
});

