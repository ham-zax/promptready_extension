// API Validation Service Tests
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateApiKey, validateOpenRouter, validateOpenAI, validateZAI } from '@/lib/api-validation';

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

    it('should validate OpenAI key format', async () => {
      const result = await validateApiKey({
        provider: 'manual',
        apiKey: 'invalid-key-format',
        apiBase: 'https://api.openai.com/v1',
      });

      expect(result.isValid).toBe(false);
      expect(result.message).toBe('OpenAI-compatible keys should start with "sk-"');
    });

    it('should validate API base URL format', async () => {
      const result = await validateApiKey({
        provider: 'manual',
        apiKey: 'sk-validkey123',
        apiBase: 'invalid-url',
      });

      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Please enter a valid API base URL');
    });
  });

  describe('validateOpenRouter', () => {
    it('should handle successful validation', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: {
            balance: 10.50,
            organization: 'test-org',
          },
        }),
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await validateOpenRouter('sk-or-v1-valid-key');

      expect(result.isValid).toBe(true);
      expect(result.message).toContain('✅ Valid OpenRouter key');
      expect(result.details?.balance).toBe(10.50);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/auth/key',
        {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer sk-or-v1-valid-key',
            'Content-Type': 'application/json',
          },
        }
      );
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
  });

  describe('validateOpenAI', () => {
    it('should handle successful validation with models', async () => {
      const mockModelsResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [
            { id: 'gpt-4' },
            { id: 'gpt-3.5-turbo' },
          ],
        }),
      };

      (global.fetch as any).mockResolvedValue(mockModelsResponse);

      const result = await validateOpenAI('sk-valid-key', 'https://api.openai.com/v1');

      expect(result.isValid).toBe(true);
      expect(result.message).toBe('✅ Valid OpenAI-compatible API key');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/models',
        {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer sk-valid-key',
            'Content-Type': 'application/json',
          },
        }
      );
    });

    it('should reject when no compatible models found', async () => {
      const mockModelsResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [
            { id: 'custom-model' },
            { id: 'another-custom' },
          ],
        }),
      };

      (global.fetch as any).mockResolvedValue(mockModelsResponse);

      const result = await validateOpenAI('sk-valid-key', 'https://api.custom.com/v1');

      expect(result.isValid).toBe(false);
      expect(result.message).toBe('API key valid but no compatible models found.');
    });

    it('should handle invalid URL resolution', async () => {
      (global.fetch as any).mockRejectedValue(new Error('ERR_NAME_NOT_RESOLVED'));

      const result = await validateOpenAI('sk-valid-key', 'https://invalid-url.example');

      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Invalid API base URL. Please check server address.');
    });
  });

  describe('validateZAI', () => {
    it('should handle successful validation', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [
            { id: 'z.ai-flash' },
          ],
        }),
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await validateZAI('z.ai-valid-key');

      expect(result.isValid).toBe(true);
      expect(result.message).toBe('✅ Valid Z.AI API key');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.z.ai/v1/models',
        {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer z.ai-valid-key',
            'Content-Type': 'application/json',
          },
        }
      );
    });

    it('should handle 401 unauthorized', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await validateZAI('invalid-key');

      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Invalid Z.AI API key.');
    });
  });

  describe('Error handling', () => {
    it('should handle unknown provider', async () => {
      const result = await validateApiKey({
        provider: 'unknown' as any,
        apiKey: 'some-key',
        apiBase: 'https://api.example.com/v1',
      });

      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Unknown provider');
    });

    it('should provide fallback error message', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Unexpected error'));

      const result = await validateOpenAI('sk-key', 'https://api.openai.com/v1');

      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Failed to validate API key. Please check URL and key.');
    });
  });
});