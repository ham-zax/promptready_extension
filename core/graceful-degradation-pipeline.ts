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
      if (redditResult && redditResult.metadata.qualityScore >= finalConfig.minQualityScore) {
        const elapsed = Date.now() - startTime;
        console.log('[Pipeline] ✅ Stage 0 (Reddit Shadow) succeeded:', redditResult.metadata);
        if (finalConfig.debug) {
          console.log('[Pipeline] 📊 Reddit content length:', redditResult.content.length);
        }
        return {
          content: redditResult.content,
          stage: 'reddit-shadow',
          qualityScore: redditResult.metadata.qualityScore,
          qualityReport: `Reddit Shadow DOM extraction: ${redditResult.metadata.strategy}, depth: ${redditResult.metadata.shadowDomDepth}, score: ${redditResult.metadata.qualityScore}`,
          fallbacksUsed,
          extractionTime: elapsed,
          metadata: this.extractMetadata(document),
        };
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
        // Check both gate pass AND minQualityScore requirement
        if (result.gateResult.passed && result.gateResult.score >= finalConfig.minQualityScore) {
          const elapsed = Date.now() - startTime;
          return {
            content: result.content,
            stage: 'semantic',
            qualityScore: result.gateResult.score,
            qualityReport: QualityGateValidator.generateReport(
              result.gateResult
            ),
            fallbacksUsed,
            extractionTime: elapsed,
            metadata: this.extractMetadata(document),
          };
        } else {
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
        // Check both gate pass AND minQualityScore requirement
        if (result.gateResult.passed && result.gateResult.score >= finalConfig.minQualityScore) {
          const elapsed = Date.now() - startTime;
          return {
            content: result.content,
            stage: 'readability',
            qualityScore: result.gateResult.score,
            qualityReport: QualityGateValidator.generateReport(
              result.gateResult
            ),
            fallbacksUsed,
            extractionTime: elapsed,
            metadata: this.extractMetadata(document),
          };
        } else {
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
        const elapsed = Date.now() - startTime;
        return {
          content: result.content,
          stage: 'heuristic',
          qualityScore: result.gateResult.score,
          qualityReport: QualityGateValidator.generateReport(
            result.gateResult
          ),
          fallbacksUsed,
          extractionTime: elapsed,
          metadata: this.extractMetadata(document),
        };
      }

      // Fallback if all stages disabled (shouldn't happen)
      throw new Error(
        'All pipeline stages disabled - cannot extract content'
      );
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
        if (gateResult.passed || config.debug) {
          const content = element.innerHTML;
          return {
            content,
            gateResult,
          };
        }
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
}

export default GracefulDegradationPipeline;
