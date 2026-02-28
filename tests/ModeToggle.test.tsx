import React from 'react';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
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

  it('calls onChange when a new mode is selected', () => {
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

    expect(handleChange).toHaveBeenCalledWith('offline');
  });

  it('calls onUpgradePrompt when AI mode is locked', async () => {
    const handleUpgradePrompt = vi.fn();
    const handleChange = vi.fn();

    vi.mocked(authService.getAuthState).mockResolvedValueOnce({
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

    expect(handleUpgradePrompt).toHaveBeenCalled();
    expect(handleChange).not.toHaveBeenCalled();
  });
});
