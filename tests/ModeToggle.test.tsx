import React from 'react';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ModeToggle } from '../entrypoints/popup/components/ModeToggle';
import { Storage } from '../lib/storage';
import { authService } from '../lib/auth-service';

// Mock the Storage class
vi.mock('../lib/storage', () => ({
  Storage: {
    updateSettings: vi.fn(),
  },
}));

vi.mock('../lib/auth-service', () => ({
  authService: {
    getAuthState: vi.fn().mockResolvedValue({
      isAuthenticated: true,
      isDeveloperMode: true,
      hasUnlimitedAccess: true,
      canUseAIMode: true,
      planType: 'developer',
      remainingCredits: 999999,
      hasApiKey: false,
    }),
  },
}));

describe('ModeToggle', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks(); // Clear mocks after each test
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

  it('calls onChange and updates storage when a new mode is selected', () => {
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
    expect(Storage.updateSettings).toHaveBeenCalledWith({ mode: 'offline' });
  });

  it('calls onUpgradePrompt when a non-pro user clicks AI mode', async () => {
    const handleUpgradePrompt = vi.fn();
    const handleChange = vi.fn();
    vi.mocked(authService.getAuthState).mockResolvedValueOnce({
      isAuthenticated: true,
      isDeveloperMode: false,
      hasUnlimitedAccess: false,
      canUseAIMode: false,
      planType: 'free',
      remainingCredits: 0,
      hasApiKey: false,
    });

    render(
      <ModeToggle
        mode="offline"
        onChange={handleChange}
        onUpgradePrompt={handleUpgradePrompt}
      />
    );

    await screen.findByText('Upgrade required for AI mode');
    const aiButton = screen.getByLabelText('AI Mode');
    fireEvent.click(aiButton);

    expect(handleUpgradePrompt).toHaveBeenCalled();
    expect(handleChange).not.toHaveBeenCalled();
    expect(Storage.updateSettings).not.toHaveBeenCalled();
  });
});
