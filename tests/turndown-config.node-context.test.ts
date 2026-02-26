// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { TurndownConfigManager } from '../core/turndown-config';

describe('TurndownConfigManager non-DOM runtime', () => {
  it('fails closed with a deterministic error when DOM globals are unavailable', async () => {
    await expect(TurndownConfigManager.createService('standard')).rejects.toThrow(
      /DOM context unavailable/
    );
  });
});
