// API Validation Service Tests
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateApiKey } from '@/lib/api-validation';

// Mock fetch for testing (though validateOpenRouter no longer uses it)
global.fetch = vi.fn();

describe('API Validation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateApiKey', () => {
    it('should reject empty API key', async () => {
      const result = await validateApiKey({
        provider: 'openrouter',
        apiKey: '',
        apiBase: 'https://openrouter.ai/api/v1',
      });

      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Please enter an API key');
    });

    it('should accept non-empty OpenRouter tokens without pinning a prefix', async () => {
      const result = await validateApiKey({
        provider: 'openrouter',
        apiKey: 'or-new-format-token',
        apiBase: 'https://openrouter.ai/api/v1',
      });

      expect(result.isValid).toBe(true);
      expect(result.message).toBe('Key format looks valid. It will be verified on first AI request.');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('trims pasted API keys before local validation', async () => {
      const result = await validateApiKey({
        provider: 'openrouter',
        apiKey: '  sk-or-v1-valid-key\n',
        apiBase: 'https://openrouter.ai/api/v1',
      });

      expect(result.isValid).toBe(true);
      expect(result.message).toBe('Key format looks valid. It will be verified on first AI request.');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejects values that contain whitespace inside the token', async () => {
      const result = await validateApiKey({
        provider: 'openrouter',
        apiKey: 'Bearer sk-or-v1-valid-key',
        apiBase: 'https://openrouter.ai/api/v1',
      });

      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Paste the API key only, without spaces or the Bearer prefix.');
    });

    it('rejects invalid OpenRouter API base URL', async () => {
      const result = await validateApiKey({
        provider: 'openrouter',
        apiKey: 'sk-or-v1-valid-key',
        apiBase: 'invalid-url',
      });

      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Please enter a valid OpenRouter API base URL');
    });

    it('fails closed for non-openrouter provider values at runtime', async () => {
      const result = await validateApiKey({
        provider: 'manual' as any,
        apiKey: 'sk-or-v1-valid-key',
        apiBase: 'https://api.openai.com/v1',
      });

      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Only OpenRouter BYOK is supported right now.');
    });

    it('should return success for valid key format (local-only)', async () => {
      const result = await validateApiKey({
        provider: 'openrouter',
        apiKey: 'sk-or-v1-valid-key-format',
        apiBase: 'https://openrouter.ai/api/v1',
      });

      expect(result.isValid).toBe(true);
      expect(result.message).toBe('Key format looks valid. It will be verified on first AI request.');
      // Should NOT make any fetch calls (validation is local-only)
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
