import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
      contentStrategy: 'auto',
      outputFormat: 'clean-markdown',
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

afterEach(() => {
  cleanup();
});

describe('ProcessingProfiles deep capture toggle', () => {
  it('shows simple strategy and format controls with advanced settings collapsed', () => {
    const onSettingsChange = vi.fn();
    render(<ProcessingProfiles settings={makeSettings()} onSettingsChange={onSettingsChange} />);

    expect(screen.getByLabelText(/content strategy/i)).toHaveValue('auto');
    expect(screen.getByLabelText(/output format/i)).toHaveValue('clean-markdown');
    expect(screen.queryByRole('button', { name: /technical docs/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: /enable deep capture \(full-page only\)/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /advanced capture/i }));
    expect(
      screen.getByRole('checkbox', { name: /enable deep capture \(full-page only\)/i }),
    ).toBeInTheDocument();
  });

  it('updates content strategy without changing output format or capture policy', () => {
    const onSettingsChange = vi.fn();
    const settings = makeSettings({
      processing: {
        ...makeSettings().processing!,
        capturePolicy: {
          ...makeSettings().processing!.capturePolicy!,
          deepCaptureEnabled: true,
        },
      },
    });

    render(<ProcessingProfiles settings={settings} onSettingsChange={onSettingsChange} />);

    fireEvent.change(screen.getByLabelText(/content strategy/i), {
      target: { value: 'technical' },
    });

    expect(onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({
        processing: expect.objectContaining({
          profile: 'technical',
          contentStrategy: 'technical',
          outputFormat: 'clean-markdown',
          readabilityPreset: 'technical-documentation',
          turndownPreset: 'github',
          capturePolicy: expect.objectContaining({
            deepCaptureEnabled: true,
          }),
        }),
      }),
    );
  });

  it('updates output format without changing content strategy', () => {
    const onSettingsChange = vi.fn();
    render(<ProcessingProfiles settings={makeSettings()} onSettingsChange={onSettingsChange} />);

    fireEvent.change(screen.getByLabelText(/output format/i), {
      target: { value: 'obsidian' },
    });

    expect(onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({
        processing: expect.objectContaining({
          profile: 'obsidian',
          contentStrategy: 'auto',
          outputFormat: 'obsidian',
          readabilityPreset: 'standard',
          turndownPreset: 'obsidian',
        }),
      }),
    );
  });

  it('updates capture policy when deep capture is toggled', () => {
    const onSettingsChange = vi.fn();
    render(<ProcessingProfiles settings={makeSettings()} onSettingsChange={onSettingsChange} />);

    fireEvent.click(screen.getByRole('button', { name: /advanced capture/i }));

    const checkbox = screen.getAllByRole('checkbox', {
      name: /enable deep capture \(full-page only\)/i,
    })[0] as HTMLInputElement;
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
