import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProcessingProfiles } from '@/entrypoints/popup/components/ProcessingProfiles';
import type { Settings } from '@/lib/types';

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    mode: 'offline',
    templates: { bundles: [] },
    byok: {
      provider: 'openrouter',
      apiBase: 'https://openrouter.ai/api/v1',
      apiKey: '',
      model: 'arcee-ai/trinity-large-preview:free',
      selectedByokModel: 'arcee-ai/trinity-large-preview:free',
    },
    privacy: { telemetryEnabled: false },
    processing: {
      profile: 'standard',
      readabilityPreset: 'standard',
      turndownPreset: 'standard',
      capturePolicy: {
        settleTimeoutMs: 600,
        quietWindowMs: 150,
        deepCaptureEnabled: false,
        maxScrollSteps: 5,
        maxScrollDurationMs: 3000,
        scrollStepDelayMs: 180,
        minTextGainRatio: 0.2,
        minHeadingGain: 2,
      },
      customOptions: {
        preserveCodeBlocks: true,
        includeImages: true,
        preserveTables: true,
        preserveLinks: true,
      },
    },
    isPro: true,
    ...overrides,
  };
}

describe('ProcessingProfiles deep capture toggle', () => {
  it('updates capture policy when deep capture is toggled in advanced settings', () => {
    const onSettingsChange = vi.fn();
    render(<ProcessingProfiles settings={makeSettings()} onSettingsChange={onSettingsChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    expect(screen.getByText('Capture Strategy')).toBeInTheDocument();
    const checkbox = screen.getByRole('checkbox', {
      name: /enable deep capture \(full-page only\)/i,
    }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    fireEvent.click(checkbox);
    expect(onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({
        processing: expect.objectContaining({
          capturePolicy: expect.objectContaining({
            deepCaptureEnabled: true,
          }),
        }),
      }),
    );
  });
});
