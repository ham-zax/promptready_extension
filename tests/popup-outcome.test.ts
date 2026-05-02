import { describe, expect, it } from 'vitest';
import {
  derivePopupOutcome,
  type PopupOutcomeInput,
  type PopupOutcomeViewModel,
} from '@/entrypoints/popup/lib/popup-outcome';

function requireOutcome(input: PopupOutcomeInput): PopupOutcomeViewModel {
  const outcome = derivePopupOutcome(input);
  expect(outcome).not.toBeNull();
  return outcome!;
}

describe('derivePopupOutcome', () => {
  it('treats AI fallback with usable output as degraded success', () => {
    const outcome = requireOutcome({
      mode: 'ai',
      hasContent: true,
      aiOutcome: 'fallback_request_failed',
      aiFallbackError: 'Provider returned error: rate limited upstream',
    });

    expect(outcome.kind).toBe('ready_offline_degraded');
    expect(outcome.tone).toBe('degraded');
    expect(outcome.title).toBe('Offline output ready');
    expect(outcome.message).toBe('AI enhancement was skipped or failed.');
    expect(outcome.details).toContain('rate limited upstream');
    expect(outcome.primaryActions).toContain('copy_md');
  });

  it('keeps missing-key fallback outcome-first when offline output exists', () => {
    const outcome = requireOutcome({
      mode: 'ai',
      hasContent: true,
      aiOutcome: 'fallback_missing_key',
    });

    expect(outcome.kind).toBe('ready_offline_degraded');
    expect(outcome.title).toBe('Offline output ready');
    expect(outcome.message).toBe('Add an API key to use AI. Offline capture still works.');
    expect(outcome.secondaryActions).toContain('open_settings');
  });

  it('uses fidelity-check copy for quality-gate fallback with offline output', () => {
    const outcome = requireOutcome({
      mode: 'ai',
      hasContent: true,
      aiOutcome: 'fallback_quality_gate_failed',
      aiFallbackError: 'AI quality gate failed: heading_order_loss',
    });

    expect(outcome.kind).toBe('ready_offline_degraded');
    expect(outcome.title).toBe('Offline output ready');
    expect(outcome.message).toBe('AI output failed fidelity checks. Offline capture still works.');
    expect(outcome.secondaryActions).toEqual(['view_details']);
    expect(outcome.details).toContain('heading_order_loss');
  });

  it('uses config-needed only when AI is unavailable before output exists', () => {
    const outcome = requireOutcome({
      mode: 'ai',
      hasContent: false,
      canUseAIMode: false,
      aiLockReason: 'missing_api_key',
    });

    expect(outcome.kind).toBe('needs_ai_config');
    expect(outcome.tone).toBe('info');
    expect(outcome.title).toBe('Add an API key to use AI');
    expect(outcome.message).toBe('Offline capture still works.');
  });

  it('uses red failure only when no usable output was generated', () => {
    const outcome = requireOutcome({
      mode: 'ai',
      hasContent: false,
      processingStatus: 'error',
      processingMessage: 'Capture failed',
    });

    expect(outcome.kind).toBe('failed');
    expect(outcome.tone).toBe('error');
    expect(outcome.title).toBe('Capture failed');
    expect(outcome.message).toBe('No usable output was generated.');
  });
});
