import React from 'react';
import { render, fireEvent, screen, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ModeToggle } from '../entrypoints/popup/components/ModeToggle';
import { authService } from '../lib/auth-service';

vi.mock('../lib/auth-service', () => ({
  authService: {
    getAuthState: vi.fn().mockResolvedValue({
      isAuthenticated: true,
      isDeveloperMode: true,
      hasUnlimitedAccess: true,
      canUseAIMode: true,
      planType: 'developer',
      hasApiKey: false,
      isUnlocked: true,
      remainingFreeByokUsesToday: 999999,
      remainingFreeByokStartsToday: 999999,
      aiLockReason: null,
    }),
  },
}));

describe('ModeToggle', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders with AI mode selected by default', () => {
    render(
      <ModeToggle
        mode="ai"
        onChange={() => {}}
        onUpgradePrompt={() => {}}
      />
    );
    const aiButton = screen.getByLabelText('AI Mode');
    expect(aiButton).toHaveAttribute('data-state', 'on');
  });

  it('calls onChange when a new mode is selected', async () => {
    const handleChange = vi.fn();
    render(
      <ModeToggle
        mode="ai"
        onChange={handleChange}
        onUpgradePrompt={() => {}}
      />
    );

    const offlineButton = screen.getByLabelText('Offline Mode');
    fireEvent.click(offlineButton);

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith('offline');
    });
  });

  it('calls onUpgradePrompt when AI mode is locked', async () => {
    const handleUpgradePrompt = vi.fn();
    const handleChange = vi.fn();

    const lockedAuthState = {
      isAuthenticated: true,
      isDeveloperMode: false,
      hasUnlimitedAccess: false,
      canUseAIMode: false,
      planType: 'free',
      hasApiKey: false,
      isUnlocked: false,
      remainingFreeByokUsesToday: 0,
      remainingFreeByokStartsToday: 0,
      aiLockReason: 'daily_limit_reached',
    } as const;
    vi.mocked(authService.getAuthState)
      .mockResolvedValueOnce(lockedAuthState)
      .mockResolvedValueOnce(lockedAuthState);

    render(
      <ModeToggle
        mode="offline"
        onChange={handleChange}
        onUpgradePrompt={handleUpgradePrompt}
      />
    );

    const aiButton = await screen.findByLabelText('AI Mode');
    expect(aiButton).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(aiButton);

    await waitFor(() => {
      expect(handleUpgradePrompt).toHaveBeenCalled();
    });
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('uses fresh auth state before routing AI clicks to settings', async () => {
    const handleUpgradePrompt = vi.fn();
    const handleChange = vi.fn();

    vi.mocked(authService.getAuthState)
      .mockResolvedValueOnce({
        isAuthenticated: true,
        isDeveloperMode: false,
        hasUnlimitedAccess: false,
        canUseAIMode: false,
        planType: 'free',
        hasApiKey: false,
        isUnlocked: false,
        remainingFreeByokUsesToday: 5,
        remainingFreeByokStartsToday: 5,
        aiLockReason: 'missing_api_key',
      })
      .mockResolvedValueOnce({
        isAuthenticated: true,
        isDeveloperMode: false,
        hasUnlimitedAccess: false,
        canUseAIMode: true,
        planType: 'free',
        hasApiKey: true,
        isUnlocked: false,
        remainingFreeByokUsesToday: 5,
        remainingFreeByokStartsToday: 5,
        aiLockReason: null,
      });

    render(
      <ModeToggle
        mode="offline"
        onChange={handleChange}
        onUpgradePrompt={handleUpgradePrompt}
      />
    );

    const aiButton = await screen.findByLabelText('AI Mode');
    expect(aiButton).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(aiButton);

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith('ai');
    });
    expect(handleUpgradePrompt).not.toHaveBeenCalled();
  });
});
