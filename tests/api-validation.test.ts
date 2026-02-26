// API Validation Service Tests
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateApiKey, validateOpenRouter } from '@/lib/api-validation';

// Mock fetch for testing
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

    it('should validate OpenRouter key format', async () => {
      const result = await validateApiKey({
        provider: 'openrouter',
        apiKey: 'invalid-key-format',
        apiBase: 'https://openrouter.ai/api/v1',
      });

      expect(result.isValid).toBe(false);
      expect(result.message).toBe('OpenRouter keys should start with "sk-or-v1-"');
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
  });

  describe('validateOpenRouter', () => {
    it('should handle successful validation', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: {
            balance: 10.5,
            organization: 'test-org',
          },
        }),
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await validateOpenRouter('sk-or-v1-valid-key');

      expect(result.isValid).toBe(true);
      expect(result.message).toContain('✅ Valid OpenRouter key');
      expect(result.details?.balance).toBe(10.5);
      expect(global.fetch).toHaveBeenCalledWith('https://openrouter.ai/api/v1/auth/key', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer sk-or-v1-valid-key',
          'Content-Type': 'application/json',
        },
      });
    });

    it('should handle 401 unauthorized', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await validateOpenRouter('invalid-key');

      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Invalid API key. Please check your OpenRouter key.');
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Failed to fetch'));

      const result = await validateOpenRouter('sk-or-v1-valid-key');

      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Network error. Please check your internet connection.');
    });

    it('should provide fallback error message for unknown failures', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Unexpected error'));

      const result = await validateOpenRouter('sk-or-v1-valid-key');

      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Failed to validate OpenRouter key. Please try again.');
    });
  });
});
