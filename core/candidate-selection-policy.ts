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
  } = input;

  const safeSourceLength = Math.max(1, sourceTextLength);
  const textCoverage = Math.min(1, analysis.textLength / safeSourceLength);
  const sectionScore = Math.min(1, analysis.sectionCount / 6);

  let score = 0;
  score += analysis.headingCoverage * 34;
  score += textCoverage * 24;
  score += sectionScore * 14;
  score += analysis.leadHeadingPresent ? 16 : 0;
  score += isFeedLike ? 10 : 0;
  score -= analysis.hasNoiseSignals ? 14 : 0;
  score -= isFormSidebarLike ? 22 : 0;
  score -= analysis.containsVectorNoise ? 18 : 0;

  const densityThreshold = isFeedLike ? 0.78 : 0.45;
  if (linkDensity > densityThreshold) {
    score -= Math.min(18, (linkDensity - densityThreshold) * 60);
  }
  score -= boilerplatePenalty;

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
