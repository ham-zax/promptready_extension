// Graceful Degradation Pipeline - Main orchestrator
// Runs extraction through multiple stages with quality gates

import { ReadabilityConfigManager } from './readability-config.js';
import { ScoringEngine } from './scoring/scoring-engine.js';
import { QualityGateValidator, type QualityGateResult } from './quality-gates.js';
import { RedditShadowExtractor } from './reddit-shadow-extractor.js';
import { Readability } from '@mozilla/readability';

export interface PipelineResult {
  content: string;
  stage: 'reddit-shadow' | 'semantic' | 'readability' | 'heuristic';
  qualityScore: number;
  qualityReport: string;
  fallbacksUsed: string[];
  extractionTime: number;
  metadata: {
    url: string;
    title: string;
    timestamp: string;
  };
}

export interface PipelineConfig {
  enableStage1: boolean;
  enableStage2: boolean;
  enableStage3: boolean;
  minQualityScore: number;
  timeout: number;
  debug: boolean;
}

interface StageCandidate {
  stage: PipelineResult['stage'];
  content: string;
  gateResult: QualityGateResult;
  qualityScore: number;
  qualityReport: string;
  meetsThreshold: boolean;
  selectionScore: number;
}

export class GracefulDegradationPipeline {
  private static readonly DEFAULT_CONFIG: PipelineConfig = {
    enableStage1: true,
    enableStage2: true,
    enableStage3: true,
    minQualityScore: 0,
    timeout: 5000,
    debug: false,
  };

  /**
   * Execute the graceful degradation pipeline
   * Tries stages in order: reddit-shadow → semantic → readability → heuristic
   * Falls back to next stage if quality gate fails
   */
  static async execute(
    document: Document,
    config?: Partial<PipelineConfig>
  ): Promise<PipelineResult> {
    const startTime = Date.now();
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const fallbacksUsed: string[] = [];
    const candidates: StageCandidate[] = [];

    // Check for timeout violations
    const checkTimeout = () => {
      if (finalConfig.timeout > 0 && Date.now() - startTime > finalConfig.timeout) {
        throw new Error(`Pipeline execution exceeded timeout of ${finalConfig.timeout}ms`);
      }
    };

    try {
      // Stage 0: Reddit Shadow DOM (site-specific optimization)
      console.log('[Pipeline] 🚀 Starting pipeline execution');
      console.log('[Pipeline] 📍 URL:', document.location?.href || 'unknown');
      console.log('[Pipeline] 🔧 Config:', finalConfig);
      
      const redditResult = RedditShadowExtractor.extractContent(document);
      if (redditResult && this.hasMeaningfulContent(redditResult.content)) {
        const redditValidation = this.validateRawHtml(redditResult.content, document);
        const redditScore = Math.max(
          redditValidation.score,
          Math.min(100, Math.max(0, redditResult.metadata.qualityScore))
        );
        candidates.push({
          stage: 'reddit-shadow',
          content: redditResult.content,
          gateResult: {
            ...redditValidation,
            score: redditScore,
            passed: redditScore >= 40,
          },
          qualityScore: redditScore,
          qualityReport: `Reddit Shadow DOM extraction: ${redditResult.metadata.strategy}, depth: ${redditResult.metadata.shadowDomDepth}, score: ${redditScore}`,
          meetsThreshold: redditScore >= finalConfig.minQualityScore,
          selectionScore: redditScore + 4,
        });
        if (redditScore < finalConfig.minQualityScore) {
          fallbacksUsed.push('reddit-shadow-low-quality');
        }
      } else if (redditResult) {
        fallbacksUsed.push('reddit-shadow-low-quality');
        console.log('[Pipeline] ⚠️  Stage 0 (Reddit Shadow) quality too low:', redditResult.metadata.qualityScore, '< minQualityScore:', finalConfig.minQualityScore);
        if (finalConfig.debug) {
          console.log('[Pipeline] Falling back to Stage 1 (Semantic)');
        }
      } else {
        console.log('[Pipeline] ℹ️  Stage 0 (Reddit Shadow) returned null - not a Reddit page or no content found');
      }

      // Stage 1: Semantic Query (strict gate: 60+)
      if (finalConfig.enableStage1) {
        checkTimeout();
        const result = await this.executeStage1(document, finalConfig);
        if (this.hasMeaningfulContent(result.content)) {
          candidates.push(
            this.buildCandidate('semantic', result.content, result.gateResult, finalConfig)
          );
        }
        if (!result.gateResult.passed || result.gateResult.score < finalConfig.minQualityScore) {
          fallbacksUsed.push('semantic-gate-failed');
          if (finalConfig.debug) {
            console.log(
              '[Pipeline] Stage 1 (Semantic) failed gate or minQualityScore:',
              result.gateResult
            );
          }
        }
      }

      // Stage 2: Readability (medium gate: 40+)
      if (finalConfig.enableStage2) {
        checkTimeout();
        const result = await this.executeStage2(document, finalConfig);
        if (this.hasMeaningfulContent(result.content)) {
          candidates.push(
            this.buildCandidate('readability', result.content, result.gateResult, finalConfig)
          );
        }
        if (!result.gateResult.passed || result.gateResult.score < finalConfig.minQualityScore) {
          fallbacksUsed.push('readability-gate-failed');
          if (finalConfig.debug) {
            console.log(
              '[Pipeline] Stage 2 (Readability) failed gate or minQualityScore:',
              result.gateResult
            );
          }
        }
      }

      // Stage 3: Heuristic Scoring (always passes - best effort)
      if (finalConfig.enableStage3) {
        checkTimeout();
        const result = await this.executeStage3(document, finalConfig);
        fallbacksUsed.push('using-heuristic-fallback');
        if (this.hasMeaningfulContent(result.content)) {
          candidates.push(
            this.buildCandidate('heuristic', result.content, result.gateResult, finalConfig)
          );
        }
      }

      const selected = this.selectBestCandidate(candidates, finalConfig);
      if (selected) {
        const elapsed = Date.now() - startTime;
        const rejected = candidates
          .filter((candidate) => candidate !== selected)
          .map((candidate) => `${candidate.stage}-candidate-rejected`);
        return {
          content: selected.content,
          stage: selected.stage,
          qualityScore: selected.qualityScore,
          qualityReport: selected.qualityReport,
          fallbacksUsed: Array.from(new Set([...fallbacksUsed, ...rejected])),
          extractionTime: elapsed,
          metadata: this.extractMetadata(document),
        };
      }

      const allExtractionStagesDisabled = !finalConfig.enableStage1 && !finalConfig.enableStage2 && !finalConfig.enableStage3;
      const elapsed = Date.now() - startTime;
      return {
        content: document.body?.innerHTML || '',
        stage: 'heuristic',
        qualityScore: 0,
        qualityReport: allExtractionStagesDisabled
          ? 'No extraction stages enabled - returned body fallback'
          : 'No valid stage candidates met quality thresholds - returned body fallback',
        fallbacksUsed: Array.from(
          new Set([
            ...fallbacksUsed,
            allExtractionStagesDisabled ? 'all-stages-disabled' : 'no-valid-stage-candidate',
          ])
        ),
        extractionTime: elapsed,
        metadata: this.extractMetadata(document),
      };
    } catch (error) {
      console.error('[Pipeline] Unexpected error:', error);
      // Return best-effort content
      const elapsed = Date.now() - startTime;
      return {
        content: document.body.innerHTML,
        stage: 'heuristic',
        qualityScore: 0,
        qualityReport: 'Pipeline error - returned raw body content',
        fallbacksUsed: ['pipeline-error'],
        extractionTime: elapsed,
        metadata: this.extractMetadata(document),
      };
    }
  }

