/**
 * Tests for SimplifiedByokSetup validation-state save prevention.
 *
 * The critical invariant: if a user validates a good key, then edits the
 * input to an invalid key, clicking Save must NOT persist the invalid key.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { SimplifiedByokSetup } from '@/entrypoints/popup/components/SimplifiedByokSetup';
import { Storage } from '@/lib/storage';
import * as apiValidation from '@/lib/api-validation';

// Mock Storage.updateSettings so we can assert it is/isn't called.
vi.mock('@/lib/storage', () => ({
  Storage: {
    updateSettings: vi.fn().mockResolvedValue(undefined),
    getSettings: vi.fn().mockResolvedValue({}),
  },
}));

const baseSettings: any = {
  mode: 'ai' as const,
  byok: {
    provider: 'openrouter',
    apiKey: '',
    apiBase: 'https://openrouter.ai/api/v1',
    model: 'arcee-ai/trinity-large-preview:free',
    selectedByokModel: 'arcee-ai/trinity-large-preview:free',
  },
};

describe('SimplifiedByokSetup — stale validation save prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('does not save an invalid key if the user edits the input after a valid check', async () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);

    render(
      <SimplifiedByokSetup
        settings={baseSettings}
        onSettingsChange={onSettingsChange}
        onComplete={onComplete}
        onCancel={onCancel}
      />,
    );

    const input = screen.getByPlaceholderText('sk-or-v1-...');
    const saveBtn = screen.getByRole('button', { name: 'Save API Key' });

    // Step 1: Enter a valid key and click Check Format.
    fireEvent.change(input, { target: { value: 'sk-or-v1-good-key-value' } });

    const checkBtn = screen.getByRole('button', { name: 'Check Format' });
    fireEvent.click(checkBtn);

    // Wait for validation to complete (it's async but local-only, so fast).
    await waitFor(() => {
      expect(screen.getByText(/Key format looks valid/i)).toBeTruthy();
    });

    // Step 2: Edit the key to something invalid (pasted Bearer header).
    fireEvent.change(input, { target: { value: 'Bearer bad-key' } });

    // Validation status should be cleared immediately.
    expect(screen.queryByText(/Key format looks valid/i)).toBeNull();

    // Step 3: Click Save — it must re-validate and reject.
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText(/without spaces or the Bearer prefix/i)).toBeTruthy();
    });

    // Storage must NOT have been called with the invalid key.
    expect(Storage.updateSettings).not.toHaveBeenCalled();
    expect(onSettingsChange).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('saves the key when validation is fresh and key has not changed', async () => {
    const onComplete = vi.fn();
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);

    render(
      <SimplifiedByokSetup
        settings={baseSettings}
        onSettingsChange={onSettingsChange}
        onComplete={onComplete}
        onCancel={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText('sk-or-v1-...');
    const saveBtn = screen.getByRole('button', { name: 'Save API Key' });

    // Enter valid key and validate.
    fireEvent.change(input, { target: { value: '  sk-or-v1-my-real-key\n' } });
    const checkBtn = screen.getByRole('button', { name: 'Check Format' });
    fireEvent.click(checkBtn);

    await waitFor(() => {
      expect(screen.getByText(/Key format looks valid/i)).toBeTruthy();
    });

    // Save without editing the key again.
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onSettingsChange).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    // Verify the saved key is the validated one.
    const savedCall = onSettingsChange.mock.calls[0][0];
    expect(savedCall.byok.apiKey).toBe('sk-or-v1-my-real-key');
    expect(Storage.updateSettings).not.toHaveBeenCalled();
  });

  it('clears validation status on every keystroke', async () => {
    render(
      <SimplifiedByokSetup
        settings={baseSettings}
        onSettingsChange={vi.fn()}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText('sk-or-v1-...');

    // Validate a good key first.
    fireEvent.change(input, { target: { value: 'sk-or-v1-abc123' } });
    const checkBtn = screen.getByRole('button', { name: 'Check Format' });
    fireEvent.click(checkBtn);

    await waitFor(() => {
      expect(screen.getByText(/Key format looks valid/i)).toBeTruthy();
    });

    // Type one more character — validation status should vanish.
    fireEvent.change(input, { target: { value: 'sk-or-v1-abc1234' } });
    expect(screen.queryByText(/Key format looks valid/i)).toBeNull();
  });

  it('does not show a stale async validation result after the key changes', async () => {
    let resolveValidation!: (value: { isValid: boolean; message: string }) => void;
    vi.spyOn(apiValidation, 'validateApiKey').mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveValidation = resolve;
      }),
    );

    render(
      <SimplifiedByokSetup
        settings={baseSettings}
        onSettingsChange={vi.fn()}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText('sk-or-v1-...');
    fireEvent.change(input, { target: { value: 'sk-or-v1-slow-key' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check Format' }));

    fireEvent.change(input, { target: { value: 'Bearer bad-key' } });

    await act(async () => {
      resolveValidation({
        isValid: true,
        message: 'Key format looks valid. It will be verified on first AI request.',
      });
    });

    expect(screen.queryByText(/Key format looks valid/i)).toBeNull();
  });
});
