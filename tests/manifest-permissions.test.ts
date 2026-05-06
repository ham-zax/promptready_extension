import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Chrome release manifest permissions', () => {
  it('uses activeTab plus scripting and only the narrow OpenRouter host permission', () => {
    const configSource = readFileSync(resolve(process.cwd(), 'wxt.config.ts'), 'utf8');

    expect(configSource).toContain('"activeTab"');
    expect(configSource).toContain('"scripting"');
    expect(configSource).toContain('host_permissions');
    expect(configSource).toContain('"https://openrouter.ai/*"');
    expect(configSource).not.toContain('<all_urls>');
  });
});
