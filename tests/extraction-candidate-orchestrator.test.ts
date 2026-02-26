import { describe, expect, it } from 'vitest';
import {
  rankExtractionCandidates,
  type ExtractionCandidate,
} from '../core/extraction-candidate-orchestrator';
import type { CandidateAnalysis } from '../core/candidate-selection-policy';

const baseAnalysis: CandidateAnalysis = {
  textLength: 500,
  headingCoverage: 0.7,
  sectionCount: 3,
  hasNoiseSignals: false,
  leadHeadingPresent: true,
  anchorCount: 8,
  repeatedItemBlocks: 1,
  formLikeBlocks: 0,
  containsVectorNoise: false,
};

describe('extraction-candidate-orchestrator', () => {
  it('returns candidates ranked by score with selected winner', () => {
    const candidates: ExtractionCandidate[] = [
      { source: 'a', html: '<article><h1>A</h1><p>alpha</p></article>' },
      { source: 'b', html: '<article><h1>B</h1><p>beta content with more detail</p></article>' },
    ];

    const result = rankExtractionCandidates({
      sourceHtml: '<main>source</main>',
      candidates,
      minLengthThreshold: 1,
      measureTextLength: (html) => html.length,
      analyze: () => baseAnalysis,
      score: (_source, html) => (html.includes('beta') ? 88 : 55),
    });

    expect(result.ranked.length).toBe(2);
    expect(result.selected?.source).toBe('b');
    expect(result.ranked[0]?.score).toBeGreaterThan(result.ranked[1]?.score ?? 0);
  });

  it('filters out candidates below min length', () => {
    const result = rankExtractionCandidates({
      sourceHtml: '<main>source</main>',
      candidates: [
        { source: 'tiny', html: '<p>x</p>' },
        { source: 'large', html: '<article><p>enough text content here</p></article>' },
      ],
      minLengthThreshold: 20,
      measureTextLength: (html) => html.replace(/<[^>]*>/g, '').length,
      analyze: () => baseAnalysis,
      score: () => 42,
    });

    expect(result.ranked.length).toBe(1);
    expect(result.selected?.source).toBe('large');
  });

  it('returns null selected when no candidate survives filtering', () => {
    const result = rankExtractionCandidates({
      sourceHtml: '<main>source</main>',
      candidates: [{ source: 'tiny', html: '<p>x</p>' }],
      minLengthThreshold: 999,
      measureTextLength: (html) => html.length,
      analyze: () => baseAnalysis,
      score: () => 11,
    });

    expect(result.ranked).toEqual([]);
    expect(result.selected).toBeNull();
  });
});
