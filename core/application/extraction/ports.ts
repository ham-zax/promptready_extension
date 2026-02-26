import type { CandidateAnalysis } from '../../candidate-selection-policy.js';
import type { ExtractionPipelineState, ExtractionTuning } from '../../domain/extraction/types.js';

export interface ExtractionCandidateInput {
  source: string;
  html: string;
  processingTimeMs?: number;
}

export interface RankedExtractionCandidate extends ExtractionCandidateInput {
  textLength: number;
  score: number;
  analysis: CandidateAnalysis;
  retentionScore: number;
  boilerplatePenalty: number;
  processingTimeMs: number;
}

export interface SelectBestCandidateInput {
  sourceHtml: string;
  candidates: ExtractionCandidateInput[];
  tuning?: ExtractionTuning;
  minLengthThreshold: number;
  measureTextLength: (html: string) => number;
  analyze: (sourceHtml: string, candidateHtml: string) => CandidateAnalysis;
  score: (sourceHtml: string, candidateHtml: string, analysis?: CandidateAnalysis) => number;
  retentionScore?: (sourceHtml: string, candidateHtml: string, analysis?: CandidateAnalysis) => number;
  boilerplatePenalty?: (sourceHtml: string, candidateHtml: string, analysis?: CandidateAnalysis) => number;
}

export interface SelectBestCandidateResult {
  stateTrace: ExtractionPipelineState[];
  ranked: RankedExtractionCandidate[];
  selected: RankedExtractionCandidate | null;
  errorCode?: 'NO_VIABLE_CANDIDATES' | 'PIPELINE_ERROR';
}

