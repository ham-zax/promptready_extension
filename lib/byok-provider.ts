import type { Settings } from './types.js';

export interface ByokProviderNormalization {
  canonicalProvider: Settings['byok']['provider'];
  rawProvider: string | null;
  wasLegacyAlias: boolean;
  isSupported: boolean;
}

const LEGACY_PROVIDER_ALIASES = new Set<string>(['manual', 'z.ai']);

/**
 * OpenRouter is the only supported BYOK provider.
 * Legacy aliases are normalized to the canonical OpenRouter provider.
 */
export function normalizeByokProvider(provider: unknown): ByokProviderNormalization {
  if (typeof provider !== 'string' || provider.trim().length === 0) {
    return {
      canonicalProvider: 'openrouter',
      rawProvider: null,
      wasLegacyAlias: false,
      isSupported: true,
    };
  }

  const rawProvider = provider.trim().toLowerCase();
  if (rawProvider === 'openrouter') {
    return {
      canonicalProvider: 'openrouter',
      rawProvider,
      wasLegacyAlias: false,
      isSupported: true,
    };
  }

  if (LEGACY_PROVIDER_ALIASES.has(rawProvider)) {
    return {
      canonicalProvider: 'openrouter',
      rawProvider,
      wasLegacyAlias: true,
      isSupported: true,
    };
  }

  return {
    canonicalProvider: 'openrouter',
    rawProvider,
    wasLegacyAlias: false,
    isSupported: false,
  };
}
