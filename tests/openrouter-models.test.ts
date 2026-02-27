import { describe, expect, it } from 'vitest';

import {
  fallbackOpenRouterFreeModelOptions,
  isOpenRouterFreeModel,
  selectOpenRouterModelOptions,
} from '@/lib/openrouter-models';

describe('openrouter model normalization', () => {
  it('detects free models by :free suffix and zero pricing tiers', () => {
    expect(isOpenRouterFreeModel('meta-llama/llama-3.2-3b-instruct:free')).toBe(true);
    expect(isOpenRouterFreeModel('openrouter/free')).toBe(true);
    expect(
      isOpenRouterFreeModel('vendor/model-x', {
        prompt: '0',
        completion: '0',
        request: '0',
      }),
    ).toBe(true);
    expect(
      isOpenRouterFreeModel('vendor/model-y', {
        prompt: '0.000001',
        completion: '0.000001',
      }),
    ).toBe(false);
  });

  it('returns deterministic free-only model options and includes free router option', () => {
    const payload = {
      data: [
        { id: 'paid/a', name: 'Paid A', pricing: { prompt: '0.000002', completion: '0.000004' } },
        { id: 'free/a:free', name: 'Free A', pricing: { prompt: '0', completion: '0' } },
        { id: 'free/b', name: 'Free B', pricing: { prompt: '0', completion: '0' } },
      ],
    };

    const result = selectOpenRouterModelOptions(payload, { freeOnly: true });

    expect(result.every((model) => model.isFree)).toBe(true);
    expect(result.some((model) => model.id === 'openrouter/free')).toBe(true);
    expect(result.some((model) => model.id === 'free/a:free')).toBe(true);
    expect(result.some((model) => model.id === 'paid/a')).toBe(false);
  });

  it('returns all models with free models sorted first and no duplicates', () => {
    const payload = {
      data: [
        { id: 'paid/z', name: 'Paid Z', pricing: { prompt: '0.2', completion: '0.4' } },
        { id: 'free/y:free', name: 'Free Y', pricing: { prompt: '0', completion: '0' } },
        { id: 'free/y:free', name: 'Free Y Duplicate', pricing: { prompt: '0', completion: '0' } },
      ],
    };

    const result = selectOpenRouterModelOptions(payload, { freeOnly: false });

    expect(result[0]?.isFree).toBe(true);
    expect(result.filter((model) => model.id === 'free/y:free')).toHaveLength(1);
    expect(result.some((model) => model.id === 'paid/z')).toBe(true);
    expect(result.some((model) => model.id === 'openrouter/free')).toBe(true);
  });

  it('provides deterministic fallback free options', () => {
    const fallback = fallbackOpenRouterFreeModelOptions();

    expect(fallback.length).toBeGreaterThan(0);
    expect(fallback[0]?.id).toBe('openrouter/free');
    expect(fallback.every((model) => model.isFree)).toBe(true);
  });
});
