import { DEFAULT_EXTRACTION_TUNING, type ExtractionMode, type ExtractionTuning } from './types.js';

export interface SelectionWeights {
  headingCoverageWeight: number;
  textCoverageWeight: number;
  sectionWeight: number;
  leadHeadingBonus: number;
  feedBonus: number;
  noisePenaltyWeight: number;
  formSidebarPenaltyWeight: number;
  vectorNoisePenaltyWeight: number;
  linkDensityPenaltyWeight: number;
  boilerplatePenaltyWeight: number;
}

const MODE_BASE_WEIGHTS: Record<ExtractionMode, SelectionWeights> = {
  balanced: {
    headingCoverageWeight: 34,
    textCoverageWeight: 24,
    sectionWeight: 14,
    leadHeadingBonus: 16,
    feedBonus: 10,
    noisePenaltyWeight: 14,
    formSidebarPenaltyWeight: 22,
    vectorNoisePenaltyWeight: 18,
    linkDensityPenaltyWeight: 1,
    boilerplatePenaltyWeight: 1,
  },
  max_retention: {
    headingCoverageWeight: 34,
    textCoverageWeight: 30,
    sectionWeight: 18,
    leadHeadingBonus: 16,
    feedBonus: 10,
    noisePenaltyWeight: 11,
    formSidebarPenaltyWeight: 18,
    vectorNoisePenaltyWeight: 14,
    linkDensityPenaltyWeight: 0.85,
    boilerplatePenaltyWeight: 0.85,
  },
  max_cleanliness: {
    headingCoverageWeight: 30,
    textCoverageWeight: 18,
    sectionWeight: 10,
    leadHeadingBonus: 14,
    feedBonus: 8,
    noisePenaltyWeight: 18,
    formSidebarPenaltyWeight: 28,
    vectorNoisePenaltyWeight: 24,
    linkDensityPenaltyWeight: 1.2,
    boilerplatePenaltyWeight: 1.3,
  },
};

function isValidMode(mode: unknown): mode is ExtractionMode {
  return mode === 'balanced' || mode === 'max_retention' || mode === 'max_cleanliness';
}

function isFiniteInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

export function normalizeExtractionTuning(input: unknown): ExtractionTuning {
  if (!input || typeof input !== 'object') {
    return { ...DEFAULT_EXTRACTION_TUNING };
  }

  const raw = input as Partial<ExtractionTuning>;
  if (!isValidMode(raw.mode) || !isFiniteInRange(raw.slider, 0, 100)) {
    return { ...DEFAULT_EXTRACTION_TUNING };
  }

  return {
    mode: raw.mode,
    slider: Math.round(raw.slider),
  };
}

export function assertExtractionTuning(input: unknown): ExtractionTuning {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid extraction tuning: expected object');
  }

  const raw = input as Partial<ExtractionTuning>;
  if (!isValidMode(raw.mode) || !isFiniteInRange(raw.slider, 0, 100)) {
    throw new Error('Invalid extraction tuning: mode must be balanced|max_retention|max_cleanliness and slider must be 0..100');
  }

  return {
    mode: raw.mode,
    slider: Math.round(raw.slider),
  };
}

export function deriveSelectionWeights(tuning: ExtractionTuning): SelectionWeights {
  const normalized = normalizeExtractionTuning(tuning);
  const base = MODE_BASE_WEIGHTS[normalized.mode];
  const sliderDelta = (normalized.slider - 55) / 45; // ~[-1.22, 1]

  // Slider leans toward retention as it increases and cleanliness as it decreases.
  return {
    ...base,
    textCoverageWeight: Math.max(8, base.textCoverageWeight + sliderDelta * 3),
    sectionWeight: Math.max(4, base.sectionWeight + sliderDelta * 2),
    noisePenaltyWeight: Math.max(4, base.noisePenaltyWeight - sliderDelta * 2),
    formSidebarPenaltyWeight: Math.max(6, base.formSidebarPenaltyWeight - sliderDelta * 2),
    vectorNoisePenaltyWeight: Math.max(6, base.vectorNoisePenaltyWeight - sliderDelta * 2),
    linkDensityPenaltyWeight: Math.max(0.4, base.linkDensityPenaltyWeight - sliderDelta * 0.15),
    boilerplatePenaltyWeight: Math.max(0.4, base.boilerplatePenaltyWeight - sliderDelta * 0.2),
  };
}

export function deriveMinCandidateLengthThreshold(
  sourceTextLength: number,
  tuning: ExtractionTuning
): number {
  const normalized = normalizeExtractionTuning(tuning);
  const base = Math.min(220, Math.max(80, Math.floor(Math.max(1, sourceTextLength) * 0.08)));
  const modeMultiplier =
    normalized.mode === 'max_retention'
      ? 0.85
      : normalized.mode === 'max_cleanliness'
        ? 1.15
        : 1;

  const sliderDelta = (normalized.slider - 55) / 45;
  const sliderMultiplier = 1 - sliderDelta * 0.08;
  const value = base * modeMultiplier * sliderMultiplier;

  return Math.max(60, Math.min(320, Math.round(value)));
}

export { DEFAULT_EXTRACTION_TUNING };

