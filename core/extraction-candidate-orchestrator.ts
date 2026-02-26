import type { CandidateAnalysis } from './candidate-selection-policy.js';
import { selectBestExtractionCandidate } from './application/extraction/extraction-use-case.js';
import type { ExtractionTuning } from './domain/extraction/types.js';

export interface ExtractionCandidate {
  source: string;
  html: string;
  processingTimeMs?: number;
}

export interface RankedExtractionCandidate extends ExtractionCandidate {
  textLength: number;
  score: number;
  analysis: CandidateAnalysis;
}

export interface CandidateRankingInput {
  sourceHtml: string;
  candidates: ExtractionCandidate[];
  minLengthThreshold: number;
  tuning?: ExtractionTuning;
  measureTextLength: (html: string) => number;
  analyze: (sourceHtml: string, candidateHtml: string) => CandidateAnalysis;
  score: (sourceHtml: string, candidateHtml: string, analysis?: CandidateAnalysis) => number;
  retentionScore?: (sourceHtml: string, candidateHtml: string, analysis?: CandidateAnalysis) => number;
  boilerplatePenalty?: (sourceHtml: string, candidateHtml: string, analysis?: CandidateAnalysis) => number;
}

export interface CandidateRankingResult {
  ranked: RankedExtractionCandidate[];
  selected: RankedExtractionCandidate | null;
  stateTrace?: string[];
  errorCode?: 'NO_VIABLE_CANDIDATES' | 'PIPELINE_ERROR';
}

export function rankExtractionCandidates(input: CandidateRankingInput): CandidateRankingResult {
  const decision = selectBestExtractionCandidate({
    sourceHtml: input.sourceHtml,
    candidates: input.candidates,
    tuning: input.tuning,
    minLengthThreshold: input.minLengthThreshold,
    measureTextLength: input.measureTextLength,
    analyze: input.analyze,
    score: input.score,
    retentionScore: input.retentionScore,
    boilerplatePenalty: input.boilerplatePenalty,
  });

  const ranked: RankedExtractionCandidate[] = decision.ranked.map((entry) => ({
    source: entry.source,
    html: entry.html,
    textLength: entry.textLength,
    score: entry.score,
    analysis: entry.analysis,
    processingTimeMs: entry.processingTimeMs,
  }));

  return {
    ranked,
    selected: decision.selected
      ? ({
          source: decision.selected.source,
          html: decision.selected.html,
          textLength: decision.selected.textLength,
          score: decision.selected.score,
          analysis: decision.selected.analysis,
          processingTimeMs: decision.selected.processingTimeMs,
        } as RankedExtractionCandidate)
      : null,
    stateTrace: decision.stateTrace,
    errorCode: decision.errorCode,
  };
}
