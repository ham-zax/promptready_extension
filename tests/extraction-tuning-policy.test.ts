import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EXTRACTION_TUNING,
  assertExtractionTuning,
  deriveMinCandidateLengthThreshold,
  deriveSelectionWeights,
  normalizeExtractionTuning,
} from '../core/domain/extraction/policies';

describe('extraction tuning policy', () => {
  it('normalizes missing tuning to defaults', () => {
    expect(normalizeExtractionTuning(undefined)).toEqual(DEFAULT_EXTRACTION_TUNING);
  });

  it('normalizes out-of-range slider values to defaults', () => {
    expect(normalizeExtractionTuning({ mode: 'balanced', slider: 999 })).toEqual(DEFAULT_EXTRACTION_TUNING);
    expect(normalizeExtractionTuning({ mode: 'balanced', slider: -12 })).toEqual(DEFAULT_EXTRACTION_TUNING);
  });

  it('asserts on invalid tuning when fail-closed validation is required', () => {
    expect(() => assertExtractionTuning({ mode: 'balanced', slider: 200 })).toThrow(
      'Invalid extraction tuning'
    );
    expect(() => assertExtractionTuning({ mode: 'unknown', slider: 55 })).toThrow(
      'Invalid extraction tuning'
    );
  });

  it('derives score weights by mode', () => {
    const balanced = deriveSelectionWeights({ mode: 'balanced', slider: 55 });
    const retention = deriveSelectionWeights({ mode: 'max_retention', slider: 85 });
    const cleanliness = deriveSelectionWeights({ mode: 'max_cleanliness', slider: 15 });

    expect(retention.textCoverageWeight).toBeGreaterThan(balanced.textCoverageWeight);
    expect(retention.boilerplatePenaltyWeight).toBeLessThan(balanced.boilerplatePenaltyWeight);

    expect(cleanliness.textCoverageWeight).toBeLessThan(balanced.textCoverageWeight);
    expect(cleanliness.boilerplatePenaltyWeight).toBeGreaterThan(balanced.boilerplatePenaltyWeight);
  });

  it('derives candidate length threshold with retention/cleanliness bias', () => {
    const sourceLen = 3000;
    const balanced = deriveMinCandidateLengthThreshold(sourceLen, { mode: 'balanced', slider: 55 });
    const retention = deriveMinCandidateLengthThreshold(sourceLen, { mode: 'max_retention', slider: 85 });
    const cleanliness = deriveMinCandidateLengthThreshold(sourceLen, { mode: 'max_cleanliness', slider: 15 });

    expect(retention).toBeLessThanOrEqual(balanced);
    expect(cleanliness).toBeGreaterThanOrEqual(balanced);
  });
});

