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

// Mock the dialog UI (Radix-based) to avoid pulling in runtime deps like react-remove-scroll in tests
vi.mock('@/components/ui/dialog', () => {
  const Passthrough = ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children);
  return {
    Dialog: Passthrough,
    DialogTrigger: ({ children }: { children: React.ReactNode }) => children,
    DialogContent: Passthrough,
    DialogTitle: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
    DialogDescription: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
    DialogFooter: Passthrough,
    DialogClose: ({ children }: { children: React.ReactNode }) => children,
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ByokSettings', () => {
  it('renders OpenRouter-only configuration view when provider is not set', () => {
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

    expect(screen.getByText('AI Configuration')).toBeTruthy();
    expect(screen.getByText('API Key (OpenRouter)')).toBeTruthy();
    expect(onSettingsChange).not.toHaveBeenCalled();
  });

  it('shows OpenRouter model configuration when API key exists', () => {
    const settings = {
      mode: 'offline',
      templates: { bundles: [] },
      byok: {
        provider: 'openrouter',
        apiBase: 'https://openrouter.ai/api/v1',
        selectedByokModel: 'arcee-ai/trinity-large-preview:free',
      } as any,
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
        apiKeyInput={'sk-or-v1-test'}
      />
    );

    expect(screen.getByText('API Key (OpenRouter)')).toBeTruthy();
    expect(screen.getByText('Model')).toBeTruthy();
    expect(onSettingsChange).not.toHaveBeenCalled();
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
