import { describe, expect, it } from 'vitest';
import type { CandidateAnalysis } from '../core/candidate-selection-policy';
import { selectBestExtractionCandidate } from '../core/application/extraction/extraction-use-case';

const baseAnalysis: CandidateAnalysis = {
  textLength: 1000,
  headingCoverage: 0.6,
  sectionCount: 3,
  hasNoiseSignals: false,
  leadHeadingPresent: true,
  anchorCount: 8,
  repeatedItemBlocks: 1,
  formLikeBlocks: 0,
  containsVectorNoise: false,
};

describe('extraction use case', () => {
  it('provides deterministic state transitions and winner selection', () => {
    const result = selectBestExtractionCandidate({
      sourceHtml: '<main>source content</main>',
      tuning: { mode: 'balanced', slider: 55 },
      candidates: [
        { source: 'candidate-a', html: '<article><h1>A</h1><p>alpha</p></article>', processingTimeMs: 8 },
        { source: 'candidate-b', html: '<article><h1>B</h1><p>beta</p></article>', processingTimeMs: 6 },
      ],
      measureTextLength: (html) => html.length,
      analyze: () => baseAnalysis,
      score: (_source, html) => (html.includes('beta') ? 80 : 70),
      minLengthThreshold: 1,
    });

    expect(result.stateTrace).toEqual([
      'RECEIVED',
      'NORMALIZED',
      'CANDIDATES_BUILT',
      'CANDIDATES_SCORED',
      'CANDIDATE_SELECTED',
      'COMPLETED',
    ]);
    expect(result.selected?.source).toBe('candidate-b');
    expect(result.ranked.length).toBe(2);
  });

  it('breaks score ties by retention, then boilerplate, then processing time, then source name', () => {
    const result = selectBestExtractionCandidate({
      sourceHtml: '<main>source content</main>',
      tuning: { mode: 'balanced', slider: 55 },
      candidates: [
        { source: 'z-source', html: '<article><h1>Z</h1><p>zeta</p></article>', processingTimeMs: 20 },
        { source: 'a-source', html: '<article><h1>A</h1><p>alpha</p></article>', processingTimeMs: 10 },
      ],
      measureTextLength: () => 500,
      analyze: (_source, html) => ({
        ...baseAnalysis,
        headingCoverage: html.includes('alpha') ? 0.7 : 0.7,
        sectionCount: html.includes('alpha') ? 4 : 4,
      }),
      score: () => 75,
      retentionScore: (_source, html) => (html.includes('alpha') ? 0.9 : 0.7),
      boilerplatePenalty: (_source, html) => (html.includes('alpha') ? 4 : 8),
      minLengthThreshold: 1,
    });

    expect(result.selected?.source).toBe('a-source');
  });

  it('fails closed with empty candidate set after filtering', () => {
    const result = selectBestExtractionCandidate({
      sourceHtml: '<main>source content</main>',
      tuning: { mode: 'balanced', slider: 55 },
      candidates: [{ source: 'tiny', html: '<p>x</p>', processingTimeMs: 1 }],
      measureTextLength: () => 2,
      analyze: () => baseAnalysis,
      score: () => 20,
      minLengthThreshold: 10,
    });

    expect(result.selected).toBeNull();
    expect(result.stateTrace.at(-1)).toBe('FAILED');
    expect(result.errorCode).toBe('NO_VIABLE_CANDIDATES');
  });
});

