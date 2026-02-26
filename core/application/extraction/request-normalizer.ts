import {
  DEFAULT_EXTRACTION_TUNING,
  normalizeExtractionTuning,
} from '../../domain/extraction/policies.js';
import type { ExtractionTuning } from '../../domain/extraction/types.js';
import type { SelectBestCandidateInput } from './ports.js';

export interface NormalizedSelectionRequest extends Omit<SelectBestCandidateInput, 'tuning' | 'minLengthThreshold'> {
  tuning: ExtractionTuning;
  minLengthThreshold: number;
}

export function normalizeSelectionRequest(input: SelectBestCandidateInput): NormalizedSelectionRequest {
  return {
    ...input,
    tuning: input.tuning ? normalizeExtractionTuning(input.tuning) : { ...DEFAULT_EXTRACTION_TUNING },
    minLengthThreshold: Math.max(1, Math.floor(input.minLengthThreshold)),
  };
}

