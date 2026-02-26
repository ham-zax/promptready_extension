import { describe, expect, it } from 'vitest';
import { applyOfflineUrlConfigRule, type UrlConfigRuleConfig } from '../core/offline-url-config-rules';

function createConfig(): UrlConfigRuleConfig {
  return {
    readabilityPreset: undefined,
    turndownPreset: 'standard',
    postProcessing: {
      enabled: true,
      addTableOfContents: false,
      optimizeForPlatform: 'standard',
    },
  };
}

describe('offline-url-config-rules', () => {
  it('applies technical-docs profile for github urls', () => {
    const config = createConfig();

    const ruleId = applyOfflineUrlConfigRule('https://github.com/openai/openai-node', config);

    expect(ruleId).toBe('technical-docs');
    expect(config.readabilityPreset).toBe('technical-documentation');
    expect(config.turndownPreset).toBe('github');
    expect(config.postProcessing.optimizeForPlatform).toBe('github');
  });

  it('applies wiki profile for wikipedia urls', () => {
    const config = createConfig();

    const ruleId = applyOfflineUrlConfigRule('https://en.wikipedia.org/wiki/Prompt_engineering', config);

    expect(ruleId).toBe('wiki');
    expect(config.readabilityPreset).toBe('wiki-content');
    expect(config.postProcessing.addTableOfContents).toBe(true);
  });

  it('returns null and leaves config unchanged when no rule matches', () => {
    const config = createConfig();

    const ruleId = applyOfflineUrlConfigRule('https://example.com/product/overview', config);

    expect(ruleId).toBeNull();
    expect(config).toEqual(createConfig());
  });
});
