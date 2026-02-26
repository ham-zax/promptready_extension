import type { CandidateAnalysis } from '../../candidate-selection-policy.js';
import type { ExtractionPipelineState } from '../../domain/extraction/types.js';
import { normalizeSelectionRequest } from './request-normalizer.js';
import type {
  RankedExtractionCandidate,
  SelectBestCandidateInput,
  SelectBestCandidateResult,
} from './ports.js';

function defaultRetentionScore(_sourceHtml: string, _candidateHtml: string, analysis: CandidateAnalysis): number {
  const sectionScore = Math.min(1, analysis.sectionCount / 6);
  const headingScore = Math.max(0, Math.min(1, analysis.headingCoverage));
  const leadScore = analysis.leadHeadingPresent ? 1 : 0;
  return headingScore * 0.45 + sectionScore * 0.35 + leadScore * 0.2;
}

function defaultBoilerplatePenalty(
  _sourceHtml: string,
  _candidateHtml: string,
  analysis: CandidateAnalysis
): number {
  let penalty = 0;
  if (analysis.hasNoiseSignals) penalty += 8;
  if (analysis.formLikeBlocks >= 3) penalty += 6;
  if (analysis.containsVectorNoise) penalty += 6;
  return penalty;
}

function compareRankedCandidates(a: RankedExtractionCandidate, b: RankedExtractionCandidate): number {
  if (b.score !== a.score) return b.score - a.score;
  if (b.retentionScore !== a.retentionScore) return b.retentionScore - a.retentionScore;
  if (a.boilerplatePenalty !== b.boilerplatePenalty) return a.boilerplatePenalty - b.boilerplatePenalty;
  if (a.processingTimeMs !== b.processingTimeMs) return a.processingTimeMs - b.processingTimeMs;
  return a.source.localeCompare(b.source);
}

export function selectBestExtractionCandidate(
  input: SelectBestCandidateInput
): SelectBestCandidateResult {
  const stateTrace: ExtractionPipelineState[] = ['RECEIVED'];

  try {
    const request = normalizeSelectionRequest(input);
    stateTrace.push('NORMALIZED');

    const builtCandidates = request.candidates
      .map((candidate) => {
        const html = typeof candidate.html === 'string' ? candidate.html : '';
        const textLength = request.measureTextLength(html);
        return {
          source: candidate.source,
          html,
          textLength,
          processingTimeMs:
            typeof candidate.processingTimeMs === 'number' && Number.isFinite(candidate.processingTimeMs)
              ? Math.max(0, candidate.processingTimeMs)
              : Number.MAX_SAFE_INTEGER,
        };
      })
      .filter((candidate) => candidate.textLength > 0)
      .filter((candidate) => candidate.textLength >= request.minLengthThreshold);

    stateTrace.push('CANDIDATES_BUILT');
    if (builtCandidates.length === 0) {
      stateTrace.push('FAILED');
      return {
        stateTrace,
        ranked: [],
        selected: null,
        errorCode: 'NO_VIABLE_CANDIDATES',
      };
    }

    const ranked = builtCandidates
      .map((candidate) => {
        const analysis = request.analyze(request.sourceHtml, candidate.html);
        const score = request.score(request.sourceHtml, candidate.html, analysis);
        const retentionScore = (request.retentionScore || defaultRetentionScore)(
          request.sourceHtml,
          candidate.html,
          analysis
        );
        const boilerplatePenalty = (request.boilerplatePenalty || defaultBoilerplatePenalty)(
          request.sourceHtml,
          candidate.html,
          analysis
        );
        return {
          ...candidate,
          score,
          analysis,
          retentionScore,
          boilerplatePenalty,
        };
      })
      .sort(compareRankedCandidates);

    stateTrace.push('CANDIDATES_SCORED');

    const selected = ranked[0] || null;
    if (!selected) {
      stateTrace.push('FAILED');
      return {
        stateTrace,
        ranked: [],
        selected: null,
        errorCode: 'NO_VIABLE_CANDIDATES',
      };
    }

    stateTrace.push('CANDIDATE_SELECTED');
    stateTrace.push('COMPLETED');

    return {
      stateTrace,
      ranked,
      selected,
    };
  } catch {
    stateTrace.push('FAILED');
    return {
      stateTrace,
      ranked: [],
      selected: null,
      errorCode: 'PIPELINE_ERROR',
    };
  }
}

