// Hook Tests
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useByokManager } from '@/entrypoints/popup/hooks/useByokManager';
import { useProManager } from '@/entrypoints/popup/hooks/useProManager';
import { useErrorHandler } from '@/entrypoints/popup/hooks/useErrorHandler';
import { useToastManager } from '@/entrypoints/popup/hooks/useToastManager';
import { Storage } from '@/lib/storage';

// Mock Storage
vi.mock('@/lib/storage', () => ({
  Storage: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    clearApiKey: vi.fn(),
  },
}));

describe('useByokManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useByokManager());

    expect(result.current.provider).toBe('openrouter');
    expect(result.current.apiKey).toBe('');
    expect(result.current.hasApiKey).toBe(false);
    expect(result.current.isValid).toBe(false);
  });

  it('should load configuration from storage', async () => {
    const mockSettings = {
      byok: {
        provider: 'manual',
        apiKey: 'sk-test123',
        apiBase: 'https://api.custom.com/v1',
        selectedByokModel: 'custom-model',
      },
    };

    (Storage.getSettings as any).mockResolvedValue(mockSettings);

    const { result } = renderHook(() => useByokManager());

    await waitFor(() => {
      expect(result.current.provider).toBe('manual');
      expect(result.current.apiKey).toBe('sk-test123');
      expect(result.current.apiBase).toBe('https://api.custom.com/v1');
      expect(result.current.selectedModel).toBe('custom-model');
      expect(result.current.hasApiKey).toBe(true);
    });
  });

  it('should update provider and reset defaults', () => {
    const { result } = renderHook(() => useByokManager());

    act(() => {
      result.current.setProvider('manual');
    });

    expect(result.current.provider).toBe('manual');
    expect(result.current.apiBase).toBe('https://api.openai.com/v1');
    expect(result.current.selectedModel).toBe('gpt-4');
    expect(result.current.isValid).toBe(false);
  });

  it('should update API key and trigger validation', () => {
    const { result } = renderHook(() => useByokManager());

    act(() => {
      result.current.setApiKey('sk-or-v1-test123');
    });

    expect(result.current.apiKey).toBe('sk-or-v1-test123');
    expect(result.current.hasApiKey).toBe(true);
  });

  it('should save configuration when valid', async () => {
    const { result } = renderHook(() => useByokManager());

    // Set up valid state
    act(() => {
      result.current.setApiKey('sk-or-v1-valid123');
      result.current.setProvider('openrouter');
    });

    await act(async () => {
      await result.current.saveConfiguration();
    });

    expect(Storage.updateSettings).toHaveBeenCalledWith({
      byok: {
        provider: 'openrouter',
        apiKey: 'sk-or-v1-valid123',
        apiBase: 'https://openrouter.ai/api/v1',
        selectedByokModel: 'anthropic/claude-3.5-sonnet',
      },
      isPro: true,
      trial: { hasExhausted: false, showUpgradePrompt: false },
    });
  });
});

describe('useProManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useProManager());

    expect(result.current.isPro).toBe(false);
    expect(result.current.isInTrial).toBe(false);
    expect(result.current.daysRemaining).toBe(0);
    expect(result.current.showUpgradePrompt).toBe(false);
  });

  it('should load Pro status from storage', async () => {
    const mockSettings = {
      isPro: true,
      trial: {
        startedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        expiresAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days left
      },
    };

    (Storage.getSettings as any).mockResolvedValue(mockSettings);

    const { result } = renderHook(() => useProManager());

    await waitFor(() => {
      expect(result.current.isPro).toBe(true);
      expect(result.current.isInTrial).toBe(true);
      expect(result.current.daysRemaining).toBe(4);
    });
  });

  it('should start trial successfully', async () => {
    const { result } = renderHook(() => useProManager());

    await act(async () => {
      await result.current.startTrial('test@example.com');
    });

    expect(Storage.updateSettings).toHaveBeenCalledWith({
      isPro: true,
      trial: {
        hasExhausted: false,
        showUpgradePrompt: false,
        startedAt: expect.any(String),
        expiresAt: expect.any(String),
      },
      user: { email: 'test@example.com' },
    });

    expect(result.current.isPro).toBe(true);
    expect(result.current.isInTrial).toBe(true);
    expect(result.current.daysRemaining).toBe(7);
  });

  it('should reject invalid email for trial', async () => {
    const { result } = renderHook(() => useProManager());

    await expect(
      act(async () => {
        await result.current.startTrial('invalid-email');
      })
    ).rejects.toThrow('Valid email address required');
  });
});

describe('useErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show error with code', () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.showError('Test error', 'VALIDATION_ERROR');
    });

    expect(result.current.hasError).toBe(true);
    expect(result.current.error?.code).toBe('VALIDATION_ERROR');
    expect(result.current.error?.message).toBe('Invalid input. Please check your information and try again.');
  });

  it('should show success message', () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.showSuccess('Success message');
    });

    expect(result.current.hasError).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should maintain error history', () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.showError('First error');
    });

    act(() => {
      result.current.showError('Second error');
    });

    expect(result.current.errorHistory).toHaveLength(2);
    expect(result.current.errorHistory[0].message).toBe('First error');
    expect(result.current.errorHistory[1].message).toBe('Second error');
  });

  it('should clear error', () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.showError('Test error');
    });

    act(() => {
      result.current.clearError();
    });

    expect(result.current.hasError).toBe(false);
    expect(result.current.error).toBe(null);
  });
});

describe('useToastManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should show toast with default duration', () => {
    const { result } = renderHook(() => useToastManager());

    act(() => {
      result.current.showToast('Test message');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Test message');
    expect(result.current.toasts[0].type).toBe('info');
    expect(result.current.toasts[0].duration).toBe(3000);
  });

  it('should show different toast types', () => {
    const { result } = renderHook(() => useToastManager());

    act(() => {
      result.current.showSuccess('Success message');
      result.current.showError('Error message');
      result.current.showWarning('Warning message');
      result.current.showInfo('Info message');
    });

    const toasts = result.current.toasts;
    expect(toasts).toHaveLength(4);
    expect(toasts[0].type).toBe('success');
    expect(toasts[1].type).toBe('error');
    expect(toasts[2].type).toBe('warning');
    expect(toasts[3].type).toBe('info');
  });

  it('should auto-hide toast after duration', () => {
    const { result } = renderHook(() => useToastManager());

    act(() => {
      result.current.showToast('Test message', 'info', 1000);
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('should limit maximum concurrent toasts', () => {
    const { result } = renderHook(() => useToastManager());

    act(() => {
      for (let i = 0; i < 10; i++) {
        result.current.showToast(`Message ${i}`);
      }
    });

    expect(result.current.toasts).toHaveLength(5); // MAX_TOASTS
    expect(result.current.toasts[0].message).toBe('Message 5'); // Should keep last 5
    expect(result.current.toasts[4].message).toBe('Message 9');
  });

  it('should hide specific toast', () => {
    const { result } = renderHook(() => useToastManager());

    act(() => {
      result.current.showToast('Message 1');
      result.current.showToast('Message 2');
    });

    const toastId = result.current.toasts[0].id;

    act(() => {
      result.current.hideToast(toastId);
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Message 2');
  });

  it('should clear all toasts', () => {
    const { result } = renderHook(() => useToastManager());

    act(() => {
      result.current.showToast('Message 1');
      result.current.showToast('Message 2');
    });

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.toasts).toHaveLength(0);
  });
});