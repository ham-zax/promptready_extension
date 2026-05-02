import React from 'react';
import { render, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const browserMock = vi.hoisted(() => ({
  runtime: {
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    sendMessage: vi.fn().mockResolvedValue(undefined),
  },
  storage: {
    session: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

vi.mock('wxt/browser', () => ({
  browser: browserMock,
}));

import { ModelSelect } from '@/entrypoints/popup/components/ModelSelect';

describe('ModelSelect', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('requests all OpenRouter models by default', async () => {
    render(
      <ModelSelect
        value="openrouter/free"
        onChange={vi.fn()}
        apiBase="https://openrouter.ai/api/v1"
      />,
    );

    await waitFor(() => {
      expect(browserMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'FETCH_MODELS',
        payload: {
          provider: 'openrouter',
          apiBase: 'https://openrouter.ai/api/v1',
          freeOnly: false,
        },
      });
    });
  });
});
