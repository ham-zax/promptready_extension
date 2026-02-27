import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingOverlay } from '@/entrypoints/popup/components/LoadingOverlay';

describe('LoadingOverlay AI fallback UX', () => {
  it('shows the failed step and error message when failedStage is provided', () => {
    render(
      <LoadingOverlay
        status="processing"
        mode="ai"
        stage="fallback"
        failedStage="ai-processing"
        failedMessage="OpenRouter request failed: 401 Unauthorized"
        message="AI failed — switching to offline processing…"
        progress={90}
      />
    );

    expect(screen.getByText('Sending request to OpenRouter')).toBeInTheDocument();
    expect(screen.getByText(/401 Unauthorized/i)).toBeInTheDocument();
  });
});
