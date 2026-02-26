import { describe, expect, it } from 'vitest';
import { normalizeByokProvider } from '@/lib/byok-provider';

describe('normalizeByokProvider', () => {
  it('maps legacy providers to canonical openrouter provider', () => {
    expect(normalizeByokProvider('manual')).toEqual({
      canonicalProvider: 'openrouter',
      rawProvider: 'manual',
      wasLegacyAlias: true,
      isSupported: true,
    });

    expect(normalizeByokProvider('z.ai')).toEqual({
      canonicalProvider: 'openrouter',
      rawProvider: 'z.ai',
      wasLegacyAlias: true,
      isSupported: true,
    });
  });

  it('keeps openrouter as supported canonical provider', () => {
    expect(normalizeByokProvider('openrouter')).toEqual({
      canonicalProvider: 'openrouter',
      rawProvider: 'openrouter',
      wasLegacyAlias: false,
      isSupported: true,
    });
  });

  it('fails closed for unknown providers while preserving canonical fallback', () => {
    expect(normalizeByokProvider('unknown-provider')).toEqual({
      canonicalProvider: 'openrouter',
      rawProvider: 'unknown-provider',
      wasLegacyAlias: false,
      isSupported: false,
    });
  });
});
