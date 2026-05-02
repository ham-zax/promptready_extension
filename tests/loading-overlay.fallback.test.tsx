import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LoadingOverlay } from '@/entrypoints/popup/components/LoadingOverlay';

describe('LoadingOverlay AI fallback UX', () => {
  beforeEach(() => {
    cleanup();
  });

  it('shows continuing offline fallback as degraded rather than failed', () => {
    render(
      <LoadingOverlay
        status="processing"
        mode="ai"
        stage="fallback"
        failedStage="ai-processing"
        failedMessage="OpenRouter request failed: 401 Unauthorized"
        message="AI unavailable; continuing with offline capture..."
        progress={90}
      />
    );

    const failedStage = screen.getByText('Sending request to OpenRouter').closest('li');
    expect(screen.getByText('Continuing with offline capture')).toBeInTheDocument();
    expect(screen.queryByText(/Fallback to offline pipeline/i)).not.toBeInTheDocument();
    expect(screen.getByText(/401 Unauthorized/i)).toBeInTheDocument();
    expect(failedStage?.className).toContain('border-amber');
    expect(failedStage?.className).not.toContain('border-rose');
  });

  it('includes offline baseline preparation as a first-class AI stage', () => {
    render(
      <LoadingOverlay
        status="processing"
        mode="ai"
        stage="offline-baseline"
        message="Preparing offline Markdown baseline..."
        progress={20}
      />
    );

    const baselineStage = screen.getByText('Preparing reliable Markdown baseline').closest('li');
    expect(baselineStage?.className).toContain('border-brand-primary');
    expect(screen.getByText('Sending request to OpenRouter')).toBeInTheDocument();
    expect(screen.queryByText('Continuing with offline capture')).not.toBeInTheDocument();
    expect(screen.queryByText(/server response/i)).not.toBeInTheDocument();
  });

  it('uses pipeline status ids as the active stage when no stage prop is provided', () => {
    render(
      <LoadingOverlay
        status="offline-baseline"
        mode="ai"
        message="Preparing reliable Markdown baseline..."
        progress={35}
      />,
    );

    const baselineStage = screen.getByText('Preparing reliable Markdown baseline').closest('li');
    expect(baselineStage?.className).toContain('border-brand-primary');
    expect(screen.getByText(/local Markdown baseline/i)).toBeInTheDocument();
  });

  it('uses local pipeline copy in offline mode', () => {
    render(
      <LoadingOverlay
        status="processing"
        mode="offline"
        stage="preprocessing"
        message="Cleaning and preparing content..."
        progress={40}
      />
    );

    expect(screen.getByText(/offline pipeline is processing locally/i)).toBeInTheDocument();
    expect(screen.queryByText(/server response/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/openrouter/i)).not.toBeInTheDocument();
  });

  it('uses the provided message for unknown stages without activating queued stage', () => {
    render(
      <LoadingOverlay
        status="processing"
        mode="ai"
        stage="new-stage"
        message="Normalizing captured Markdown..."
        progress={50}
      />
    );

    const queuedStage = screen.getByText('Capture request queued').closest('li');
    expect(screen.getByText('Normalizing captured Markdown...')).toBeInTheDocument();
    expect(queuedStage?.className).not.toContain('border-brand-primary');
  });

  it('keeps no-output failures red', () => {
    render(
      <LoadingOverlay
        status="error"
        mode="ai"
        stage="ai-processing"
        failedStage="ai-processing"
        failedMessage="OpenRouter request failed: 401 Unauthorized"
        message="No usable output was generated."
      />
    );

    const failedStage = screen.getByText('Sending request to OpenRouter').closest('li');
    expect(failedStage?.className).toContain('border-rose');
  });
});
