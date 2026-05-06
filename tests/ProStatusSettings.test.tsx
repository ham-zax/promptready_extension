import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProStatusSettings } from '@/entrypoints/popup/components/ProStatusSettings';
import type { Settings } from '@/lib/types';

afterEach(() => {
  cleanup();
});

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    mode: 'ai',
    templates: { bundles: [] },
    byok: {
      provider: 'openrouter',
      apiBase: 'https://openrouter.ai/api/v1',
      apiKey: 'sk-or-v1-test',
      model: 'arcee-ai/trinity-large-preview:free',
      selectedByokModel: 'arcee-ai/trinity-large-preview:free',
      customPrompt: '',
    },
    byokUsage: {
      dayKey: '2026-02-28',
      successfulAiCount: 5,
      inflightRuns: {},
      countedSuccessIds: ['a', 'b', 'c', 'd', 'e'],
    },
    privacy: { telemetryEnabled: false },
    flags: {
      aiModeEnabled: true,
      byokEnabled: true,
      trialEnabled: true,
      developerMode: false,
    },
    ...overrides,
  };
}

describe('ProStatusSettings release copy', () => {
  it('does not render checkout, unlock, or unlimited BYOK controls', () => {
    const { container } = render(
      <ProStatusSettings
        settings={makeSettings()}
        onSettingsChange={vi.fn()}
      />
    );

    expect(screen.getByText('AI Access')).toBeTruthy();
    const text = container.textContent?.toLowerCase() || '';

    expect(text).toContain('5 successful byok ai cleanups per local day');
    expect(text).not.toContain('checkout');
    expect(text).not.toContain('unlock');
    expect(text).not.toContain('unlimited');
  });
});
