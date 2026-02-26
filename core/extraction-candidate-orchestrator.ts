import type { CandidateAnalysis } from './candidate-selection-policy.js';

export interface ExtractionCandidate {
  source: string;
  html: string;
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
  measureTextLength: (html: string) => number;
  analyze: (sourceHtml: string, candidateHtml: string) => CandidateAnalysis;
  score: (sourceHtml: string, candidateHtml: string, analysis?: CandidateAnalysis) => number;
}

export interface CandidateRankingResult {
  ranked: RankedExtractionCandidate[];
  selected: RankedExtractionCandidate | null;
}

export function rankExtractionCandidates(input: CandidateRankingInput): CandidateRankingResult {
  const {
    sourceHtml,
    candidates,
    minLengthThreshold,
    measureTextLength,
    analyze,
    score,
  } = input;

  const ranked = candidates
    .map((candidate) => {
      const html = typeof candidate.html === 'string' ? candidate.html : '';
      const textLength = measureTextLength(html);
      return {
        source: candidate.source,
        html,
        textLength,
      };
    })
    .filter((candidate) => candidate.textLength > 0)
    .filter((candidate) => candidate.textLength >= minLengthThreshold)
    .map((candidate) => {
      const analysis = analyze(sourceHtml, candidate.html);
      const candidateScore = score(sourceHtml, candidate.html, analysis);
      return {
        ...candidate,
        score: candidateScore,
        analysis,
      };
    })
    .sort((a, b) => b.score - a.score);

  return {
    ranked,
    selected: ranked[0] ?? null,
  };
}