  /**
   * Stage 1: Semantic Query
   * Tries to find content using semantic HTML selectors
   */
  private static async executeStage1(
    document: Document,
    config: PipelineConfig
  ): Promise<{ content: string; gateResult: QualityGateResult }> {
    if (config.debug) console.log('[Pipeline] Executing Stage 1 (Semantic)');

    // Try semantic selectors in priority order
    const selectors = ['article', 'main', '[role="main"]', '[role="article"]'];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const gateResult = QualityGateValidator.validateSemanticQuery(element);
        const content = element.innerHTML;
        return {
          content,
          gateResult,
        };
      }
    }

    // No semantic element found or all failed
    return {
      content: '',
      gateResult: QualityGateValidator.validateSemanticQuery(null),
    };
  }

  /**
   * Stage 2: Readability Extraction
   * Uses Mozilla Readability library
   */
  private static async executeStage2(
    document: Document,
    config: PipelineConfig
  ): Promise<{ content: string; gateResult: QualityGateResult }> {
    if (config.debug) console.log('[Pipeline] Executing Stage 2 (Readability)');

    try {
      // Create a clone to avoid modifying the original
      const docClone = document.cloneNode(true) as Document;

      // Get readability config based on URL
      const url = document.location?.href || '';
      const readConfig = ReadabilityConfigManager.getConfigForUrl(url);
      const reader = new Readability(docClone, readConfig as any);
      const article = reader.parse();

      if (article && article.content) {
        const gateResult = QualityGateValidator.validateReadability(
          article,
          document
        );
        return {
          content: article.content,
          gateResult,
        };
      }
    } catch (error) {
      if (config.debug) {
        console.log('[Pipeline] Stage 2 Readability error:', error);
      }
    }

    return {
      content: '',
      gateResult: QualityGateValidator.validateReadability(null, document),
    };
  }

  /**
   * Stage 3: Heuristic Scoring
   * Uses ScoringEngine to find best content element
   */
  private static async executeStage3(
    document: Document,
    config: PipelineConfig
  ): Promise<{ content: string; gateResult: QualityGateResult }> {
    if (config.debug) console.log('[Pipeline] Executing Stage 3 (Heuristic)');

    try {
      const { bestCandidate } = ScoringEngine.findBestCandidate(
        document.body
      );

      if (bestCandidate && bestCandidate.element) {
        const element = bestCandidate.element;
        if (config.debug) {
          console.log(
            `[Pipeline] Best candidate found with score: ${bestCandidate.score}`
          );
        }

        // Prune the element to remove likely boilerplate
        const pruned = ScoringEngine.pruneNode(element);
        const content = pruned.innerHTML;
        const gateResult =
          QualityGateValidator.validateHeuristicScoring(element);

        return {
          content,
          gateResult,
        };
      }
    } catch (error) {
      if (config.debug) {
        console.log('[Pipeline] Stage 3 error:', error);
      }
    }

    // Fallback to body content
    const gateResult = QualityGateValidator.validateHeuristicScoring(
      document.body
    );
    return {
      content: document.body.innerHTML,
      gateResult,
    };
  }

  /**
   * Extract metadata from document
   */
  private static extractMetadata(document: Document): PipelineResult['metadata'] {
    return {
      url: document.location?.href || '',
      title: document.title || '',
      timestamp: new Date().toISOString(),
    };
  }

  private static validateRawHtml(
    html: string,
    sourceDocument: Document
  ): QualityGateResult {
    const temp = sourceDocument.createElement('div');
    temp.innerHTML = html;
    return QualityGateValidator.validateHeuristicScoring(temp);
  }

  private static buildCandidate(
    stage: PipelineResult['stage'],
    content: string,
    gateResult: QualityGateResult,
    config: PipelineConfig
  ): StageCandidate {
    const qualityScore = Math.min(100, Math.max(0, gateResult.score));
    return {
      stage,
      content,
      gateResult,
      qualityScore,
      qualityReport: QualityGateValidator.generateReport(gateResult),
      meetsThreshold: gateResult.passed && qualityScore >= config.minQualityScore,
      selectionScore: this.computeSelectionScore(stage, gateResult, content),
    };
  }

  private static selectBestCandidate(
    candidates: StageCandidate[],
    config: PipelineConfig
  ): StageCandidate | null {
    const viable = candidates.filter((candidate) =>
      this.hasMeaningfulContent(candidate.content)
    );
    if (viable.length === 0) {
      return null;
    }

    const thresholdMet = viable.filter((candidate) => candidate.meetsThreshold);
    const pool = thresholdMet.length > 0 ? thresholdMet : viable;
    const stagePriority: Record<PipelineResult['stage'], number> = {
      'readability': 4,
      'heuristic': 3,
      'reddit-shadow': 2,
      'semantic': 1,
    };
    const sorted = [...pool].sort((a, b) => {
      if (b.selectionScore !== a.selectionScore) {
        return b.selectionScore - a.selectionScore;
      }
      if (b.qualityScore !== a.qualityScore) {
        return b.qualityScore - a.qualityScore;
      }
      return stagePriority[b.stage] - stagePriority[a.stage];
    });

    if (config.debug) {
      console.log(
        '[Pipeline] Candidate ranking:',
        sorted.map((candidate) => ({
          stage: candidate.stage,
          selectionScore: candidate.selectionScore,
          qualityScore: candidate.qualityScore,
          meetsThreshold: candidate.meetsThreshold,
          contentLength: candidate.content.length,
        }))
      );
    }

    return sorted[0] ?? null;
  }

  private static computeSelectionScore(
    stage: PipelineResult['stage'],
    gateResult: QualityGateResult,
    content: string
  ): number {
    const stageBias: Record<PipelineResult['stage'], number> = {
      readability: 6,
      heuristic: 4,
      'reddit-shadow': 3,
      semantic: 2,
    };
    const base = gateResult.score;
    const metrics = gateResult.metrics;
    const retentionBoost = Math.min(18, metrics.retentionCueScore / 5);
    const structureBoost = Math.min(10, metrics.structureScore / 10);
    const passedBoost = gateResult.passed ? 12 : 0;
    const linkPenalty = Math.min(20, metrics.linkDensity * 24);
    const shortPenalty = content.length < 220 ? 10 : 0;

    return Math.max(
      0,
      Math.min(
        160,
        base +
          retentionBoost +
          structureBoost +
          passedBoost +
          stageBias[stage] -
          linkPenalty -
          shortPenalty
      )
    );
  }

  private static hasMeaningfulContent(content: string): boolean {
    if (!content) {
      return false;
    }
    const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text.length >= 80) {
      return true;
    }
    return /<(h1|h2|h3|p|li|article|section|main)\b/i.test(content);
  }
}

export default GracefulDegradationPipeline;
