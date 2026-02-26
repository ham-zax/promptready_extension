import {
  DEFAULT_EXTRACTION_TUNING,
  deriveSelectionWeights,
  normalizeExtractionTuning,
} from './domain/extraction/policies.js';
import type { ExtractionTuning } from './domain/extraction/types.js';

export interface CandidateAnalysis {
  textLength: number;
  headingCoverage: number;
  sectionCount: number;
  hasNoiseSignals: boolean;
  leadHeadingPresent: boolean;
  anchorCount: number;
  repeatedItemBlocks: number;
  formLikeBlocks: number;
  containsVectorNoise: boolean;
}

export interface CandidateScoreInput {
  analysis: CandidateAnalysis;
  sourceTextLength: number;
  linkDensity: number;
  boilerplatePenalty: number;
  isFeedLike: boolean;
  isFormSidebarLike: boolean;
  tuning?: ExtractionTuning;
}

export interface FallbackAdoptionInput {
  readabilityAnalysis: CandidateAnalysis;
  fallbackAnalysis: CandidateAnalysis;
  readabilityScore: number;
  fallbackScore: number;
}

export function computeCandidateSelectionScore(input: CandidateScoreInput): number {
  const {
    analysis,
    sourceTextLength,
    linkDensity,
    boilerplatePenalty,
    isFeedLike,
    isFormSidebarLike,
    tuning,
  } = input;

  const safeSourceLength = Math.max(1, sourceTextLength);
  const textCoverage = Math.min(1, analysis.textLength / safeSourceLength);
  const sectionScore = Math.min(1, analysis.sectionCount / 6);
  const resolvedTuning = tuning
    ? normalizeExtractionTuning(tuning)
    : { ...DEFAULT_EXTRACTION_TUNING };
  const weights = deriveSelectionWeights(resolvedTuning);

  let score = 0;
  score += analysis.headingCoverage * weights.headingCoverageWeight;
  score += textCoverage * weights.textCoverageWeight;
  score += sectionScore * weights.sectionWeight;
  score += analysis.leadHeadingPresent ? weights.leadHeadingBonus : 0;
  score += isFeedLike ? weights.feedBonus : 0;
  score -= analysis.hasNoiseSignals ? weights.noisePenaltyWeight : 0;
  score -= isFormSidebarLike ? weights.formSidebarPenaltyWeight : 0;
  score -= analysis.containsVectorNoise ? weights.vectorNoisePenaltyWeight : 0;

  const densityThreshold = isFeedLike ? 0.78 : 0.45;
  if (linkDensity > densityThreshold) {
    score -= Math.min(18, (linkDensity - densityThreshold) * 60) * weights.linkDensityPenaltyWeight;
  }
  score -= boilerplatePenalty * weights.boilerplatePenaltyWeight;

  return Math.max(0, Math.min(100, score));
}

export function shouldAdoptFallbackCandidate(input: FallbackAdoptionInput): boolean {
  const {
    readabilityAnalysis,
    fallbackAnalysis,
    readabilityScore,
    fallbackScore,
  } = input;

  if (fallbackAnalysis.textLength < Math.min(200, readabilityAnalysis.textLength * 0.55)) {
    return false;
  }

  if (readabilityAnalysis.textLength < 220 && fallbackAnalysis.textLength >= 1200) {
    return true;
  }

  if (fallbackAnalysis.hasNoiseSignals && !readabilityAnalysis.hasNoiseSignals) {
    return fallbackScore >= readabilityScore + 14;
  }

  if (fallbackScore >= readabilityScore + 10) {
    return true;
  }

  if (readabilityAnalysis.hasNoiseSignals && !fallbackAnalysis.hasNoiseSignals) {
    if (fallbackAnalysis.textLength >= readabilityAnalysis.textLength * 0.6) {
      return true;
    }
  }

  if (!readabilityAnalysis.leadHeadingPresent && fallbackAnalysis.leadHeadingPresent) {
    if (fallbackAnalysis.textLength >= readabilityAnalysis.textLength * 0.6) {
      return true;
    }
  }

  if (fallbackAnalysis.headingCoverage >= readabilityAnalysis.headingCoverage + 0.2) {
    if (fallbackAnalysis.textLength >= readabilityAnalysis.textLength * 0.7) {
      return true;
    }
  }

  if (fallbackAnalysis.sectionCount > readabilityAnalysis.sectionCount) {
    if (fallbackAnalysis.textLength >= readabilityAnalysis.textLength * 0.7) {
      return true;
    }
  }

  return fallbackScore >= readabilityScore + 6;
}
