import { describe, expect, it } from 'vitest';
import {
  computeCandidateSelectionScore,
  shouldAdoptFallbackCandidate,
  type CandidateAnalysis,
} from '../core/candidate-selection-policy';

function createAnalysis(overrides: Partial<CandidateAnalysis> = {}): CandidateAnalysis {
  return {
    textLength: 1200,
    headingCoverage: 0.75,
    sectionCount: 4,
    hasNoiseSignals: false,
    leadHeadingPresent: true,
    anchorCount: 12,
    repeatedItemBlocks: 1,
    formLikeBlocks: 0,
    containsVectorNoise: false,
    ...overrides,
  };
}

describe('candidate-selection-policy', () => {
  it('scores clean content above noisy content', () => {
    const clean = computeCandidateSelectionScore({
      analysis: createAnalysis(),
      sourceTextLength: 1800,
      linkDensity: 0.18,
      boilerplatePenalty: 2,
      isFeedLike: false,
      isFormSidebarLike: false,
    });

    const noisy = computeCandidateSelectionScore({
      analysis: createAnalysis({
        hasNoiseSignals: true,
        containsVectorNoise: true,
        leadHeadingPresent: false,
      }),
      sourceTextLength: 1800,
      linkDensity: 0.86,
      boilerplatePenalty: 18,
      isFeedLike: false,
      isFormSidebarLike: true,
    });

    expect(clean).toBeGreaterThan(noisy);
    expect(clean).toBeGreaterThanOrEqual(45);
    expect(noisy).toBeLessThanOrEqual(35);
  });

  it('adopts fallback when readability is undersized and fallback is strong', () => {
    const shouldAdopt = shouldAdoptFallbackCandidate({
      readabilityAnalysis: createAnalysis({ textLength: 180, headingCoverage: 0.2, sectionCount: 1 }),
      fallbackAnalysis: createAnalysis({ textLength: 1500, headingCoverage: 0.8, sectionCount: 5 }),
      readabilityScore: 22,
      fallbackScore: 68,
    });

    expect(shouldAdopt).toBe(true);
  });

  it('rejects fallback when fallback is too short compared with readability', () => {
    const shouldAdopt = shouldAdoptFallbackCandidate({
      readabilityAnalysis: createAnalysis({ textLength: 1600, headingCoverage: 0.8, sectionCount: 5 }),
      fallbackAnalysis: createAnalysis({ textLength: 300, headingCoverage: 0.4, sectionCount: 1 }),
      readabilityScore: 64,
      fallbackScore: 69,
    });

    expect(shouldAdopt).toBe(false);
  });
});
