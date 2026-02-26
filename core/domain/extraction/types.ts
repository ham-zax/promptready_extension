export type ExtractionMode = 'balanced' | 'max_retention' | 'max_cleanliness';

export interface ExtractionTuning {
  mode: ExtractionMode;
  slider: number; // 0..100
}

export const DEFAULT_EXTRACTION_TUNING: ExtractionTuning = {
  mode: 'balanced',
  slider: 55,
};

export type ExtractionPipelineState =
  | 'RECEIVED'
  | 'NORMALIZED'
  | 'CANDIDATES_BUILT'
  | 'CANDIDATES_SCORED'
  | 'CANDIDATE_SELECTED'
  | 'COMPLETED'
  | 'FAILED';

