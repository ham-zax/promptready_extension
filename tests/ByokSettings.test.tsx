import React from 'react';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ByokSettings } from '../entrypoints/popup/components/ByokSettings';
import type { Settings } from '../lib/types';

// Minimal Storage mock (ByokSettings doesn't call Storage directly but the app has a global mock pattern)
vi.mock('../lib/storage', () => ({
  Storage: {
    updateSettings: vi.fn(),
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ByokSettings', () => {
  it('shows BYOK Choice view when provider is not set', () => {
    const settings = {
      mode: 'offline',
      templates: { bundles: [] },
      byok: {} as any,
      flags: { byokEnabled: true },
    } as unknown as Settings;

    const onSettingsChange = vi.fn();
    const onApiKeyChange = vi.fn();
    const onApiKeySave = vi.fn();
    const onApiKeyTest = vi.fn();

    render(
      <ByokSettings
        settings={settings}
        onSettingsChange={onSettingsChange}
        onApiKeyChange={onApiKeyChange}
        onApiKeySave={onApiKeySave}
        onApiKeyTest={onApiKeyTest}
        hasApiKey={false}
        apiKeyInput={''}
      />
    );

    // Choice view contains the heading text from ByokChoice
    expect(screen.getByText('Connect your AI Provider')).toBeTruthy();

    // The two provider buttons should be visible
    expect(screen.getByText('OpenRouter')).toBeTruthy();
    expect(screen.getByText('Manual')).toBeTruthy();
  });

  it('selecting a provider calls onSettingsChange and shows configuration view', () => {
    const settings = {
      mode: 'offline',
      templates: { bundles: [] },
      byok: {} as any,
      flags: { byokEnabled: true },
    } as unknown as Settings;

    const onSettingsChange = vi.fn();
    const onApiKeyChange = vi.fn();
    const onApiKeySave = vi.fn();
    const onApiKeyTest = vi.fn();

    render(
      <ByokSettings
        settings={settings}
        onSettingsChange={onSettingsChange}
        onApiKeyChange={onApiKeyChange}
        onApiKeySave={onApiKeySave}
        onApiKeyTest={onApiKeyTest}
        hasApiKey={false}
        apiKeyInput={''}
      />
    );

    // Click OpenRouter choice
    const openRouterBtn = screen.getByText('OpenRouter');
    fireEvent.click(openRouterBtn);

    // onSettingsChange should be called with byok.provider set to 'openrouter'
    expect(onSettingsChange).toHaveBeenCalled();
    const callArg = onSettingsChange.mock.calls[0][0] as any;
    expect(callArg?.byok?.provider).toBe('openrouter');

    // After choosing provider the configuration view should be visible (API Key label)
    expect(screen.getByText('API Key')).toBeTruthy();
  });

  it('shows Remove Key button only when hasApiKey is true and confirms removal', () => {
    const settings = {
      mode: 'offline',
      templates: { bundles: [] },
      byok: { provider: 'openrouter', apiKey: 'secret', apiBase: '', model: '' } as any,
      flags: { byokEnabled: true },
    } as unknown as Settings;

    const onSettingsChange = vi.fn();
    const onApiKeyChange = vi.fn();
    const onApiKeySave = vi.fn();
    const onApiKeyTest = vi.fn();

    render(
      <ByokSettings
        settings={settings}
        onSettingsChange={onSettingsChange}
        onApiKeyChange={onApiKeyChange}
        onApiKeySave={onApiKeySave}
        onApiKeyTest={onApiKeyTest}
        hasApiKey={true}
        apiKeyInput={'secret'}
      />
    );

    // Remove Key button should be visible
    const removeBtn = screen.getByText('Remove Key');
    expect(removeBtn).toBeTruthy();

    // Open the dialog by clicking the button
    fireEvent.click(removeBtn);

    // Confirm & Remove button should appear in the dialog
    const confirmBtn = screen.getByText('Confirm & Remove');
    expect(confirmBtn).toBeTruthy();

    // Click confirm
    fireEvent.click(confirmBtn);

    // Expect callbacks to be invoked to clear the API key
    expect(onSettingsChange).toHaveBeenCalled();
    // Should set byok.apiKey to empty string
    const settingsArg = onSettingsChange.mock.calls[0][0] as any;
    expect(settingsArg?.byok?.apiKey).toBe('');

    expect(onApiKeyChange).toHaveBeenCalledWith('');
  });
});