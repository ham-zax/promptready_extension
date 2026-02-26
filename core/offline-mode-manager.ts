// Offline Mode Manager - orchestrates the complete offline processing workflow
// Integrates with the simplified popup UI and processing pipeline

import { ReadabilityConfigManager } from './readability-config.js';
import { MarkdownPostProcessor } from './post-processor.js';
import { Storage } from '../lib/storage.js';
import { ExportMetadata } from '../lib/types.js';
import { CacheManager } from '../lib/cache-manager.js';
import { PerformanceMetrics } from './performance-metrics.js';
import { safeParseHTML, extractSemanticContent, removeUnwantedElements, extractTextContent } from '../lib/dom-utils.js';
import type { PipelineConfig, PipelineResult } from './graceful-degradation-pipeline.js';

export interface OfflineModeConfig {
  readabilityPreset?: string;
  turndownPreset: string;
  postProcessing: {
    enabled: boolean;
    addTableOfContents: boolean;
    optimizeForPlatform?: 'standard' | 'obsidian' | 'github';
  };
  performance: {
    maxContentLength: number;
    enableCaching: boolean;
    chunkSize: number;
  };
  fallbacks: {
    enableReadabilityFallback: boolean;
    enableTurndownFallback: boolean;
    maxRetries: number;
  };
  skipTurndown?: boolean; // NEW: Skip Turndown conversion if content is already markdown
}

export interface OfflineProcessingResult {
  success: boolean;
  markdown: string;
  metadata: ExportMetadata;
  processingStats: {
    totalTime: number;
    readabilityTime: number;
    turndownTime: number;
    postProcessingTime: number;
    fallbacksUsed: string[];
    qualityScore: number;
  };
  warnings: string[];
  errors: string[];
}

interface CandidateAnalysis {
  textLength: number;
  headingCoverage: number;
  sectionCount: number;
  hasNoiseSignals: boolean;
  leadHeadingPresent: boolean;
  anchorCount: number;
  repeatedItemBlocks: number;
  formLikeBlocks: number;
  containsVectorNoise: boolean;
}

interface TurndownConfigManagerLike {
  convert(html: string, presetName?: string): Promise<string>;
}

interface ScoringEngineLike {
  findBestCandidate(root: HTMLElement): {
    bestCandidate: { element: HTMLElement; score: number } | null;
  };
  pruneNode(element: HTMLElement): HTMLElement;
}

interface GracefulDegradationPipelineLike {
  execute(
    document: Document,
    config?: Partial<PipelineConfig>
  ): Promise<Pick<PipelineResult, 'content' | 'stage'>>;
}

export class OfflineModeManager {

  // Performance metrics instance for real-time tracking
  private static performance = PerformanceMetrics.getInstance();
  private static readonly SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private static readonly MAX_SESSION_HISTORY = 200;
  private static monitoringIntervalHandle: ReturnType<typeof setInterval> | null = null;
  private static inFlightRequests = new Map<string, {
    promise: Promise<OfflineProcessingResult>;
    resolve: (value: OfflineProcessingResult) => void;
    reject: (reason?: unknown) => void;
    settled: boolean;
  }>();

  // Real-time metrics tracking
  private static activeSessions = new Map<string, {
    startTime: number;
    htmlLength: number;
    config: OfflineModeConfig;
    status: 'active' | 'completed' | 'failed' | 'cached';
    lastUpdate?: number;
    endTime?: number;
    totalTime?: number;
    qualityScore?: number;
    markdownLength?: number;
    warningsCount?: number;
    errorsCount?: number;
  }>();
  private static readonly METRICS_UPDATE_INTERVAL = 500; // 500ms intervals
  private static turndownConfigManager: TurndownConfigManagerLike | null = null;
  private static scoringEngine: ScoringEngineLike | null = null;
  private static gracefulPipeline: GracefulDegradationPipelineLike | null = null;

  private static readonly DEFAULT_CONFIG: OfflineModeConfig = {
    turndownPreset: 'standard',
    postProcessing: {
      enabled: true,
      addTableOfContents: false,
      optimizeForPlatform: 'standard',
    },
    performance: {
      maxContentLength: 1000000, // 1MB
      enableCaching: true,
      chunkSize: 100000, // 100KB chunks
    },
    fallbacks: {
      enableReadabilityFallback: true,
      enableTurndownFallback: true,
      maxRetries: 2,
    },
  };

  // Use IndexedDB for persistent, high-performance caching
  private static readonly DEFAULT_CACHE_TTL_HOURS = 24;
  private static readonly URL_CONFIG_RULES: Array<{
    id: string;
    match: (normalizedUrl: string) => boolean;
    apply: (config: OfflineModeConfig) => void;
  }> = [
    {
      id: 'reddit',
      match: (normalizedUrl) => normalizedUrl.includes('reddit.com'),
      apply: (config) => {
        config.readabilityPreset = 'reddit-post';
        config.turndownPreset = 'standard';
        config.postProcessing = {
          ...config.postProcessing,
          addTableOfContents: false,
          optimizeForPlatform: 'standard',
        };
      },
    },
    {
      id: 'technical-docs',
      match: (normalizedUrl) =>
        normalizedUrl.includes('github.com') ||
        normalizedUrl.includes('docs.') ||
        normalizedUrl.includes('api.'),
      apply: (config) => {
        config.readabilityPreset = 'technical-documentation';
        config.turndownPreset = 'github';
        config.postProcessing.optimizeForPlatform = 'github';
      },
    },
    {
      id: 'blog',
      match: (normalizedUrl) =>
        normalizedUrl.includes('blog') ||
        normalizedUrl.includes('medium.com') ||
        normalizedUrl.includes('substack.com'),
      apply: (config) => {
        config.readabilityPreset = 'blog-article';
        config.turndownPreset = 'standard';
        config.postProcessing.addTableOfContents = true;
      },
    },
    {
      id: 'wiki',
      match: (normalizedUrl) =>
        normalizedUrl.includes('wikipedia.org') ||
        normalizedUrl.includes('wiki'),
      apply: (config) => {
        config.readabilityPreset = 'wiki-content';
        config.turndownPreset = 'standard';
        config.postProcessing.addTableOfContents = true;
      },
    },
  ];

  private static mergeConfig(
    overrides?: Partial<OfflineModeConfig>
  ): OfflineModeConfig {
    return {
      ...this.DEFAULT_CONFIG,
      ...overrides,
      postProcessing: {
        ...this.DEFAULT_CONFIG.postProcessing,
        ...(overrides?.postProcessing || {}),
      },
      performance: {
        ...this.DEFAULT_CONFIG.performance,
        ...(overrides?.performance || {}),
      },
      fallbacks: {
        ...this.DEFAULT_CONFIG.fallbacks,
        ...(overrides?.fallbacks || {}),
      },
    };
  }

  static async preloadRuntimeModules(): Promise<void> {
    await Promise.allSettled([
      this.getTurndownConfigManager(),
      this.getScoringEngine(),
      this.getGracefulDegradationPipeline(),
    ]);
  }

  private static isChunkLoadFailure(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error || '');
    return /Failed to fetch dynamically imported module|Importing a module script failed/i.test(message);
  }

  private static async getTurndownConfigManager(): Promise<TurndownConfigManagerLike | null> {
    if (this.turndownConfigManager) {
      return this.turndownConfigManager;
    }

    try {
      const module = await import('./turndown-config.js');
      const manager = module?.TurndownConfigManager as TurndownConfigManagerLike | undefined;
      if (!manager) {
        console.warn('[OfflineModeManager] TurndownConfigManager export missing');
        return null;
      }
      this.turndownConfigManager = manager;
      return manager;
    } catch (error) {
      if (this.isChunkLoadFailure(error)) {
        console.warn('[OfflineModeManager] Turndown module unavailable (stale extension chunk). Falling back to native converter.');
      } else {
        console.warn('[OfflineModeManager] Failed to load Turndown module:', error);
      }
      return null;
    }
  }

  private static async getScoringEngine(): Promise<ScoringEngineLike | null> {
    if (this.scoringEngine) {
      return this.scoringEngine;
    }

    try {
      const module = await import('./scoring/scoring-engine.js');
      const scoringEngine = module?.ScoringEngine as ScoringEngineLike | undefined;
      if (!scoringEngine) {
        console.warn('[OfflineModeManager] ScoringEngine export missing');
        return null;
      }
      this.scoringEngine = scoringEngine;
      return scoringEngine;
    } catch (error) {
      if (this.isChunkLoadFailure(error)) {
        console.warn('[OfflineModeManager] ScoringEngine module unavailable (stale extension chunk).');
      } else {
        console.warn('[OfflineModeManager] Failed to load ScoringEngine module:', error);
      }
      return null;
    }
  }

  private static async getGracefulDegradationPipeline(): Promise<GracefulDegradationPipelineLike | null> {
    if (this.gracefulPipeline) {
      return this.gracefulPipeline;
    }

    try {
      const module = await import('./graceful-degradation-pipeline.js');
      const pipeline = module?.GracefulDegradationPipeline as GracefulDegradationPipelineLike | undefined;
      if (!pipeline) {
        console.warn('[OfflineModeManager] GracefulDegradationPipeline export missing');
        return null;
      }
      this.gracefulPipeline = pipeline;
      return pipeline;
    } catch (error) {
      if (this.isChunkLoadFailure(error)) {
        console.warn('[OfflineModeManager] Graceful pipeline module unavailable (stale extension chunk).');
      } else {
        console.warn('[OfflineModeManager] Failed to load graceful pipeline module:', error);
      }
      return null;
    }
  }

  /**
   * Main offline processing entry point
   */
  static async processContent(
    html: string,
    url: string,
    title: string,
    customConfig?: Partial<OfflineModeConfig>
  ): Promise<OfflineProcessingResult> {
    const config = this.mergeConfig(customConfig);
    const cacheSourceHtml = html;
    const normalizedHtmlForKey = typeof html === 'string' ? html : '';
    const inFlightKey = await this.generateInFlightKey(normalizedHtmlForKey, url, config);
    const existingInFlight = this.inFlightRequests.get(inFlightKey);
    if (existingInFlight) {
      console.log('[OfflineModeManager] Joining in-flight processing request');
      return existingInFlight.promise;
    }

    const currentInFlight = this.createInFlightRequest();
    this.inFlightRequests.set(inFlightKey, currentInFlight);

    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];
    let fallbacksUsed: string[] = [];

    // Initialize real-time tracking
    const sessionId = this.generateSessionId();
    this.activeSessions.set(sessionId, {
      startTime,
      htmlLength: html?.length || 0,
      config,
      status: 'active',
      lastUpdate: startTime,
    });
    this.pruneSessionStore();

    // Initialize performance tracking (non-fatal if monitoring itself fails)
    try {
      this.performance.captureMemorySnapshot('processing_start');
      this.performance.recordProcessingSnapshot('processing_start');
    } catch (performanceError) {
      console.warn('[OfflineModeManager] Failed to initialize performance tracking:', performanceError);
    }

    try {
      console.log('[OfflineModeManager] Starting offline processing...');

      // Check cache first
      if (config.performance.enableCaching) {
        const cacheKey = await this.generateCacheKey(cacheSourceHtml, url, config);

        // Track cache retrieval time
        const { result: cached, duration: cacheTime } = await this.performance.measureAsyncOperation(
          'cache_retrieval',
          () => CacheManager.get(cacheKey)
        );

        if (cached) {
          this.performance.recordCacheHit(cacheTime);
          this.performance.recordProcessingSnapshot('cache_hit', undefined, this.performance.getCacheMetrics());
          this.completeSession(sessionId, 'cached', {
            totalTime: Date.now() - startTime,
            qualityScore: cached.processingStats?.qualityScore || 0,
            warningsCount: cached.warnings?.length || 0,
            errorsCount: cached.errors?.length || 0,
            markdownLength: cached.markdown?.length || 0,
          });
          console.log('[OfflineModeManager] Returning cached result');
          this.resolveInFlightRequest(inFlightKey, currentInFlight, cached);
          return cached;
        } else {
          this.performance.recordCacheMiss();
          this.performance.recordProcessingSnapshot('cache_miss', undefined, this.performance.getCacheMetrics());
        }
      }

      // Validate input
      if (!html || html.trim().length === 0) {
        throw new Error('No HTML content provided');
      }

      if (html.length > config.performance.maxContentLength) {
        warnings.push(`Content truncated from ${html.length} to ${config.performance.maxContentLength} characters`);
        html = html.substring(0, config.performance.maxContentLength);
      }

      warnings.push(...this.detectInputWarnings(html));
      if (this.isScriptStyleOnlyContent(html) && !this.hasSecuritySignalWarning(warnings)) {
        throw new Error('No HTML content provided');
      }
      const hasMeaningfulContent = this.hasMeaningfulInputContent(html);
      if (!hasMeaningfulContent) {
        const isSecurityOnlyInput = this.hasSecuritySignalWarning(warnings);
        if (!isSecurityOnlyInput) {
          throw new Error('No HTML content provided');
        }
        warnings.push('Security-only input normalized to safe placeholder content');
        html = '<p>Content sanitized due to security filtering.</p>';
      }

      const preparedExtraction = this.prepareHtmlForExtraction(html);
      const extractionHtml = preparedExtraction.html;
      warnings.push(...preparedExtraction.warnings);

      // Step 1: Content extraction with Readability
      this.performance.captureMemorySnapshot('readability_start');
      this.performance.recordProcessingSnapshot('readability_start');
      const readabilityTimerId = this.performance.recordExtractionStart();
      let extractedContent: string;

      try {
        const readabilityConfig = config.readabilityPreset 
          ? ReadabilityConfigManager.getPresetConfig(config.readabilityPreset)
          : ReadabilityConfigManager.getConfigForUrl(url);

        if (readabilityConfig) {
          const doc = safeParseHTML(extractionHtml);
          if (!doc) {
            throw new Error('Failed to parse HTML for Readability processing');
          }
          const { result: extractionResult } = await this.performance.measureAsyncOperation(
            'readability_extraction',
            () => ReadabilityConfigManager.extractContent(doc, url, readabilityConfig)
          );
          extractedContent = extractionResult.content;
          extractedContent = await this.resolveReadabilityCandidate(
            extractionHtml,
            extractedContent,
            fallbacksUsed,
            warnings,
            config
          );
          console.log('[OfflineModeManager] Readability extraction successful');
        } else {
          throw new Error('No suitable Readability configuration found');
        }
      } catch (error) {
        console.warn('[OfflineModeManager] Readability extraction failed:', error);
        if (config.fallbacks.enableReadabilityFallback) {
          extractedContent = await this.fallbackContentExtraction(extractionHtml);
          fallbacksUsed.push('readability-fallback');
          warnings.push('Used fallback content extraction');
        } else {
          throw error;
        }
      }

      const readabilityTime = this.performance.endTimer(readabilityTimerId);
      this.performance.captureMemorySnapshot('readability_complete');
      this.performance.recordProcessingSnapshot('readability_complete');

      // Step 2: HTML to Markdown conversion (skip if already markdown)
      this.performance.captureMemorySnapshot('turndown_start');
      this.performance.recordProcessingSnapshot('turndown_start');
      let markdown: string;

      const turndownTimerId = this.performance.recordExtractionStart();

      // NEW: Skip Turndown if content is already markdown (e.g., from Reddit extractor)
      if (config.skipTurndown) {
        console.log('[OfflineModeManager] Skipping Turndown - content is already markdown');
        markdown = html; // Content is already markdown, use as-is
        fallbacksUsed.push('pre-formatted-markdown');
      } else {
        try {
          const TurndownConfigManager = await this.getTurndownConfigManager();
          if (!TurndownConfigManager) {
            throw new Error('Turndown module unavailable');
          }
          const { result: turndownResult } = await this.performance.measureAsyncOperation(
            'turndown_conversion',
            () => TurndownConfigManager.convert(extractedContent, config.turndownPreset)
          );
          markdown = turndownResult;
          console.log('[OfflineModeManager] Turndown conversion successful');
        } catch (error) {
          console.warn('[OfflineModeManager] Turndown conversion failed:', error);
          if (config.fallbacks.enableTurndownFallback) {
            markdown = await this.fallbackMarkdownConversion(extractedContent);
            fallbacksUsed.push('turndown-fallback');
            warnings.push('Used fallback markdown conversion');
          } else {
            throw error;
          }
        }
      }

      const turndownTime = this.performance.endTimer(turndownTimerId);
      this.performance.captureMemorySnapshot('turndown_complete');
      this.performance.recordProcessingSnapshot('turndown_complete');

      // Step 3: Post-processing
      this.performance.captureMemorySnapshot('post_processing_start');
      this.performance.recordProcessingSnapshot('post_processing_start');
      let processedMarkdown = markdown;
      let postProcessingTime = 0;

      const postProcessingTimerId = this.performance.recordExtractionStart();

      if (config.postProcessing.enabled) {
        try {
          const postProcessingOptions = this.getPostProcessingOptions(config);
          const { result: postResult, duration: postProcessingDuration } = await this.performance.measureAsyncOperation(
            'post_processing',
            () => Promise.resolve(MarkdownPostProcessor.process(processedMarkdown, postProcessingOptions))
          );
          processedMarkdown = postResult.markdown;
          postProcessingTime = postProcessingDuration;
          warnings.push(...postResult.warnings);
          console.log(`[OfflineModeManager] Post-processing completed with ${postResult.improvements.length} improvements`);
        } catch (error) {
          console.warn('[OfflineModeManager] Post-processing failed:', error);
          warnings.push('Post-processing failed, using raw markdown');
        }
      }

      postProcessingTime = this.performance.endTimer(postProcessingTimerId);
      this.performance.captureMemorySnapshot('post_processing_complete');
      this.performance.recordProcessingSnapshot('post_processing_complete');

      // Step 4: Generate metadata and insert cite-first block
      const selectionHash = await this.generateCacheKey(cacheSourceHtml, url, config);
      const metadata = this.generateMetadata(title, url, selectionHash, html);
      processedMarkdown = this.normalizeUnicodeWhitespace(processedMarkdown);
      if (!processedMarkdown || processedMarkdown.trim().length === 0) {
        const sparseFallback = this.buildSparseContentFallback(extractionHtml, warnings);
        if (sparseFallback) {
          processedMarkdown = sparseFallback;
          warnings.push('Used sparse content fallback');
        } else {
          throw new Error('No HTML content provided');
        }
      }
      processedMarkdown = this.canonicalizeDeliveredMarkdown(processedMarkdown, metadata, warnings);

      // Step 5: Quality assessment
      const qualityScore = this.assessQuality(processedMarkdown, extractionHtml, warnings, errors);

      const totalTime = Date.now() - startTime;

      // Record comprehensive extraction metrics
      const extractionMetrics = this.performance.recordExtractionComplete(
        readabilityTime,
        turndownTime,
        postProcessingTime,
        extractionHtml.length,
        extractedContent.length,
        processedMarkdown.length,
        fallbacksUsed
      );

      // Record quality metrics
      const qualityMetrics = this.performance.recordQualityMetrics(
        qualityScore,
        this.calculateStructurePreservation(html, processedMarkdown),
        this.calculateReadabilityScore(processedMarkdown),
        warnings.length,
        errors.length
      );

      // Record successful extraction
      this.performance.recordExtraction({
        extractionTime: totalTime,
        contentLength: extractionHtml.length,
        contentQuality: qualityScore,
        charThreshold: extractionHtml.length > config.performance.maxContentLength ? 'truncated' : 'within_limit',
        presetUsed: config.readabilityPreset || 'auto',
        timestamp: Date.now(),
      });

      // Final performance snapshot
      this.performance.captureMemorySnapshot('processing_complete');
      this.performance.recordProcessingSnapshot(
        'processing_complete',
        extractionMetrics,
        this.performance.getCacheMetrics(),
        qualityMetrics
      );

      const result: OfflineProcessingResult = {
        success: true,
        markdown: processedMarkdown,
        metadata,
        processingStats: {
          totalTime,
          readabilityTime,
          turndownTime,
          postProcessingTime,
          fallbacksUsed,
          qualityScore,
        },
        warnings,
        errors,
      };

      // Cache the result
      if (config.performance.enableCaching) {
        const cacheKey = await this.generateCacheKey(cacheSourceHtml, url, config);
        await CacheManager.set(cacheKey, result, this.DEFAULT_CACHE_TTL_HOURS);
      }

      // Update real-time session tracking
      this.completeSession(sessionId, 'completed', {
        totalTime,
        qualityScore,
        warningsCount: warnings.length,
        errorsCount: errors.length,
        markdownLength: processedMarkdown.length
      });

      console.log(`[OfflineModeManager] Processing completed in ${totalTime.toFixed(2)}ms`);
      this.resolveInFlightRequest(inFlightKey, currentInFlight, result);
      return result;

        } catch (error) {
      console.error('[OfflineModeManager] Processing failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);
      if (error instanceof Error && error.name) {
        errors.push(`ErrorType: ${error.name}`);
      }
      if (error instanceof Error && error.stack) {
        errors.push(`ErrorStack: ${error.stack}`);
      }

      // Record failure metrics
      this.performance.recordExtractionFailure();
      this.performance.captureMemorySnapshot('processing_error');

      const totalTime = Date.now() - startTime;
      this.completeSession(sessionId, 'failed', {
        totalTime,
        qualityScore: 0,
        warningsCount: warnings.length,
        errorsCount: errors.length,
        markdownLength: 0,
      });

      // Record quality metrics even for failures
      const qualityMetrics = this.performance.recordQualityMetrics(
        0, // Failed extraction gets 0 quality score
        0, // No structure preservation for failure
        0, // No readability score for failure
        warnings.length,
        errors.length
      );

      this.performance.recordProcessingSnapshot(
        'processing_error',
        undefined,
        this.performance.getCacheMetrics(),
        qualityMetrics
      );

      const failedResult: OfflineProcessingResult = {
        success: false,
        markdown: '',
        metadata: this.generateMetadata(title, url, 'error-' + Date.now()),
        processingStats: {
          totalTime,
          readabilityTime: 0,
          turndownTime: 0,
          postProcessingTime: 0,
          fallbacksUsed,
          qualityScore: 0,
        },
        warnings,
        errors,
      };
      this.resolveInFlightRequest(inFlightKey, currentInFlight, failedResult);
      return failedResult;
    }
  }

  private static createInFlightRequest(): {
    promise: Promise<OfflineProcessingResult>;
    resolve: (value: OfflineProcessingResult) => void;
    reject: (reason?: unknown) => void;
    settled: boolean;
  } {
    let resolveFn!: (value: OfflineProcessingResult) => void;
    let rejectFn!: (reason?: unknown) => void;
    const promise = new Promise<OfflineProcessingResult>((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    });
    return {
      promise,
      resolve: resolveFn,
      reject: rejectFn,
      settled: false,
    };
  }

  private static resolveInFlightRequest(
    key: string,
    request: {
      promise: Promise<OfflineProcessingResult>;
      resolve: (value: OfflineProcessingResult) => void;
      reject: (reason?: unknown) => void;
      settled: boolean;
    },
    result: OfflineProcessingResult
  ): void {
    if (request.settled) {
      return;
    }
    request.settled = true;
    request.resolve(result);
    this.inFlightRequests.delete(key);
  }

  private static async generateInFlightKey(
    html: string,
    url: string,
    config: OfflineModeConfig
  ): Promise<string> {
    if (!html || html.trim().length === 0) {
      return `empty:${url}:${config.turndownPreset}:${config.readabilityPreset || 'auto'}`;
    }
    return await this.generateCacheKey(html, url, config);
  }

  private static hasMeaningfulInputContent(html: string): boolean {
    const strippedNonContent = html
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<template\b[\s\S]*?<\/template>/gi, ' ')
      .replace(/<(meta|link)\b[^>]*>/gi, ' ');
    const quickText = this.normalizeInputText(strippedNonContent.replace(/<[^>]*>/g, ' '));
    const hasInlineStructure = /<(img|video|audio|table|pre|code|svg|math|canvas|blockquote)\b/i.test(strippedNonContent);
    if (quickText.length === 0 && !hasInlineStructure) {
      return false;
    }

    const doc = safeParseHTML(html);
    if (!doc || !doc.body) {
      return this.normalizeInputText(html).length > 0;
    }

    const clonedDoc = doc.cloneNode(true) as Document;
    this.removeCommentNodes(clonedDoc);
    removeUnwantedElements(clonedDoc, ['script', 'style', 'noscript', 'template', 'meta', 'link']);

    const text = this.normalizeInputText(clonedDoc.body.textContent || '');
    const hasVisibleText = text.length > 0;
    const hasStructuralContent = !!clonedDoc.body.querySelector(
      'img,video,audio,table,pre,code,svg,math,canvas,blockquote'
    );

    return hasVisibleText || hasStructuralContent;
  }

  private static normalizeInputText(value: string): string {
    return this.normalizeUnicodeWhitespace(
      value
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<!\[cdata\[[\s\S]*?\]\]>/gi, ' ')
        .replace(/-->/g, ' ')
    ).replace(/\s+/g, ' ').trim();
  }

  private static normalizeUnicodeWhitespace(value: string): string {
    if (!value) {
      return '';
    }
    const joinerPattern = /((?:\p{L}|\p{N}))(?:\u200B|\u200C|\u200D|\u2060|\uFEFF|\u180E)+(?=(?:\p{L}|\p{N}))/gu;
    return value
      .replace(joinerPattern, '$1 ')
      .replace(/(?:\u200B|\u200C|\u200D|\u2060|\uFEFF|\u180E)/g, '')
      .replace(/[\u00A0\u2000-\u200A\u2028\u2029]/g, ' ');
  }

  private static prepareHtmlForExtraction(
    html: string
  ): { html: string; warnings: string[] } {
    const warnings: string[] = [];
    const doc = safeParseHTML(html);
    if (!doc || !doc.body) {
      return { html, warnings };
    }

    const body = doc.body as HTMLElement;
    this.removeCommentNodes(body);

    removeUnwantedElements(body, [
      'template',
      '[markdownload-hidden="true"]',
      '[data-nosnippet]',
      '[data-ad]',
      '[data-ad-container]',
      '[data-testid*="cookie"]',
      '[id*="cookie"]',
      '[class*="cookie"]',
      '[class*="consent"]',
      '[class*="newsletter"]',
      '[class*="subscribe"]',
      '[class*="popup"]',
      '[class*="modal"]',
      '[aria-modal="true"]',
      '[role="dialog"]',
      '[role="alertdialog"]',
      '[role="search"]',
      'dialog',
      'svg',
      'path',
      'symbol',
      'defs',
      'clipPath',
      'mask',
      'canvas',
      'form[action*="subscribe"]',
      'form[id*="subscribe"]',
      'form[class*="subscribe"]',
      'form[action*="search"]',
      '#search',
      '.search',
      '.search-form',
      '.sidebar',
      '.side',
      '[class*="sidebar"]',
      '[id*="sidebar"]',
      'iframe',
    ]);

    this.removeHiddenOrMarkedElements(body);
    this.removeVisualNoiseElements(body);
    this.removeKeywordNoiseBlocks(body);
    this.cleanupEmptyContainers(body);

    const cleanedHtml = body.innerHTML.trim();
    if (cleanedHtml.length === 0) {
      return { html, warnings };
    }
    if (cleanedHtml !== html.trim()) {
      warnings.push('Applied pre-extraction boilerplate cleanup');
    }
    return { html: cleanedHtml, warnings };
  }

  private static removeKeywordNoiseBlocks(root: HTMLElement): void {
    const candidates = Array.from(
      root.querySelectorAll('div, section, aside, dialog, form, p, li, span')
    ) as HTMLElement[];

    for (const el of candidates) {
      if (!el.parentElement) {
        continue;
      }
      if (el.querySelector('article, main, section h1, section h2, pre, code, table')) {
        continue;
      }

      const text = this.normalizeInputText(el.textContent || '').toLowerCase();
      if (text.length < 30 || text.length > 320) {
        continue;
      }

      const classAndId = `${el.className || ''} ${el.id || ''}`.toLowerCase();
      const signalHits = [
        /cookie|consent|privacy|tracking/.test(text),
        /subscribe|newsletter|sign up|join waitlist/.test(text),
        /popup|modal|overlay|sponsored|advert/.test(text),
        /accept all|manage preferences|allow all|continue/.test(text),
        /cookie|consent|subscribe|newsletter|popup|modal|promo|advert|ad/.test(classAndId),
      ].filter(Boolean).length;

      if (signalHits < 2) {
        continue;
      }

      const anchorCount = el.querySelectorAll('a').length;
      const buttonCount = el.querySelectorAll('button').length;
      const headingCount = el.querySelectorAll('h1, h2, h3, h4').length;
      if (headingCount > 0 && signalHits < 3) {
        continue;
      }
      if (anchorCount + buttonCount === 0 && signalHits < 3) {
        continue;
      }

      el.remove();
    }
  }

  private static removeHiddenOrMarkedElements(root: HTMLElement): void {
    const hiddenElements = Array.from(
      root.querySelectorAll(
        '[markdownload-hidden="true"], [hidden], [aria-hidden="true"], [style*="display:none"], [style*="display: none"], [style*="visibility:hidden"], [style*="visibility: hidden"]'
      )
    );
    for (const el of hiddenElements) {
      if (!el.closest('pre, code, .highlight')) {
        el.remove();
      }
    }
  }

  private static cleanupEmptyContainers(root: HTMLElement): void {
    const emptyContainers = Array.from(
      root.querySelectorAll('p:empty, div:empty, span:empty, section:empty, article:empty, aside:empty')
    );
    for (const el of emptyContainers) {
      el.remove();
    }

    const whitespaceOnly = Array.from(
      root.querySelectorAll('p, div, span, section, article, aside')
    ).filter((el) => (el.textContent || '').trim().length === 0 && el.children.length === 0);

    for (const el of whitespaceOnly) {
      el.remove();
    }
  }

  private static removeVisualNoiseElements(root: HTMLElement): void {
    const vectorElements = Array.from(
      root.querySelectorAll('svg, path, symbol, defs, clipPath, mask, canvas')
    );
    for (const el of vectorElements) {
      if (!el.closest('pre, code')) {
        el.remove();
      }
    }
  }

  private static removeCommentNodes(root: Node): void {
    const comments: Node[] = [];
    const walk = (node: Node) => {
      node.childNodes.forEach((child) => {
        if (child.nodeType === Node.COMMENT_NODE) {
          comments.push(child);
        } else {
          walk(child);
        }
      });
    };
    walk(root);
    comments.forEach((comment) => {
      if (comment.parentNode) {
        comment.parentNode.removeChild(comment);
      }
    });
  }

  private static detectInputWarnings(html: string): string[] {
    const warnings = new Set<string>();
    const lower = html.toLowerCase();
    const decodedEntities = lower
      .replace(/&(tab|newline);/g, ' ')
      .replace(/&#x([0-9a-f]+);?/gi, (_match, hex) => {
        const code = Number.parseInt(hex, 16);
        return Number.isFinite(code) ? String.fromCharCode(code) : ' ';
      })
      .replace(/&#([0-9]+);?/g, (_match, dec) => {
        const code = Number.parseInt(dec, 10);
        return Number.isFinite(code) ? String.fromCharCode(code) : ' ';
      });
    const protocolProbe = decodedEntities.replace(/[\s\x00-\x1f\\]+/g, '');

    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(html)) {
      warnings.add('Unicode invalid control character sequences detected');
    }

    if (/(?:[\uD800-\uDBFF](?![\uDC00-\uDFFF]))|(?:^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(html)) {
      warnings.add('Unicode invalid surrogate sequence detected');
    }

    if (/<script\b/i.test(html)) {
      warnings.add('script XSS content removed');
    }
    if (/\son[a-z]+\s*=/i.test(html)) {
      warnings.add('event handler XSS removed');
    }
    if (/(?:javascript:|vbscript:|data:text\/html)/i.test(html) || /(javascript:|vbscript:|data:text\/html)/i.test(protocolProbe)) {
      warnings.add('protocol XSS sanitized');
    }
    if (/(?:expression\s*\(|@import\s+url\s*\(\s*['"]?\s*javascript:)/i.test(lower)) {
      warnings.add('CSS XSS style sanitized');
    }
    if (/(?:&#x?[0-9a-f]+;|%3cscript|&lt;script&gt;)/i.test(lower) && /(script|javascript:|alert\s*\()/i.test(lower)) {
      warnings.add('encoded XSS sanitized');
    }
    const hasSuspiciousScriptPayload = /<script\b[\s\S]*?(alert\s*\(|document\.|window\.|location\.|eval\s*\(|function\s*\()/i.test(html);
    if (hasSuspiciousScriptPayload || /(\son[a-z]+\s*=|javascript:|vbscript:|data:text\/html)/i.test(html)) {
      warnings.add('malicious payload indicators detected');
    }

    if (/<!--\[if/i.test(html)) {
      warnings.add('conditional comment browser-specific content detected');
    }
    if ((/<!--/i.test(html) || /<!\[cdata\[/i.test(html)) && /(alert\s*\(|javascript:|<script\b)/i.test(html)) {
      warnings.add('comment CDATA suspicious content detected');
    }

    if (/\bname\s*=\s*["']?(?:action|method|submit|length)\b/i.test(html)) {
      warnings.add('DOM clobber name collision risk detected');
      warnings.add('DOM clobber conflict detected');
    }

    if (/\bxmlns(?::\w+)?\s*=|\bdata-[\w-]+\s*=|\baria-[\w-]+\s*=/i.test(html)) {
      warnings.add('namespace custom attribute normalization applied');
    }

    if (/\b(?:meta[^>]+http-equiv\s*=\s*["']?refresh|object\b|embed\b|@import\s+url|data:text\/html)/i.test(html)) {
      warnings.add('data injection payload sanitized');
    }

    if (
      /<[^>]+\b[a-z:-]+\s*=\s*[^"'\s>][^\s>]*/i.test(html) ||
      /<[^>]+\b[a-z:-]+\s*=\s*["'][^"']*["'][^>\s]+\s*=/.test(html)
    ) {
      warnings.add('attribute quote malformed normalization applied');
    }

    if (/(display\s*:\s*none|visibility\s*:\s*hidden|width\s*:\s*0\s*;?\s*height\s*:\s*0|type\s*=\s*["']hidden["'])/i.test(html)) {
      warnings.add('hidden invisible content detected');
    }

    const structure = this.analyzeTagStructure(html);
    if (structure.unclosedCount > 0) {
      warnings.add('unclosed tag structure detected');
    }
    if (structure.unclosedHeadingCount > 0) {
      warnings.add('unclosed heading structure detected');
    }
    if (structure.mismatchedCount > 0) {
      warnings.add('mismatched closing tag detected');
    }
    if (structure.selfClosingVoidWithoutSlash > 0) {
      warnings.add('self-closing tag normalization applied');
    }
    if (structure.tableTagSeen && (structure.mismatchedCount > 0 || structure.unclosedCount > 0)) {
      warnings.add('table malformed structure detected');
    }
    if (structure.listTagSeen && (structure.mismatchedCount > 0 || structure.unclosedCount > 0)) {
      warnings.add('list structure orphaned items detected');
    }

    return Array.from(warnings);
  }

  private static shouldFallbackForCoverage(extractedContent: string, originalHtml: string): boolean {
    const extractedText = this.normalizeInputText(extractTextContent(extractedContent));
    const sourceText = this.normalizeInputText(extractTextContent(originalHtml));
    if (sourceText.length < 80) {
      return false;
    }
    if (extractedText.length === 0) {
      return true;
    }
    const textCoverage = extractedText.length / sourceText.length;
    if (textCoverage < 0.45) {
      return true;
    }

    const originalDoc = safeParseHTML(originalHtml);
    const extractedDoc = safeParseHTML(extractedContent);
    if (!originalDoc || !extractedDoc || !originalDoc.body || !extractedDoc.body) {
      return false;
    }

    const sourceRoot = this.selectCoverageRoot(originalDoc);
    const extractedRoot = this.selectCoverageRoot(extractedDoc);
    const sourceSectionCount = this.countSubstantialSections(sourceRoot);
    const extractedSectionCount = this.countSubstantialSections(extractedRoot);
    const isLandingLikeComposite = sourceSectionCount >= 2 && sourceSectionCount <= 8;

    const sourceHeadings = this.collectMeaningfulHeadings(sourceRoot);
    const extractedHeadings = this.collectMeaningfulHeadings(extractedRoot);

    if (isLandingLikeComposite && sourceHeadings.length >= 2 && sourceHeadings.length <= 10) {
      const matchedHeadings = sourceHeadings.filter((heading) =>
        extractedHeadings.some((candidate) => this.areHeadingsEquivalent(heading, candidate))
      ).length;
      const headingCoverage = matchedHeadings / sourceHeadings.length;
      if (headingCoverage < 0.6) {
        return true;
      }

      const leadHeading = sourceHeadings[0];
      if (
        leadHeading &&
        !extractedHeadings.some((candidate) => this.areHeadingsEquivalent(leadHeading, candidate))
      ) {
        return true;
      }
    }

    const sourceHeadingCount = sourceRoot.querySelectorAll('h1, h2, h3, h4').length;
    const extractedHeadingCount = extractedRoot.querySelectorAll('h1, h2, h3, h4').length;
    if (
      sourceHeadingCount >= 4 &&
      extractedHeadingCount < Math.max(2, Math.floor(sourceHeadingCount * 0.4))
    ) {
      return true;
    }

    const sourceLists = sourceRoot.querySelectorAll('li').length;
    const extractedLists = extractedRoot.querySelectorAll('li').length;
    if (sourceLists >= 8 && extractedLists < Math.floor(sourceLists * 0.25)) {
      return true;
    }

    if (
      isLandingLikeComposite &&
      extractedSectionCount < Math.max(1, Math.floor(sourceSectionCount * 0.5))
      && this.containsUiNoiseSignals(extractedText)
    ) {
      return true;
    }

    if (
      isLandingLikeComposite &&
      this.containsUiNoiseSignals(extractedText)
    ) {
      return true;
    }

    return false;
  }

  private static selectCoverageRoot(doc: Document): HTMLElement {
    const body = doc.body as HTMLElement | null;
    if (!body) {
      return doc.documentElement as HTMLElement;
    }

    const bodyTextLength = this.normalizeInputText(body.textContent || '').length || 1;
    const candidateSelectors =
      'main, article, [role="main"], #content, .content, .main-content, .post-content, .article-body, .article-content';
    const candidates = Array.from(doc.querySelectorAll(candidateSelectors)) as HTMLElement[];

    let bestCandidate: HTMLElement | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const candidate of candidates) {
      if (!candidate || !candidate.isConnected) {
        continue;
      }

      const textLength = this.normalizeInputText(candidate.textContent || '').length;
      if (textLength < 80) {
        continue;
      }

      const classAndId = `${candidate.className || ''} ${candidate.id || ''}`.toLowerCase();
      const linkDensity = this.calculateLinkDensity(candidate);
      const repeatedItemBlocks = this.countRepeatedItemBlocks(candidate);
      const formLikeBlocks = this.countFormLikeBlocks(candidate);
      const role = (candidate.getAttribute('role') || '').toLowerCase();
      const tag = candidate.tagName.toLowerCase();
      const isPrimarySemantic = tag === 'main' || tag === 'article' || role === 'main';
      const isLikelySidebar = /(sidebar|^side$|\\bside\\b|search|filter|menu|nav|footer|header|widget|promo)/i.test(classAndId);
      const isTinyVsBody = textLength < bodyTextLength * 0.08;

      if (isLikelySidebar && !isPrimarySemantic && textLength < bodyTextLength * 0.7) {
        continue;
      }

      let score = 0;
      score += Math.min(1800, textLength);
      score += isPrimarySemantic ? 520 : 0;
      score += repeatedItemBlocks * 140;
      score -= linkDensity * 360;
      score -= formLikeBlocks * 220;
      score -= isTinyVsBody ? 600 : 0;
      score -= isLikelySidebar ? 380 : 0;

      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidate;
      }
    }

    return bestCandidate ?? body;
  }

  private static countRepeatedItemBlocks(root: HTMLElement): number {
    const candidates = Array.from(
      root.querySelectorAll('article, [role="article"], li, .thing, .post, .story, .card, .feed-item')
    ) as HTMLElement[];
    let count = 0;

    for (const item of candidates) {
      const textLength = this.normalizeInputText(item.textContent || '').length;
      if (textLength < 40 || textLength > 1600) {
        continue;
      }
      if (item.querySelectorAll('a').length === 0) {
        continue;
      }
      count++;
      if (count >= 40) {
        return count;
      }
    }

    return count;
  }

  private static countFormLikeBlocks(root: HTMLElement): number {
    return root.querySelectorAll(
      'form, input, select, textarea, [role="search"], .search, .search-form'
    ).length;
  }

  private static isLikelyFeedCandidate(details: CandidateAnalysis, linkDensity: number): boolean {
    const maxExpectedFormControls = Math.max(12, details.repeatedItemBlocks * 8);
    if (
      details.repeatedItemBlocks >= 4 &&
      details.anchorCount >= 10 &&
      details.formLikeBlocks <= maxExpectedFormControls
    ) {
      return true;
    }
    return details.repeatedItemBlocks >= 6 && linkDensity >= 0.45;
  }

  private static collectMeaningfulHeadings(root: HTMLElement): string[] {
    const seen = new Set<string>();
    const headings = Array.from(root.querySelectorAll('h1, h2, h3, h4'))
      .map((el) => this.normalizeHeadingForComparison(el.textContent || ''))
      .filter((value) => value.length >= 10)
      .filter((value) => {
        if (seen.has(value)) {
          return false;
        }
        seen.add(value);
        return true;
      });
    return headings;
  }

  private static normalizeHeadingForComparison(value: string): string {
    return this.normalizeInputText(value)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static areHeadingsEquivalent(source: string, candidate: string): boolean {
    if (!source || !candidate) {
      return false;
    }
    if (source === candidate) {
      return true;
    }
    if (source.length >= 20 && candidate.includes(source)) {
      return true;
    }
    if (candidate.length >= 20 && source.includes(candidate)) {
      return true;
    }

    const sourceTokens = source.split(' ').filter((token) => token.length > 2);
    const candidateTokens = new Set(candidate.split(' ').filter((token) => token.length > 2));
    if (sourceTokens.length === 0 || candidateTokens.size === 0) {
      return false;
    }
    const overlap = sourceTokens.filter((token) => candidateTokens.has(token)).length;
    return overlap >= Math.min(3, sourceTokens.length, candidateTokens.size);
  }

  private static countSubstantialSections(root: HTMLElement): number {
    const structuralContainers: HTMLElement[] = [];
    for (const child of Array.from(root.children)) {
      if (!child || typeof (child as Element).tagName !== 'string') {
        continue;
      }
      const element = child as HTMLElement;
      const tag = element.tagName.toLowerCase();
      if (tag === 'section' || tag === 'article' || tag === 'main' || tag === 'div') {
        structuralContainers.push(element);
      }
    }

    if (structuralContainers.length === 0) {
      return 0;
    }

    return structuralContainers.filter((container) => {
      const textLength = this.normalizeInputText(container.textContent || '').length;
      const headingCount = container.querySelectorAll('h1, h2, h3').length;
      const hasMeaningfulHeading = headingCount > 0 && textLength >= 40;
      if (textLength < 80 && !hasMeaningfulHeading) {
        return false;
      }
      const classAndId = `${container.className || ''} ${container.id || ''}`.toLowerCase();
      if (/(nav|menu|header|footer|sidebar|breadcrumb|ad|promo|cookie|subscribe|widget|modal)/i.test(classAndId)) {
        return false;
      }
      const linkDensity = this.calculateLinkDensity(container);
      const repeatedItemBlocks = this.countRepeatedItemBlocks(container);
      if (repeatedItemBlocks >= 3 && linkDensity <= 0.85) {
        return true;
      }
      return linkDensity <= 0.5;
    }).length;
  }

  private static containsUiNoiseSignals(text: string): boolean {
    return /(subscribe|newsletter|related links|accept all .*cookie|cookie settings|join waitlist|sign up for (our )?newsletter|tracking cookies?|popup ad|manage preferences|allow all cookies|limit my search|advanced search: by author|search faq)/i.test(text);
  }

  private static async resolveReadabilityCandidate(
    extractionHtml: string,
    readabilityContent: string,
    fallbacksUsed: string[],
    warnings: string[],
    config: OfflineModeConfig
  ): Promise<string> {
    if (!config.fallbacks.enableReadabilityFallback) {
      return readabilityContent;
    }

    const fallbackCandidate = await this.fallbackContentExtraction(extractionHtml);
    if (!fallbackCandidate || this.normalizeInputText(extractTextContent(fallbackCandidate)).length === 0) {
      return readabilityContent;
    }

    const coverageLow = this.shouldFallbackForCoverage(readabilityContent, extractionHtml);
    const shouldAdopt = this.shouldAdoptFallbackCandidate(
      extractionHtml,
      readabilityContent,
      fallbackCandidate
    );

    if (shouldAdopt) {
      if (coverageLow) {
        fallbacksUsed.push('readability-low-coverage-fallback');
        warnings.push('Readability extraction coverage low; used fallback content extraction');
      } else {
        fallbacksUsed.push('readability-ranked-fallback');
        warnings.push('Selected higher-quality fallback candidate over readability output');
      }
      return fallbackCandidate;
    }

    if (coverageLow) {
      warnings.push('Readability extraction coverage low; retained readability candidate after quality check');
    }

    return readabilityContent;
  }

  private static shouldAdoptFallbackCandidate(
    originalHtml: string,
    readabilityContent: string,
    fallbackContent: string
  ): boolean {
    if (!fallbackContent || this.normalizeInputText(extractTextContent(fallbackContent)).length === 0) {
      return false;
    }

    const readabilityAnalysis = this.analyzeExtractionCandidate(originalHtml, readabilityContent);
    const fallbackAnalysis = this.analyzeExtractionCandidate(originalHtml, fallbackContent);
    const readabilityScore = this.computeCandidateSelectionScore(
      originalHtml,
      readabilityContent,
      readabilityAnalysis
    );
    const fallbackScore = this.computeCandidateSelectionScore(
      originalHtml,
      fallbackContent,
      fallbackAnalysis
    );
    if (typeof process !== 'undefined' && (process as any)?.env?.OFFLINE_DEBUG_CANDIDATES === '1') {
      console.log('[OfflineModeManager] Candidate adoption diagnostics', {
        readabilityScore,
        fallbackScore,
        readabilityAnalysis,
        fallbackAnalysis,
      });
    }

    if (fallbackAnalysis.textLength < Math.min(200, readabilityAnalysis.textLength * 0.55)) {
      return false;
    }

    if (readabilityAnalysis.textLength < 220 && fallbackAnalysis.textLength >= 1200) {
      return true;
    }

    if (fallbackAnalysis.hasNoiseSignals && !readabilityAnalysis.hasNoiseSignals) {
      return fallbackScore >= readabilityScore + 14;
    }

    if (fallbackScore >= readabilityScore + 10) {
      return true;
    }

    if (readabilityAnalysis.hasNoiseSignals && !fallbackAnalysis.hasNoiseSignals) {
      if (fallbackAnalysis.textLength >= readabilityAnalysis.textLength * 0.6) {
        return true;
      }
    }

    if (!readabilityAnalysis.leadHeadingPresent && fallbackAnalysis.leadHeadingPresent) {
      if (fallbackAnalysis.textLength >= readabilityAnalysis.textLength * 0.6) {
        return true;
      }
    }

    if (fallbackAnalysis.headingCoverage >= readabilityAnalysis.headingCoverage + 0.2) {
      if (fallbackAnalysis.textLength >= readabilityAnalysis.textLength * 0.7) {
        return true;
      }
    }

    if (fallbackAnalysis.sectionCount > readabilityAnalysis.sectionCount) {
      if (fallbackAnalysis.textLength >= readabilityAnalysis.textLength * 0.7) {
        return true;
      }
    }

    return fallbackScore >= readabilityScore + 6;
  }

  private static computeCandidateSelectionScore(
    originalHtml: string,
    candidateHtml: string,
    analysis?: CandidateAnalysis
  ): number {
    const details = analysis ?? this.analyzeExtractionCandidate(originalHtml, candidateHtml);
    const sourceTextLength = Math.max(1, this.normalizeInputText(extractTextContent(originalHtml)).length);
    const textCoverage = Math.min(1, details.textLength / sourceTextLength);
    const sectionScore = Math.min(1, details.sectionCount / 6);
    const candidateRoot = this.extractCandidateRoot(candidateHtml);
    const linkDensity = candidateRoot ? this.calculateLinkDensity(candidateRoot) : 0;
    const boilerplatePenalty = this.calculateBoilerplatePenalty(candidateHtml);
    const feedLike = this.isLikelyFeedCandidate(details, linkDensity);
    const formSidebarLike = details.formLikeBlocks >= 3 && details.repeatedItemBlocks < 4;

    let score = 0;
    score += details.headingCoverage * 34;
    score += textCoverage * 24;
    score += sectionScore * 14;
    score += details.leadHeadingPresent ? 16 : 0;
    score += feedLike ? 10 : 0;
    score -= details.hasNoiseSignals ? 14 : 0;
    score -= formSidebarLike ? 22 : 0;
    score -= details.containsVectorNoise ? 18 : 0;

    const densityThreshold = feedLike ? 0.78 : 0.45;
    if (linkDensity > densityThreshold) {
      score -= Math.min(18, (linkDensity - densityThreshold) * 60);
    }
    score -= boilerplatePenalty;

    return Math.max(0, Math.min(100, score));
  }

  private static extractCandidateRoot(candidateHtml: string): HTMLElement | null {
    const doc = safeParseHTML(candidateHtml);
    if (!doc || !doc.body) {
      return null;
    }
    return this.selectCoverageRoot(doc);
  }

  private static calculateBoilerplatePenalty(candidateHtml: string): number {
    const text = this.normalizeInputText(extractTextContent(candidateHtml)).toLowerCase();
    if (!text) {
      return 20;
    }

    let penalty = 0;
    if (/(subscribe|newsletter|cookie settings|accept all|related links|all rights reserved|privacy policy|terms of service)/i.test(text)) {
      penalty += 6;
    }
    if (/(raw copy|copy-paste|before ?\/ ?after|example\.com\/)/i.test(text)) {
      penalty += 8;
    }
    if (/(limit my search|advanced search: by author|see the search faq|view more:|join reddit|ad-free experience)/i.test(text)) {
      penalty += 12;
    }
    if (/<path d=|stroke-width=|transform="translate\(|<\/svg>/i.test(candidateHtml)) {
      penalty += 24;
    }

    const escapedTagCount = (candidateHtml.match(/&lt;\/?(?:div|footer|header|nav|section|article|main|p|h[1-6])\b/gi) || []).length;
    if (escapedTagCount >= 6) {
      penalty += Math.min(12, Math.floor(escapedTagCount / 3));
    }

    return penalty;
  }

  private static analyzeExtractionCandidate(
    originalHtml: string,
    candidateHtml: string
  ): CandidateAnalysis {
    const sourceDoc = safeParseHTML(originalHtml);
    const candidateDoc = safeParseHTML(candidateHtml);

    const candidateText = this.normalizeInputText(extractTextContent(candidateHtml));
    if (!sourceDoc || !sourceDoc.body || !candidateDoc || !candidateDoc.body) {
      return {
        textLength: candidateText.length,
        headingCoverage: 0,
        sectionCount: 0,
        hasNoiseSignals: this.containsUiNoiseSignals(candidateText),
        leadHeadingPresent: false,
        anchorCount: 0,
        repeatedItemBlocks: 0,
        formLikeBlocks: 0,
        containsVectorNoise: /<path d=|stroke-width=|transform="translate\(|<\/svg>/i.test(candidateHtml),
      };
    }

    const sourceRoot = this.selectCoverageRoot(sourceDoc);
    const candidateRoot = this.selectCoverageRoot(candidateDoc);
    const sourceHeadings = this.collectMeaningfulHeadings(sourceRoot);
    const candidateHeadings = this.collectMeaningfulHeadings(candidateRoot);

    const matchedHeadings = sourceHeadings.filter((heading) =>
      candidateHeadings.some((candidate) => this.areHeadingsEquivalent(heading, candidate))
    ).length;
    const headingCoverage = sourceHeadings.length > 0 ? matchedHeadings / sourceHeadings.length : 1;
    const leadHeading = sourceHeadings[0];
    const leadHeadingPresent = !!leadHeading && candidateHeadings.some((heading) =>
      this.areHeadingsEquivalent(leadHeading, heading)
    );

    return {
      textLength: candidateText.length,
      headingCoverage,
      sectionCount: this.countSubstantialSections(candidateRoot),
      hasNoiseSignals: this.containsUiNoiseSignals(candidateText),
      leadHeadingPresent,
      anchorCount: candidateRoot.querySelectorAll('a').length,
      repeatedItemBlocks: this.countRepeatedItemBlocks(candidateRoot),
      formLikeBlocks: this.countFormLikeBlocks(candidateRoot),
      containsVectorNoise: /<path d=|stroke-width=|transform="translate\(|<\/svg>/i.test(candidateHtml),
    };
  }

  private static sanitizeRiskyMarkdown(markdown: string, warnings: string[]): string {
    let sanitized = markdown;
    const hasSecurityRiskSignals = this.hasSecuritySignalWarning(warnings);

    if (!hasSecurityRiskSignals) {
      return sanitized;
    }

    sanitized = sanitized
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/\bon[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/(?:java\s*script|vb\s*script)\s*:/gi, 'blocked:')
      .replace(/data\s*:\s*text\/html/gi, 'data:text/blocked')
      .replace(/\balert\s*\(/gi, 'blocked_call(')
      .replace(/a\s*l\s*e\s*r\s*t\s*\(/gi, 'blocked_call(')
      .replace(/\balert\b/gi, 'blocked_alert')
      .replace(/alert\(/gi, 'blocked_call(')
      .replace(/document\s*\.\s*location/gi, 'document.location_blocked')
      .replace(/%3c\/?script%3e/gi, ' ');

    return this.normalizeUnicodeWhitespace(sanitized);
  }

  private static stripResidualUiNoiseLines(markdown: string, warnings: string[]): string {
    if (!markdown) {
      return markdown;
    }

    let sanitized = markdown
      .replace(/\b(?:annoying\s+)?popup\s*ad\s*accept\s*all(?:\s+\d+)?[\s\S]{0,180}?cookies?\s+to\s+continue\.?/gi, '')
      .replace(/\baccept\s*all(?:\s+\d+)?[\s\S]{0,180}?(?:tracking\s+)?cookies?\s+to\s+continue\.?/gi, '')
      .replace(/\bsubscribe\s+to\s+our\s+newsletter\s*\|\s*related\s+links\s*\|\s*footer\s+text\b/gi, '')
      .replace(/\bwelcome to reddit,\s*the front page of the internet\.[\s\S]{0,120}?communities\./gi, '')
      .replace(/\bsource:\s*example\.com\/[^\s•]+(?:\s*•?\s*captured:\s*\d{4}-\d{2}-\d{2}[^\n]*)?/gi, '')
      .replace(/#?\\?`{3}\s*json\s*\\?`{3}/gi, '')
      .replace(/!\[[^\]]*]\(data:image\/svg\+xml,[^)]+\)/gi, '')
      .replace(/^\s*-\s*\[(save|share)\]\(#\)\s*$/gim, '')
      .replace(/^\s*-\s*(hide|report)\s*$/gim, '')
      .replace(/!\[@[^\]]*]\(https?:\/\/avatars\.githubusercontent\.com\/[^)]+\)/gi, '');

    const lines = sanitized.split('\n');
    const filtered = lines.filter((line) => {
      const normalized = this.normalizeInputText(line).toLowerCase();
      const trimmed = line.trim();
      if (!normalized) {
        return true;
      }
      if (/^#{1,6}\s/.test(line)) {
        return true;
      }

      const isUiNoise =
        normalized.length <= 200 &&
        (
          /accept all .*cookies?|manage (cookie|privacy) preferences|allow all cookies/.test(normalized) ||
          /subscribe to (our )?newsletter|join (the )?waitlist|sign up (for|to)/.test(normalized) ||
          /popup ad|popup adaccept|tracking cookies? to continue|related links \| footer text/.test(normalized) ||
          /source:\s*example\.com\/|captured:\s*\d{4}-\d{2}-\d{2}t\d{2}/.test(normalized) ||
          /limit my search to|advanced search: by author|see the search faq|join reddit|view more:/.test(normalized) ||
          /welcome to reddit.*front page of the internet/.test(normalized)
        );
      const isInlineDataUriNoise =
        /data:image\/svg\+xml/.test(normalized) ||
        /svg"><g d="m [\d\s.lcz-]+/.test(normalized);
      const isCounterNoise = /^\d{1,6}$/.test(trimmed) || /^links from:?$/i.test(trimmed) || /^past (hour|24 hours|week|month|year|all time)$/i.test(trimmed);
      const isRedditTimeFilterLine =
        /^\[(past hour|past 24 hours|past week|past month|past year|all time)\]\([^)]+\)$/i.test(trimmed);
      const isVectorPathLine =
        /<path d=|stroke-width=|stroke-linecap=|stroke-linejoin=|transform="translate\(/i.test(trimmed) ||
        /<\/svg>/i.test(trimmed);
      const isSocialActionLine =
        /^(share|save|sharesave|copy link|print|whatsapp|twitter|facebook|instagram|linkedin|telegram|x)$/i.test(trimmed) ||
        /^\[(share|save|copy link|print|whatsapp|twitter|facebook|instagram|linkedin|telegram|x)\]\([^)]+\)$/i.test(trimmed);
      const isSocialIconMarkdown = /^!\[(whatsapp|twitter|facebook|instagram|linkedin|telegram|x|share)\]\(/i.test(trimmed);
      const isStandaloneMarker = trimmed === '*' || trimmed === '•';
      const isPreferencePromoLine = /^make us preferred source on google$/i.test(normalized);
      const isGithubChromeLine =
        /^\[skip to content\]\(#start-of-content\)$/i.test(trimmed) ||
        /^\[(sponsor|star)\]\(/i.test(trimmed) ||
        /^\]\(\/[^)]+\)\[?$/.test(trimmed) ||
        /^built by\s*\[?$/i.test(trimmed);

      return !(
        isUiNoise ||
        isInlineDataUriNoise ||
        isCounterNoise ||
        isRedditTimeFilterLine ||
        isVectorPathLine ||
        isSocialActionLine ||
        isSocialIconMarkdown ||
        isStandaloneMarker ||
        isPreferencePromoLine ||
        isGithubChromeLine
      );
    });

    if (filtered.length !== lines.length) {
      warnings.push('Removed residual UI-noise lines from markdown');
    }
    sanitized = filtered.join('\n');
    return sanitized;
  }

  private static stripUiNoiseCodeBlocks(markdown: string, warnings: string[]): string {
    if (!markdown) {
      return markdown;
    }

    const lines = markdown.split('\n');
    const output: string[] = [];
    let removedBlocks = 0;
    let index = 0;

    const isFence = (line: string): boolean => /^```/.test(line.trim());
    const languageLike = (value: string): boolean => /^[a-z0-9_.#+-]{1,20}$/i.test(value);

    while (index < lines.length) {
      const line = lines[index];
      if (!isFence(line)) {
        output.push(line);
        index++;
        continue;
      }

      const blockLines: string[] = [line];
      const startFenceRaw = line.trim().slice(3).trim();
      let cursor = index + 1;
      while (cursor < lines.length) {
        blockLines.push(lines[cursor]);
        if (isFence(lines[cursor])) {
          cursor++;
          break;
        }
        cursor++;
      }

      const bodyLines = blockLines.slice(1, -1);
      if (startFenceRaw && !languageLike(startFenceRaw)) {
        bodyLines.unshift(startFenceRaw);
      }
      const normalizedBlock = this.normalizeInputText(bodyLines.join(' ')).toLowerCase();

      const uiSignalCount = [
        /(donate|create account|log in|privacy policy|about wikipedia)/.test(normalizedBlock),
        /(cookie settings|accept all .*cookies?|tracking cookies?)/.test(normalizedBlock),
        /(subscribe|newsletter|join waitlist|related links)/.test(normalizedBlock),
        /(front page of the internet|limit my search|advanced search)/.test(normalizedBlock),
        /(raw copy|copy-paste|raw input|selecting main content|contents\s*\[hide]|from wikipedia)/.test(normalizedBlock),
      ].filter(Boolean).length;

      const programmingSignalCount = [
        /\b(import|export|function|const|let|var|class|interface|type)\b/.test(normalizedBlock),
        /\b(fetch|curl|npm|pnpm|yarn|pip|python|node|typescript|javascript)\b/.test(normalizedBlock),
        /\b(select\s+.+\s+from|insert\s+into|update\s+\w+\s+set|delete\s+from|create\s+table)\b/.test(normalizedBlock),
        /[{}`;$]|=>/.test(bodyLines.join('\n')),
      ].filter(Boolean).length;

      const previousLine = output.length > 0 ? output[output.length - 1].trim().toLowerCase() : '';
      const precededByRawLabel =
        /^raw (input|copy[- ]paste|copy-paste|source)/.test(previousLine) ||
        /^promptready (output|pass)$/.test(previousLine);

      const hasNonLanguageFenceHeader = !!startFenceRaw && !languageLike(startFenceRaw);
      const shouldDropBlock =
        normalizedBlock.length >= 20 &&
        programmingSignalCount === 0 &&
        (
          uiSignalCount >= 2 ||
          (uiSignalCount >= 1 && (precededByRawLabel || hasNonLanguageFenceHeader))
        );

      if (shouldDropBlock) {
        removedBlocks++;
        if (precededByRawLabel) {
          output.pop();
        }
      } else {
        output.push(...blockLines);
      }

      index = cursor;
    }

    if (removedBlocks > 0) {
      warnings.push('Removed UI-noise demo code blocks from markdown');
    }

    return output.join('\n');
  }

  private static stripLowSignalMediaArtifacts(markdown: string, warnings: string[]): string {
    if (!markdown) {
      return markdown;
    }

    const lines = markdown.split('\n');
    const filtered: string[] = [];
    let removedCount = 0;

    for (const rawLine of lines) {
      let line = rawLine;
      line = line.replace(/\s+Built by\s*\[\s*$/i, '').trimEnd();
      line = line.replace(/^\s*\]\([^)]+\)\s*/, '');
      line = line.replace(/\s+\[\s*]\([^)]+\)\s*/g, ' ').replace(/\s{2,}/g, ' ').trimEnd();

      const trimmed = line.trim();
      if (!trimmed) {
        filtered.push(line);
        continue;
      }

      if (
        /^\[\s*]\([^)]+\)\s*$/.test(trimmed) ||
        /^\[\s*$/.test(trimmed) ||
        /^\]\([^)]+\)\s*\[?\s*$/.test(trimmed) ||
        /^[-•]\s*$/.test(trimmed) ||
        /^\*\s*$/.test(trimmed)
      ) {
        removedCount++;
        continue;
      }

      if (/^\[make us preferred source on google]\(https?:\/\/www\.google\.com\/preferences\/source\?/i.test(trimmed)) {
        removedCount++;
        continue;
      }

      if (/^(whatsapp|twitter|facebook|instagram|linkedin|telegram|x|share|save|copy link)$/i.test(trimmed)) {
        removedCount++;
        continue;
      }

      if (
        /^>\s*&(?:mdash|#8212);/i.test(trimmed) ||
        /^>\s*[—-]\s*@?[A-Za-z0-9_]+/.test(trimmed)
      ) {
        removedCount++;
        continue;
      }

      const imageMatch = trimmed.match(/^!\[([^\]]*)]\(([^)\s]+)\)$/);
      if (imageMatch) {
        const altText = this.normalizeInputText(imageMatch[1] || '');
        const imageUrl = (imageMatch[2] || '').toLowerCase();
        const looksLikeHashedAlt =
          /^[A-Za-z0-9_-]{10,}$/.test(altText) ||
          (/^[A-Za-z0-9_-]{12,}$/.test(altText.replace(/\s+/g, '')) && !/\s/.test(altText));
        const genericAlt = /^(image|photo|picture|logo|icon|avatar)$/i.test(altText);
        const socialIconAlt = /^(whatsapp|twitter|facebook|instagram|linkedin|telegram|x|share)$/i.test(altText);
        const decorativeHost =
          /framerusercontent\.com|avatars\.githubusercontent\.com|gravatar\.com/.test(imageUrl);
        const socialIconAsset =
          imageUrl.endsWith('.svg') &&
          /whatsapp|twitter|facebook|instagram|linkedin|telegram|share|icon/.test(imageUrl);
        const lowSignalAlt = !altText || looksLikeHashedAlt || genericAlt;
        if (decorativeHost || socialIconAlt || socialIconAsset || lowSignalAlt) {
          removedCount++;
          continue;
        }
      }

      filtered.push(line);
    }

    if (removedCount > 0) {
      warnings.push('Removed low-signal media/link artifacts from markdown');
    }

    return filtered.join('\n');
  }

  private static stripTerminalFooterCluster(markdown: string, warnings: string[]): string {
    if (!markdown) {
      return markdown;
    }

    const lines = markdown.split('\n');
    if (lines.length < 40) {
      return markdown;
    }

    const footerSignal = /(privacy policy|cookie policy|legal documents|cookies settings|all rights reserved|terms|contact us|careers|press and media|community|company|products|solutions|industries|events|slack)/i;
    const lookbackStart = Math.max(0, lines.length - 140);
    let firstSignalLine = -1;
    let signalCount = 0;

    for (let i = lookbackStart; i < lines.length; i++) {
      const normalized = this.normalizeInputText(lines[i]).toLowerCase();
      if (!normalized) {
        continue;
      }
      const isSignal = footerSignal.test(normalized) || /^©\s*\d{4}/.test(normalized);
      if (!isSignal) {
        continue;
      }
      signalCount++;
      if (firstSignalLine === -1) {
        firstSignalLine = i;
      }
    }

    if (signalCount < 5 || firstSignalLine < 0) {
      return markdown;
    }

    warnings.push('Removed terminal footer/legal cluster from markdown');
    return lines.slice(0, firstSignalLine).join('\n').trimEnd();
  }

  private static stripLeadingNavigationPrelude(markdown: string, warnings: string[]): string {
    if (!markdown) {
      return markdown;
    }

    const lines = markdown.split('\n');
    const firstHeadingIndex = lines.findIndex((line) => /^#{1,3}\s+/.test(line.trim()));
    if (firstHeadingIndex <= 0) {
      return markdown;
    }

    const headingLine = lines[firstHeadingIndex].trim().replace(/^#{1,6}\s+/, '');
    const normalizedHeading = this.normalizeHeadingForComparison(headingLine);
    const prelude = lines.slice(0, firstHeadingIndex);
    const remainder = lines.slice(firstHeadingIndex);
    const cleanedPrelude: string[] = [];
    let removedCount = 0;

    for (const line of prelude) {
      const trimmed = line.trim();
      const normalized = this.normalizeInputText(trimmed).toLowerCase();

      if (!trimmed) {
        cleanedPrelude.push(line);
        continue;
      }

      const navLinkOnly = /^[-*]\s*\[[^\]]{1,80}\]\((?:https?:\/\/|\/)[^)]+\)$/.test(trimmed);
      const breadcrumbLabelOnly = /^(home|news|latest|india news|world news|technology|business|sports|markets|opinion)$/i.test(normalized);
      const publicationDateline =
        /(?:^|\s)\|\s*[A-Za-z]{3,9}\s+\d{1,2},\s+\d{4},\s+\d{1,2}:\d{2}/.test(trimmed) &&
        /(?:times|news|post|daily|tribune|herald|journal|express|chronicle|gazette)/i.test(trimmed);
      const duplicateHeadingLine =
        normalizedHeading.length > 0 &&
        this.normalizeHeadingForComparison(trimmed).includes(normalizedHeading) &&
        trimmed.length <= 180;

      if (navLinkOnly || breadcrumbLabelOnly || publicationDateline || duplicateHeadingLine) {
        removedCount++;
        continue;
      }

      cleanedPrelude.push(line);
    }

    if (removedCount === 0) {
      return markdown;
    }

    warnings.push('Removed leading navigation/breadcrumb chrome before article heading');
    const preludeText = cleanedPrelude.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!preludeText) {
      return remainder.join('\n');
    }
    return `${preludeText}\n\n${remainder.join('\n')}`;
  }

  private static collapseFragmentedWordRuns(markdown: string, warnings: string[]): string {
    if (!markdown) {
      return markdown;
    }

    const lines = markdown.split('\n');
    const output: string[] = [];
    let collapsedRunCount = 0;

    const isJoinableTokenLine = (line: string): boolean => {
      const trimmed = line.trim();
      if (!trimmed) {
        return false;
      }
      if (/^(>|#|-|\*|\d+\.)/.test(trimmed)) {
        return false;
      }
      if (/\[[^\]]+\]\([^)]+\)/.test(trimmed)) {
        return false;
      }
      if (trimmed.length < 2 || trimmed.length > 24) {
        return false;
      }
      return /^[A-Za-z][A-Za-z0-9&+/-]*$/.test(trimmed);
    };

    let index = 0;
    while (index < lines.length) {
      if (!isJoinableTokenLine(lines[index])) {
        output.push(lines[index]);
        index++;
        continue;
      }

      const run: string[] = [];
      let cursor = index;
      while (cursor < lines.length && isJoinableTokenLine(lines[cursor])) {
        run.push(lines[cursor].trim());
        cursor++;
      }

      if (run.length >= 5) {
        output.push(run.join(' '));
        collapsedRunCount++;
        index = cursor;
        continue;
      }

      output.push(lines[index]);
      index++;
    }

    if (collapsedRunCount > 0) {
      warnings.push('Collapsed fragmented word-run lines in markdown');
    }

    return output.join('\n');
  }

  private static normalizeMergedTokenBoundaries(markdown: string, warnings: string[]): string {
    if (!markdown) {
      return markdown;
    }

    const lines = markdown.split('\n');
    const output: string[] = [];
    let inFence = false;
    let changed = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (/^```/.test(trimmed)) {
        inFence = !inFence;
        output.push(line);
        continue;
      }

      if (inFence || /^>/.test(trimmed)) {
        output.push(line);
        continue;
      }

      let next = line;
      next = next.replace(/([A-Za-z])((?:https?:\/\/|www\.)[^\s]+)/g, '$1 $2');
      next = next.replace(/([A-Za-z])(\d+\\\.\s+)/g, '$1 $2');
      next = next.replace(/(\d+\\\.\s+[^.\n]{2,120}?)(?=\s+\d+\\\.\s+)/g, '$1\n');

      if (next !== line) {
        changed = true;
      }
      output.push(next);
    }

    if (changed) {
      warnings.push('Normalized merged token boundaries in markdown');
    }

    return output.join('\n');
  }

  private static ensurePrimaryHeading(markdown: string, title: string): string {
    const normalizedTitle = this.normalizeInputText(title);
    if (!normalizedTitle) {
      return markdown;
    }

    const body = markdown.trimStart();
    if (!body) {
      return `# ${normalizedTitle}`;
    }

    const h1Match = body.match(/^#\s+(.+)$/m);
    if (h1Match && this.areHeadingsEquivalent(
      this.normalizeHeadingForComparison(normalizedTitle),
      this.normalizeHeadingForComparison(h1Match[1])
    )) {
      return markdown;
    }

    return `# ${normalizedTitle}\n\n${markdown}`;
  }

  private static hasSecuritySignalWarning(warnings: string[]): boolean {
    return warnings.some((warning) =>
      /protocol|event handler|clobber|data injection|malicious|encoded|attribute quote malformed/i.test(warning)
    );
  }

  private static buildSparseContentFallback(html: string, warnings: string[]): string {
    const textFallback = this.normalizeInputText(extractTextContent(html));
    if (textFallback.length > 0) {
      return textFallback;
    }

    const hasSecuritySignals = this.hasSecuritySignalWarning(warnings);
    if (hasSecuritySignals) {
      return 'Content sanitized due to security filtering.';
    }

    return '';
  }

  private static isScriptStyleOnlyContent(html: string): boolean {
    const allowedTags = new Set(['html', 'head', 'body', 'script', 'style', 'noscript', 'template', 'meta', 'link']);
    const tagRegex = /<\/?\s*([a-zA-Z][a-zA-Z0-9:-]*)\b/g;
    let sawTag = false;
    let match: RegExpExecArray | null;
    while ((match = tagRegex.exec(html)) !== null) {
      sawTag = true;
      const tagName = match[1].toLowerCase();
      if (!allowedTags.has(tagName)) {
        return false;
      }
    }

    if (!sawTag) {
      return this.normalizeInputText(html).length === 0;
    }

    const strippedText = this.normalizeInputText(
      html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ')
    );
    return strippedText.length === 0;
  }

  private static analyzeTagStructure(html: string): {
    unclosedCount: number;
    unclosedHeadingCount: number;
    mismatchedCount: number;
    selfClosingVoidWithoutSlash: number;
    tableTagSeen: boolean;
    listTagSeen: boolean;
  } {
    const voidTags = new Set([
      'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
      'link', 'meta', 'param', 'source', 'track', 'wbr'
    ]);
    const stack: string[] = [];
    let mismatchedCount = 0;
    let selfClosingVoidWithoutSlash = 0;
    let tableTagSeen = false;
    let listTagSeen = false;
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9:-]*)([^>]*)>/g;
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(html)) !== null) {
      const full = match[0];
      const tag = match[1].toLowerCase();
      const isClosing = full.startsWith('</');
      const isSelfClosing = /\/>\s*$/.test(full);

      if (['table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th'].includes(tag)) {
        tableTagSeen = true;
      }
      if (['ul', 'ol', 'li'].includes(tag)) {
        listTagSeen = true;
      }

      if (!isClosing && voidTags.has(tag) && !isSelfClosing) {
        selfClosingVoidWithoutSlash++;
      }

      if (isClosing) {
        const stackTop = stack[stack.length - 1];
        if (!stackTop) {
          mismatchedCount++;
          continue;
        }

        if (stackTop === tag) {
          stack.pop();
          continue;
        }

        mismatchedCount++;
        const existingIndex = stack.lastIndexOf(tag);
        if (existingIndex >= 0) {
          stack.splice(existingIndex, 1);
        }
      } else if (!voidTags.has(tag) && !isSelfClosing) {
        stack.push(tag);
      }
    }

    const unclosedCount = stack.length;
    const unclosedHeadingCount = stack.filter((tag) => /^h[1-6]$/.test(tag)).length;

    return {
      unclosedCount,
      unclosedHeadingCount,
      mismatchedCount,
      selfClosingVoidWithoutSlash,
      tableTagSeen,
      listTagSeen,
    };
  }

  /**
   * Get optimal configuration for a URL
   */
  static async getOptimalConfig(url: string, settings?: any): Promise<OfflineModeConfig> {
    // Use provided settings or load from storage (for backward compatibility)
    const actualSettings = settings || await Storage.getSettings();
    const baseConfig = this.mergeConfig();

    const normalizedUrl = (url || '').toLowerCase();
    const matchedRule = this.URL_CONFIG_RULES.find((rule) => rule.match(normalizedUrl));
    if (matchedRule) {
      matchedRule.apply(baseConfig);
      console.log(`[OfflineModeManager] Applied URL config rule: ${matchedRule.id}`);
    }

    // Apply user preferences
    if (actualSettings.renderer === 'turndown') {
      baseConfig.turndownPreset = 'standard';
    }

    return baseConfig;
  }

  /**
   * Process content in chunks for large documents
   */
  static async processLargeContent(
    html: string, 
    url: string, 
    title: string,
    config?: Partial<OfflineModeConfig>
  ): Promise<OfflineProcessingResult> {
    const finalConfig = this.mergeConfig(config);
    
    if (html.length <= finalConfig.performance.chunkSize) {
      return this.processContent(html, url, title, finalConfig);
    }

    console.log('[OfflineModeManager] Processing large content in chunks...');
    
    // Split content into chunks
    const chunks = this.splitIntoChunks(html, finalConfig.performance.chunkSize);
    const results: OfflineProcessingResult[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      console.log(`[OfflineModeManager] Processing chunk ${i + 1}/${chunks.length}`);
      const chunkResult = await this.processContent(chunks[i], url, `${title} (Part ${i + 1})`, finalConfig);
      results.push(chunkResult);
    }

    // Combine results
    return this.combineChunkResults(results, title, url);
  }

  private static collectFeedCandidates(doc: Document): Array<{ source: string; html: string }> {
    const body = doc.body as HTMLElement | null;
    if (!body) {
      return [];
    }

    const selectorCandidates: Array<{ source: string; element: HTMLElement }> = [];
    const selectors = [
      '#siteTable',
      '.sitetable',
      '.linklisting',
      '[role="feed"]',
      '[data-testid*="feed"]',
      '[data-testid*="post-list"]',
      '.post-list',
      '.posts',
      '.feed',
      '.story-list',
      '[class*="feed"]',
      '[class*="listing"]',
    ];

    for (const selector of selectors) {
      const elements = Array.from(doc.querySelectorAll(selector)) as HTMLElement[];
      for (const element of elements) {
        selectorCandidates.push({ source: `feed:${selector}`, element });
      }
    }

    for (const child of Array.from(body.children)) {
      if (!(child instanceof HTMLElement)) {
        continue;
      }
      const classAndId = `${child.className || ''} ${child.id || ''}`.toLowerCase();
      if (/(side|sidebar|search|nav|menu|footer|header)/i.test(classAndId)) {
        continue;
      }
      selectorCandidates.push({ source: 'feed:top-level', element: child });
    }

    const seen = new Set<string>();
    const results: Array<{ source: string; html: string }> = [];

    for (const candidate of selectorCandidates) {
      const { element } = candidate;
      const key = `${element.tagName}:${element.id || ''}:${element.className || ''}:${element.children.length}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      const classAndId = `${element.className || ''} ${element.id || ''}`.toLowerCase();
      if (/(side|sidebar|search|nav|menu|footer|header|cookie|consent)/i.test(classAndId)) {
        continue;
      }

      const textLength = this.normalizeInputText(element.textContent || '').length;
      const anchorCount = element.querySelectorAll('a').length;
      const repeatedItemBlocks = this.countRepeatedItemBlocks(element);
      const formLikeBlocks = this.countFormLikeBlocks(element);
      if (textLength < 350 || anchorCount < 8) {
        continue;
      }
      if (repeatedItemBlocks < 3 && anchorCount < 18) {
        continue;
      }
      if (formLikeBlocks >= 6 && repeatedItemBlocks < 5) {
        continue;
      }

      results.push({ source: candidate.source, html: element.innerHTML });
    }

    return results;
  }

  /**
   * Fallback content extraction when Readability fails
   * Now uses ScoringEngine for better heuristic-based selection
   */
  private static async fallbackContentExtraction(
    html: string
  ): Promise<string> {
    const normalizedHtml = typeof html === 'string' ? html : '';
    if (!normalizedHtml.trim()) {
      return '';
    }

    try {
      const prepared = this.prepareHtmlForExtraction(normalizedHtml);
      const doc = safeParseHTML(prepared.html);
      if (!doc) {
        return normalizedHtml;
      }

      // For npm pages, look for README specifically
      if (doc.querySelector('[data-testid="readme"]')) {
        const readme = doc.querySelector('[data-testid="readme"]');
        if (readme) {
          return readme.innerHTML;
        }
      }

      const candidatePool: Array<{ source: string; html: string }> = [];
      const primaryRoot = doc.querySelector('main, article, [role="main"], #content, .content, .main-content') as HTMLElement | null;
      if (primaryRoot && this.normalizeInputText(primaryRoot.textContent || '').length > 120) {
        candidatePool.push({
          source: 'primary-root',
          html: this.sanitizeFallbackCandidateHtml(primaryRoot.innerHTML)
        });
      }

      const feedCandidates = this.collectFeedCandidates(doc);
      candidatePool.push(
        ...feedCandidates.map((candidate) => ({
          source: candidate.source,
          html: this.sanitizeFallbackCandidateHtml(candidate.html)
        }))
      );

      // Try ScoringEngine candidate
      try {
        const ScoringEngine = await this.getScoringEngine();
        const body = doc.body as HTMLElement | null;
        if (ScoringEngine && body) {
          const { bestCandidate } = ScoringEngine.findBestCandidate(body);
          if (bestCandidate && bestCandidate.element && bestCandidate.score > 0) {
            console.log(`[OfflineModeManager] Using ScoringEngine result with score: ${bestCandidate.score}`);
            const selectedContainer = this.expandScoringCandidate(bestCandidate.element, body);
            const pruned = ScoringEngine.pruneNode(selectedContainer);
            const scoringHtml = this.normalizeInputText(extractTextContent(pruned.innerHTML)).length === 0
              ? selectedContainer.innerHTML
              : pruned.innerHTML;
            candidatePool.push({
              source: 'scoring-engine',
              html: this.sanitizeFallbackCandidateHtml(scoringHtml)
            });
          }
        }
      } catch (error) {
        console.warn('[OfflineModeManager] ScoringEngine fallback failed:', error);
      }

      // Keep runtime parity with the graceful pipeline by including it as a scored candidate.
      try {
        const GracefulDegradationPipeline = await this.getGracefulDegradationPipeline();
        if (GracefulDegradationPipeline) {
          const pipelineResult = await GracefulDegradationPipeline.execute(doc, {
            enableStage1: true,
            enableStage2: true,
            enableStage3: true,
            minQualityScore: 0,
            timeout: 2500,
            debug: false,
          });
          if (
            pipelineResult?.content &&
            this.normalizeInputText(extractTextContent(pipelineResult.content)).length > 120
          ) {
            candidatePool.push({
              source: `graceful-pipeline:${pipelineResult.stage}`,
              html: this.sanitizeFallbackCandidateHtml(pipelineResult.content),
            });
          }
        }
      } catch (error) {
        console.warn('[OfflineModeManager] Graceful pipeline candidate failed:', error);
      }

      // Try semantic extraction
      const semanticContent = extractSemanticContent(doc, 500);
      if (semanticContent) {
        candidatePool.push({
          source: 'semantic',
          html: this.sanitizeFallbackCandidateHtml(semanticContent)
        });
      }

      // Candidate from cleaned body
      const body = doc.body;
      if (body) {
        removeUnwantedElements(body, [
          '.ad',
          '.advertisement',
          'aside',
          'nav',
          'header',
          'footer',
          'svg',
          'path',
          'symbol',
          'defs',
          'clipPath',
          'mask',
          'canvas',
          '.search',
          '.search-form',
          '#search',
          '.sidebar',
          '.side',
          '[role="navigation"]',
          '[role="banner"]',
          '[role="contentinfo"]',
          '[role="search"]'
        ]);
        this.removeVisualNoiseElements(body);
        this.cleanupEmptyContainers(body);
        candidatePool.push({
          source: 'body',
          html: this.sanitizeFallbackCandidateHtml(body.innerHTML)
        });
      }

      const sourceTextLength = this.normalizeInputText(extractTextContent(prepared.html)).length;
      const minLengthThreshold = Math.min(220, Math.max(80, Math.floor(sourceTextLength * 0.08)));

      const ranked = candidatePool
        .map((candidate) => ({
          source: candidate.source,
          html: typeof candidate.html === 'string' ? candidate.html : '',
          textLength: this.normalizeInputText(extractTextContent(candidate.html || '')).length,
        }))
        .filter((candidate) => candidate.textLength > 0)
        .filter((candidate) => candidate.textLength >= minLengthThreshold)
        .map((candidate) => ({
          ...candidate,
          score: this.computeCandidateSelectionScore(prepared.html, candidate.html),
        }))
        .sort((a, b) => b.score - a.score);

      if (typeof process !== 'undefined' && (process as any)?.env?.OFFLINE_DEBUG_CANDIDATES === '1') {
        console.log('[OfflineModeManager] Fallback candidate ranking', ranked.map((entry) => ({
          source: entry.source,
          score: entry.score,
          length: this.normalizeInputText(extractTextContent(entry.html)).length,
        })));
      }

      if (ranked.length > 0) {
        return ranked[0].html;
      }

      return prepared.html || normalizedHtml;
    } catch (error) {
      console.warn('[OfflineModeManager] fallbackContentExtraction failed; returning normalized source HTML:', error);
      return normalizedHtml;
    }
  }

  private static sanitizeFallbackCandidateHtml(candidateHtml: string): string {
    const doc = safeParseHTML(candidateHtml);
    if (!doc || !doc.body) {
      return candidateHtml;
    }

    removeUnwantedElements(doc.body, [
      'aside',
      'nav',
      'header',
      'footer',
      '.sidebar',
      '.side',
      '.search',
      '.search-form',
      '#search',
      '[role="navigation"]',
      '[role="banner"]',
      '[role="contentinfo"]',
      '[role="search"]'
    ]);
    this.removeVisualNoiseElements(doc.body);
    this.cleanupEmptyContainers(doc.body);
    return doc.body.innerHTML;
  }

  private static expandScoringCandidate(candidate: HTMLElement, body: HTMLElement): HTMLElement {
    let selected = candidate;
    let current = candidate.parentElement as HTMLElement | null;
    const bodyTextLength = this.normalizeInputText(body.textContent || '').length || 1;

    while (current && current !== body) {
      const currentTextLength = this.normalizeInputText(current.textContent || '').length;
      const selectedTextLength = this.normalizeInputText(selected.textContent || '').length || 1;
      const classAndId = `${current.className || ''} ${current.id || ''}`.toLowerCase();
      const isLikelyNoiseContainer =
        /(nav|menu|header|footer|sidebar|breadcrumb|ad|promo|cookie|subscribe|widget|modal)/i.test(classAndId);
      const linkDensity = this.calculateLinkDensity(current);
      const headingCount = current.querySelectorAll('h1, h2, h3, h4').length;
      const sectionCount = current.querySelectorAll('section, article').length;
      const substantialSections = this.countSubstantialSections(current);
      const role = (current.getAttribute('role') || '').toLowerCase();
      const isPrimaryContainer =
        current.tagName.toLowerCase() === 'main' ||
        current.tagName.toLowerCase() === 'article' ||
        role === 'main';

      const isCompositeContainer = substantialSections >= 2 || sectionCount >= 2;
      const expansionThreshold = isCompositeContainer ? 1.2 : 1.5;
      const expandsMeaningfully = currentTextLength >= selectedTextLength * expansionThreshold;
      const gainsStructure = headingCount >= 2 || sectionCount >= 2 || substantialSections >= 2;
      const withinReasonableBounds = isPrimaryContainer
        ? currentTextLength <= bodyTextLength * 1.1
        : currentTextLength <= bodyTextLength * 0.95;
      const acceptableDensity = isPrimaryContainer
        ? linkDensity <= (isCompositeContainer ? 0.75 : 0.62)
        : linkDensity <= 0.42;

      if (
        !isLikelyNoiseContainer &&
        acceptableDensity &&
        withinReasonableBounds &&
        (expandsMeaningfully || gainsStructure)
      ) {
        selected = current;
      }

      current = current.parentElement as HTMLElement | null;
    }

    return selected;
  }

  private static calculateLinkDensity(el: HTMLElement): number {
    const totalTextLength = this.normalizeInputText(el.textContent || '').length || 1;
    const linkTextLength = Array.from(el.querySelectorAll('a')).reduce((sum, link) => {
      return sum + this.normalizeInputText(link.textContent || '').length;
    }, 0);
    return linkTextLength / totalTextLength;
  }

  /**
   * Fallback markdown conversion when Turndown fails
   */
  private static async fallbackMarkdownConversion(html: string): Promise<string> {
    // Simple HTML to Markdown conversion
    const doc = safeParseHTML(html);
    if (!doc) {
      // Fallback to text extraction if parsing fails
      return extractTextContent(html);
    }
    let markdown = '';

    const processNode = (node: Node): void => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        const tagName = element.tagName.toLowerCase();
        
        switch (tagName) {
          case 'h1':
            markdown += `# ${element.textContent}\n\n`;
            break;
          case 'h2':
            markdown += `## ${element.textContent}\n\n`;
            break;
          case 'h3':
            markdown += `### ${element.textContent}\n\n`;
            break;
          case 'p':
            markdown += `${element.textContent}\n\n`;
            break;
          case 'pre':
          case 'code':
            markdown += `\`\`\`\n${element.textContent}\n\`\`\`\n\n`;
            break;
          case 'ul':
          case 'ol':
            element.childNodes.forEach(child => {
              if (child.nodeType === Node.ELEMENT_NODE && (child as Element).tagName.toLowerCase() === 'li') {
                markdown += `- ${child.textContent}\n`;
              }
            });
            markdown += '\n';
            break;
          default:
            element.childNodes.forEach(processNode);
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (text) {
          markdown += `${text}\n\n`;
        }
      }
    };

    doc.body.childNodes.forEach(processNode);
    return markdown;
  }

  /**
   * Generate post-processing options based on configuration
   */
  private static getPostProcessingOptions(config: OfflineModeConfig) {
    return {
      cleanupWhitespace: true,
      normalizeHeadings: true,
      fixListFormatting: true,
      removeEmptyLines: true,
      maxConsecutiveNewlines: 2,
      improveCodeBlocks: true,
      enhanceLinks: true,
      optimizeImages: true,
      addTableOfContents: config.postProcessing.addTableOfContents,
      preserveLineBreaks: config.postProcessing.optimizeForPlatform === 'obsidian',
    };
  }

  /**
   * Generate metadata for processed content
   */
  private static generateMetadata(
    title: string,
    url: string,
    selectionHash: string,
    sourceHtml?: string
  ): ExportMetadata {
    const metadata: ExportMetadata = {
      title: title || 'Untitled',
      url,
      capturedAt: new Date().toISOString(),
      selectionHash,
    };

    if (!sourceHtml) {
      return metadata;
    }

    const sourceSignals = this.extractSourceMetadataSignals(sourceHtml);
    return {
      ...metadata,
      ...sourceSignals,
    };
  }

  private static extractSourceMetadataSignals(html: string): Partial<ExportMetadata> {
    const doc = safeParseHTML(html);
    if (!doc) {
      return {};
    }

    const readMetaContent = (selector: string): string | undefined => {
      const value = doc.querySelector(selector)?.getAttribute('content');
      if (!value) return undefined;
      const normalized = this.normalizeInputText(value);
      return normalized || undefined;
    };

    const datePublishedCandidates: string[] = [];
    const dateModifiedCandidates: string[] = [];
    const bylineCandidates: string[] = [];

    const pushCandidate = (bucket: string[], value?: string | null): void => {
      if (!value) return;
      const normalized = this.normalizeInputText(value);
      if (!normalized) return;
      if (normalized.length > 120) return;
      bucket.push(normalized);
    };

    const publishedMetaSelectors = [
      'meta[property="article:published_time"]',
      'meta[property="og:published_time"]',
      'meta[name="article:published_time"]',
      'meta[name="publishdate"]',
      'meta[name="pubdate"]',
      'meta[name="date"]',
      'meta[itemprop="datePublished"]',
    ];
    for (const selector of publishedMetaSelectors) {
      pushCandidate(datePublishedCandidates, readMetaContent(selector));
    }

    const modifiedMetaSelectors = [
      'meta[property="article:modified_time"]',
      'meta[property="og:updated_time"]',
      'meta[name="lastmod"]',
      'meta[itemprop="dateModified"]',
    ];
    for (const selector of modifiedMetaSelectors) {
      pushCandidate(dateModifiedCandidates, readMetaContent(selector));
    }

    const authorMetaSelectors = [
      'meta[name="author"]',
      'meta[property="article:author"]',
      'meta[itemprop="author"]',
    ];
    for (const selector of authorMetaSelectors) {
      pushCandidate(bylineCandidates, readMetaContent(selector));
    }

    const timeElements = Array.from(
      doc.querySelectorAll(
        'time, [datetime], [itemprop="datePublished"], [itemprop="dateModified"], .dateline, .byline, [class*="timestamp"], [class*="publish"], [class*="update"], [class*="date"], [class*="time"], [id*="date"], [id*="time"], [data-time], [data-timestamp], [data-date], [data-published], [data-updated]'
      )
    ) as HTMLElement[];
    for (const element of timeElements) {
      const datetimeAttr = element.getAttribute('datetime');
      if (datetimeAttr) {
        const isModified = /modified|updated|update/i.test(
          `${element.getAttribute('itemprop') || ''} ${element.className || ''}`
        );
        if (isModified) {
          pushCandidate(dateModifiedCandidates, datetimeAttr);
        } else {
          pushCandidate(datePublishedCandidates, datetimeAttr);
        }
      }
      const text = this.normalizeInputText(element.textContent || '');
      const timestampFragments = this.extractTimestampFragments(text);
      const isModified = /modified|updated|update/i.test(
        `${element.getAttribute('itemprop') || ''} ${element.className || ''}`
      );
      if (timestampFragments.length > 0) {
        for (const fragment of timestampFragments) {
          if (isModified) {
            pushCandidate(dateModifiedCandidates, fragment);
          } else {
            pushCandidate(datePublishedCandidates, fragment);
          }
        }
      } else if (this.looksLikeTimestamp(text)) {
        if (isModified) {
          pushCandidate(dateModifiedCandidates, text);
        } else {
          pushCandidate(datePublishedCandidates, text);
        }
      }
      if (/byline|author/i.test(element.className || '') && text.length > 2 && text.length <= 80) {
        pushCandidate(bylineCandidates, text.replace(/^by\s+/i, ''));
      }
    }

    const jsonLdSignals = this.extractJsonLdMetadataSignals(doc);
    datePublishedCandidates.push(...jsonLdSignals.publishedCandidates);
    dateModifiedCandidates.push(...jsonLdSignals.updatedCandidates);
    bylineCandidates.push(...jsonLdSignals.bylineCandidates);

    const published = this.pickBestTimestamp(datePublishedCandidates);
    const updated = this.pickBestTimestamp(dateModifiedCandidates);
    const byline = this.pickBestByline(bylineCandidates);

    const result: Partial<ExportMetadata> = {};
    if (published) {
      if (published.iso) {
        result.publishedAt = published.iso;
      }
      result.publishedAtText = published.text;
    }
    if (updated) {
      if (updated.iso) {
        result.updatedAt = updated.iso;
      }
      result.updatedAtText = updated.text;
    }
    if (byline) {
      result.byline = byline;
    }

    return result;
  }

  private static extractJsonLdMetadataSignals(doc: Document): {
    publishedCandidates: string[];
    updatedCandidates: string[];
    bylineCandidates: string[];
  } {
    const publishedCandidates: string[] = [];
    const updatedCandidates: string[] = [];
    const bylineCandidates: string[] = [];

    const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
    const visitNode = (node: unknown): void => {
      if (!node) return;

      if (Array.isArray(node)) {
        for (const item of node) {
          visitNode(item);
        }
        return;
      }

      if (typeof node !== 'object') {
        return;
      }

      const obj = node as Record<string, unknown>;
      if (typeof obj.datePublished === 'string') {
        publishedCandidates.push(this.normalizeInputText(obj.datePublished));
      }
      if (typeof obj.dateModified === 'string') {
        updatedCandidates.push(this.normalizeInputText(obj.dateModified));
      }

      const author = obj.author;
      if (typeof author === 'string') {
        bylineCandidates.push(this.normalizeInputText(author));
      } else if (author && typeof author === 'object') {
        const authorObj = author as Record<string, unknown>;
        if (typeof authorObj.name === 'string') {
          bylineCandidates.push(this.normalizeInputText(authorObj.name));
        }
      } else if (Array.isArray(author)) {
        for (const entry of author) {
          if (typeof entry === 'string') {
            bylineCandidates.push(this.normalizeInputText(entry));
            continue;
          }
          if (entry && typeof entry === 'object' && typeof (entry as Record<string, unknown>).name === 'string') {
            bylineCandidates.push(this.normalizeInputText((entry as Record<string, string>).name));
          }
        }
      }

      for (const value of Object.values(obj)) {
        visitNode(value);
      }
    };

    for (const script of scripts) {
      const raw = script.textContent;
      if (!raw) continue;
      try {
        visitNode(JSON.parse(raw));
      } catch {
        // Ignore malformed JSON-LD blocks.
      }
    }

    return {
      publishedCandidates,
      updatedCandidates,
      bylineCandidates,
    };
  }

  private static looksLikeTimestamp(value: string): boolean {
    if (!value) {
      return false;
    }
    const normalized = this.normalizeInputText(value);
    if (normalized.length < 4 || normalized.length > 80) {
      return false;
    }
    if (/\d{4}-\d{2}-\d{2}/.test(normalized)) {
      return true;
    }
    if (/\b\d{1,2}:\d{2}\b/.test(normalized)) {
      return true;
    }
    if (/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/i.test(normalized) && /\d{1,4}/.test(normalized)) {
      return true;
    }
    return /\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}\b/.test(normalized);
  }

  private static extractTimestampFragments(value: string): string[] {
    if (!value) {
      return [];
    }

    const normalized = this.normalizeInputText(value);
    if (!normalized) {
      return [];
    }

    const patterns = [
      /(?:^|[^0-9])(\d{1,2}:\d{2}\s*(?:\([A-Z]{2,6}\)|[A-Z]{2,6})?\s*[A-Za-z]{3,9}\s+\d{1,2}(?:,\s*\d{2,4})?)/gi,
      /(?:^|[^0-9])((?:[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4}\s+\d{1,2}:\d{2}(?:\s*[AP]M)?(?:\s*[A-Z]{2,6})?))/gi,
      /(?:^|[^0-9])(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}\s+\d{1,2}:\d{2}(?:\s*[AP]M)?(?:\s*[A-Z]{2,6})?)/gi,
      /(?:^|[^0-9])(\d{1,2}:\d{2}\s*(?:[AP]M)?(?:\s*[A-Z]{2,6})?)/gi,
    ];

    const fragments = new Set<string>();
    for (const pattern of patterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(normalized)) !== null) {
        const candidate = this.normalizeInputText(match[1] || '');
        if (candidate && this.looksLikeTimestamp(candidate)) {
          fragments.add(candidate);
        }
      }
    }

    return Array.from(fragments).slice(0, 4);
  }

  private static pickBestTimestamp(candidates: string[]): { text: string; iso?: string } | undefined {
    const unique = Array.from(new Set(candidates.map((value) => this.normalizeInputText(value)).filter(Boolean)));
    let best: { parsed: { text: string; iso?: string }; score: number } | undefined;

    for (const candidate of unique) {
      const parsed = this.parseTimestampCandidate(candidate);
      if (!parsed) {
        continue;
      }
      const score = this.scoreTimestampCandidate(parsed);
      if (!best || score > best.score || (score === best.score && this.isTimestampCandidateMoreRecent(parsed, best.parsed))) {
        best = { parsed, score };
      }
    }

    return best?.parsed;
  }

  private static parseTimestampCandidate(candidate: string): { text: string; iso?: string } | undefined {
    if (!candidate) {
      return undefined;
    }
    const normalized = this.normalizeInputText(candidate);
    if (!normalized || !this.looksLikeTimestamp(normalized)) {
      return undefined;
    }

    const epochMatch = normalized.match(/^\d{10,13}$/);
    if (epochMatch) {
      const epoch = Number(epochMatch[0]);
      const millis = epochMatch[0].length === 13 ? epoch : epoch * 1000;
      const date = new Date(millis);
      if (!Number.isNaN(date.getTime())) {
        return { text: normalized, iso: date.toISOString() };
      }
      return { text: normalized };
    }

    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return { text: normalized, iso: parsed.toISOString() };
    }

    return { text: normalized };
  }

  private static scoreTimestampCandidate(candidate: { text: string; iso?: string }): number {
    const normalized = this.normalizeInputText(candidate.text).toLowerCase();
    let score = 0;

    if (/\b\d{1,2}:\d{2}\b/.test(normalized)) {
      score += 30;
    }
    if (/[+-]\d{2}:?\d{2}\b/.test(normalized) || /\b(?:utc|gmt|ist|pst|pdt|est|edt|cet|cest|bst)\b/.test(normalized)) {
      score += 12;
    }
    if (/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/.test(normalized)) {
      score += 10;
    }
    if (/\b\d{4}\b/.test(normalized)) {
      score += 8;
    }
    if (/\b(?:updated|modified|published|posted)\b/.test(normalized)) {
      score += 6;
    }
    if (normalized.length >= 8 && normalized.length <= 48) {
      score += 4;
    }

    if (candidate.iso) {
      score += 10;
      const parsed = new Date(candidate.iso);
      if (!Number.isNaN(parsed.getTime())) {
        const year = parsed.getUTCFullYear();
        const currentYear = new Date().getUTCFullYear();
        if (year >= currentYear - 2 && year <= currentYear + 1) {
          score += 14;
        } else if (year < currentYear - 10) {
          score -= 18;
        }
        if (year < 1970 || year > currentYear + 2) {
          score -= 20;
        }
      }
    }

    if (normalized.length > 80) {
      score -= 10;
    }

    return score;
  }

  private static isTimestampCandidateMoreRecent(
    candidate: { text: string; iso?: string },
    incumbent: { text: string; iso?: string }
  ): boolean {
    if (candidate.iso && incumbent.iso) {
      const candidateTime = new Date(candidate.iso).getTime();
      const incumbentTime = new Date(incumbent.iso).getTime();
      if (!Number.isNaN(candidateTime) && !Number.isNaN(incumbentTime)) {
        return candidateTime > incumbentTime;
      }
    }
    if (candidate.iso && !incumbent.iso) {
      return true;
    }
    if (!candidate.iso && incumbent.iso) {
      return false;
    }
    return candidate.text.length > incumbent.text.length;
  }

  private static pickBestByline(candidates: string[]): string | undefined {
    const unique = Array.from(new Set(candidates.map((value) => this.normalizeInputText(value)).filter(Boolean)));
    for (const candidate of unique) {
      if (/^(staff|news|editorial)$/i.test(candidate)) {
        continue;
      }
      if (candidate.length < 2 || candidate.length > 80) {
        continue;
      }
      return candidate.replace(/^by\s+/i, '');
    }
    return undefined;
  }

  /**
   * Assess the quality of processed markdown
   */
  private static assessQuality(markdown: string, originalHtml: string, warnings: string[], errors: string[]): number {
    let score = 100;

    // Penalize for errors and warnings
    score -= Math.min(60, errors.length * 20);
    const warningPenalty = warnings.reduce((total, warning) => {
      const normalized = this.normalizeInputText(warning).toLowerCase();
      if (!normalized) {
        return total;
      }
      if (/malicious|xss|dom clobber|injection|invalid|unclosed|mismatched|table malformed|list structure/.test(normalized)) {
        return total + 2;
      }
      if (/failed|fallback|truncated|hidden|invisible|security-only/.test(normalized)) {
        return total + 1;
      }
      return total + 0.25;
    }, 0);
    score -= Math.min(18, Math.round(warningPenalty));

    const sourceTextLength = this.normalizeInputText(extractTextContent(originalHtml)).length;
    const markdownTextLength = this.normalizeInputText(markdown).length;
    const textRetentionRatio = sourceTextLength > 0 ? markdownTextLength / sourceTextLength : 1;

    // Check content preservation using text retention (not raw HTML-size ratio)
    if (markdownTextLength < 120) score -= 30;
    else if (markdownTextLength < 240) score -= 15;
    if (sourceTextLength > 0) {
      if (textRetentionRatio < 0.025) score -= 24;
      else if (textRetentionRatio < 0.05) score -= 12;
      else if (textRetentionRatio > 1.25) score -= 10; // noisy duplication / over-capture
    }

    // Check structure preservation
    const headings = (markdown.match(/^#{1,6}\s/gm) || []).length;
    const originalHeadings = (originalHtml.match(/<h[1-6]/gi) || []).length;
    if (originalHeadings > 0 && headings === 0) score -= 18;
    else if (originalHeadings >= 4 && headings < Math.ceil(originalHeadings * 0.25)) score -= 10;

    // Check for markdown quality
    const rawHtmlTagCount = (
      markdown.match(/<\/?(?:div|span|section|article|main|header|footer|nav|aside|script|style|iframe|svg|path|form|button|input|textarea|select)\b[^>]*>/gi) ||
      []
    ).length;
    if (rawHtmlTagCount > 0) score -= Math.min(12, rawHtmlTagCount);

    const decorativeImageCount = (
      markdown.match(/^!\[[^\]]*]\((?:https?:\/\/)?[^)\s]*(?:framerusercontent\.com|avatars\.githubusercontent\.com|gravatar\.com)[^)]+\)$/gim) ||
      []
    ).length;
    if (decorativeImageCount > 0) score -= Math.min(12, decorativeImageCount * 2);

    if (markdown.match(/\n{4,}/)) score -= 10; // Excessive whitespace
    if (warnings.some(w => /hidden|invisible/i.test(w))) score -= 20;

    // Penalize fragmented low-signal token lines (common in list/avatar chrome leaks)
    const suspiciousTokenLines = markdown.split('\n').filter((line) => {
      const trimmed = line.trim();
      if (!trimmed || /^(>|#|-|\*|\d+\.)/.test(trimmed)) {
        return false;
      }
      if (trimmed.length < 2 || trimmed.length > 24) {
        return false;
      }
      return /^[A-Za-z][A-Za-z-]*$/.test(trimmed);
    }).length;
    if (suspiciousTokenLines >= 12) {
      score -= 12;
    } else if (suspiciousTokenLines >= 6) {
      score -= 6;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate structure preservation score
   */
  private static calculateStructurePreservation(originalHtml: string, processedMarkdown: string): number {
    let score = 100;

    // Check heading preservation
    const originalHeadings = (originalHtml.match(/<h[1-6][^>]*>/gi) || []).length;
    const processedHeadings = (processedMarkdown.match(/^#{1,6}\s/gm) || []).length;

    if (originalHeadings > 0) {
      const headingPreservationRatio = processedHeadings / originalHeadings;
      if (headingPreservationRatio < 0.8) score -= 30;
      else if (headingPreservationRatio < 0.9) score -= 15;
    }

    // Check list preservation
    const originalLists = (originalHtml.match(/<[ou]l[^>]*>/gi) || []).length;
    const processedLists = (processedMarkdown.match(/^[\s]*[-*+]\s|^[\s]*\d+\.\s/gm) || []).length;

    if (originalLists > 0) {
      const listPreservationRatio = processedLists / originalLists;
      if (listPreservationRatio < 0.8) score -= 20;
      else if (listPreservationRatio < 0.9) score -= 10;
    }

    // Check table preservation
    const originalTables = (originalHtml.match(/<table[^>]*>/gi) || []).length;
    const processedTables = (processedMarkdown.match(/\|.*\|/g) || []).length;

    if (originalTables > 0 && processedTables === 0) {
      score -= 25;
    }

    return Math.max(0, score);
  }

  /**
   * Calculate readability score for processed markdown
   */
  private static calculateReadabilityScore(markdown: string): number {
    let score = 100;

    // Penalize excessive HTML content
    const htmlTags = markdown.match(/<[^>]+>/g) || [];
    if (htmlTags.length > 5) score -= htmlTags.length * 2;

    // Check for proper markdown formatting
    const lines = markdown.split('\n');
    let emptyLineCount = 0;
    let consecutiveEmptyLines = 0;
    let maxConsecutiveEmpty = 0;

    for (const line of lines) {
      if (line.trim() === '') {
        emptyLineCount++;
        consecutiveEmptyLines++;
        maxConsecutiveEmpty = Math.max(maxConsecutiveEmpty, consecutiveEmptyLines);
      } else {
        consecutiveEmptyLines = 0;
      }
    }

    // Penalize excessive whitespace
    if (maxConsecutiveEmpty > 3) score -= 15;
    if (emptyLineCount / lines.length > 0.3) score -= 10;

    // Check for balanced markdown elements
    const headings = (markdown.match(/^#{1,6}\s/gm) || []).length;
    const paragraphs = markdown.split(/\n\s*\n/).length;

    if (headings > 0 && paragraphs > 0) {
      const headingToParagraphRatio = headings / Math.min(headings + paragraphs, 10);
      if (headingToParagraphRatio > 0.5) score -= 10; // Too many headings
      else if (headingToParagraphRatio < 0.1) score -= 5; // Too few headings
    }

    return Math.max(0, score);
  }

  /**
   * Generate cache key for processed content using secure hashing
   */
  private static async generateCacheKey(html: string, url: string, config: OfflineModeConfig): Promise<string> {
    // Use full HTML content for secure hashing to prevent collisions
    const contentHash = await this.secureHash(html);
    const configHash = await this.secureHash(JSON.stringify(config));
    return `${url}-${contentHash}-${configHash}`;
  }

  /**
   * Secure hash function using crypto.subtle.digest
   */
  private static async secureHash(str: string): Promise<string> {
    try {
      // Encode the string as UTF-8
      const encoder = new TextEncoder();
      const data = encoder.encode(str);

      // Generate SHA-256 hash
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);

      // Convert to hex string
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Return first 16 characters for cache key (sufficient for collision avoidance)
      return hashHex.substring(0, 16);
    } catch (error) {
      console.warn('[OfflineModeManager] Secure hashing failed, falling back to simple hash:', error);
      // Fallback to simple hash if crypto.subtle is not available
      return this.fallbackHash(str);
    }
  }

  /**
   * Fallback hash function for environments without crypto.subtle
   */
  private static fallbackHash(str: string): string {
    // cyrb53-inspired 53-bit hash to reduce collision risk in degraded environments
    let h1 = 0xdeadbeef ^ str.length;
    let h2 = 0x41c6ce57 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ char, 2654435761);
      h2 = Math.imul(h2 ^ char, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    const combined = 4294967296 * (2097151 & h2) + (h1 >>> 0);
    return combined.toString(36);
  }

  /**
   * Split large content into manageable chunks
   */
  private static splitIntoChunks(html: string, chunkSize: number): string[] {
    const chunks: string[] = [];

    // Fallback: if DOMParser isn't available (e.g., certain test environments), slice by length
    if (typeof DOMParser === 'undefined') {
      return this.splitByBoundaries(html, chunkSize);
    }

    let currentChunk = '';
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const elements = Array.from(doc.body.children);

      for (const element of elements) {
        const elementHtml = element.outerHTML;

        if (currentChunk.length + elementHtml.length > chunkSize && currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = elementHtml;
        } else {
          currentChunk += elementHtml;
        }
      }

      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
      }

      return chunks;
    } catch {
      // Last-resort fallback if parsing fails
      return this.splitByBoundaries(html, chunkSize);
    }
  }

  private static splitByBoundaries(html: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < html.length) {
      const proposedEnd = Math.min(start + chunkSize, html.length);
      const boundary = this.findChunkBoundary(html, start, proposedEnd);
      const end = boundary > start ? boundary : proposedEnd;
      chunks.push(html.slice(start, end));
      start = end;
    }

    return chunks;
  }

  private static findChunkBoundary(html: string, chunkStart: number, proposedEnd: number): number {
    if (proposedEnd >= html.length) {
      return html.length;
    }

    const lookback = Math.min(8000, proposedEnd - chunkStart);
    if (lookback <= 0) {
      return proposedEnd;
    }

    const windowStart = proposedEnd - lookback;
    const window = html.slice(windowStart, proposedEnd);
    const minimumBoundaryOffset = Math.floor(lookback * 0.25);

    const closingTagRegex = /<\/(?:article|section|main|div|p|ul|ol|li|table|thead|tbody|tr|td|th|pre|code|h[1-6])\s*>/gi;
    let match: RegExpExecArray | null;
    let lastClosingTagEnd = -1;
    while ((match = closingTagRegex.exec(window)) !== null) {
      lastClosingTagEnd = match.index + match[0].length;
    }

    if (lastClosingTagEnd > minimumBoundaryOffset) {
      return windowStart + lastClosingTagEnd;
    }

    const gtIndex = window.lastIndexOf('>');
    if (gtIndex > minimumBoundaryOffset) {
      return windowStart + gtIndex + 1;
    }

    const newlineIndex = window.lastIndexOf('\n');
    if (newlineIndex > minimumBoundaryOffset) {
      return windowStart + newlineIndex + 1;
    }

    return proposedEnd;
  }

  /**
   * Combine results from multiple chunks
   */
  private static combineChunkResults(results: OfflineProcessingResult[], title: string, url: string): OfflineProcessingResult {
    const combinedMarkdown = results.map(r => r.markdown).join('\n\n---\n\n');
    const combinedWarnings = results.flatMap(r => r.warnings);
    const combinedErrors = results.flatMap(r => r.errors);
    
    const totalStats = results.reduce((acc, r) => ({
      totalTime: acc.totalTime + r.processingStats.totalTime,
      readabilityTime: acc.readabilityTime + r.processingStats.readabilityTime,
      turndownTime: acc.turndownTime + r.processingStats.turndownTime,
      postProcessingTime: acc.postProcessingTime + r.processingStats.postProcessingTime,
      fallbacksUsed: [...acc.fallbacksUsed, ...r.processingStats.fallbacksUsed],
      qualityScore: Math.min(acc.qualityScore, r.processingStats.qualityScore),
    }), {
      totalTime: 0,
      readabilityTime: 0,
      turndownTime: 0,
      postProcessingTime: 0,
      fallbacksUsed: [] as string[],
      qualityScore: 100,
    });

    return {
      success: results.every(r => r.success),
      markdown: combinedMarkdown,
      metadata: this.generateMetadata(title, url, 'chunked-' + Date.now()),
      processingStats: totalStats,
      warnings: combinedWarnings,
      errors: combinedErrors,
    };
  }

  /**
   * Clear processing cache
   */
  static async clearCache(): Promise<void> {
    try {
      await CacheManager.clear();
      console.log('[OfflineModeManager] Cache cleared');
    } catch (error) {
      console.error('[OfflineModeManager] Failed to clear cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats(): Promise<{ size: number; totalSize: number; oldestEntry: number; newestEntry: number }> {
    try {
      const stats = await CacheManager.getStats();
      return {
        size: stats.totalEntries,
        totalSize: stats.totalSize,
        oldestEntry: stats.oldestEntry,
        newestEntry: stats.newestEntry,
      };
    } catch (error) {
      console.warn('[OfflineModeManager] Failed to get cache stats:', error);
      return { size: 0, totalSize: 0, oldestEntry: 0, newestEntry: 0 };
    }
  }

  /**
   * Clean up expired cache entries
   */
  static async cleanupExpiredCache(): Promise<number> {
    try {
      return await CacheManager.cleanupExpired();
    } catch (error) {
      console.error('[OfflineModeManager] Failed to cleanup expired cache:', error);
      return 0;
    }
  }

  /**
   * Insert cite-first metadata block (and ensure H1 title) at the top of markdown
   * Made public so orchestrators (e.g. background) can enforce canonical citation
   * at final delivery time for all pipeline paths.
   */
  static insertCiteFirstBlock(markdown: string, metadata: ExportMetadata): string {
    let result = markdown || '';

    const title = metadata.title || 'Untitled Page';
    const url = metadata.url || '';
    const captured = this.formatMetadataTimestamp(metadata.capturedAt) || 'Unknown Date';
    const published = metadata.publishedAtText || this.formatMetadataTimestamp(metadata.publishedAt);
    const updated = metadata.updatedAtText || this.formatMetadataTimestamp(metadata.updatedAt);
    const byline = metadata.byline ? this.normalizeInputText(metadata.byline) : '';
    const hash = metadata.selectionHash || 'N/A';

    const citationLines = [
      `> Source: [${title}](${url})`,
      `> Captured: ${captured}`,
    ];
    if (published) {
      citationLines.push(`> Published: ${published}`);
    }
    if (updated) {
      citationLines.push(`> Updated: ${updated}`);
    }
    if (byline) {
      citationLines.push(`> By: ${byline}`);
    }
    citationLines.push(`> Hash: ${hash}`);

    const citationHeader = `${citationLines.join('\n')}\n\n`;

    const hasPrimaryHeading = /^#\s+/m.test(result);
    if (!hasPrimaryHeading) {
      result = `# ${title}\n\n${result.trimStart()}`;
    }

    return citationHeader + result;
  }

  /**
   * Canonicalize markdown before delivery:
   * - removes stale citation headers
   * - sanitizes risky remnants
   * - strips residual UI noise lines
   * - ensures a primary heading exists
   * - inserts canonical cite-first metadata block
   */
  static canonicalizeDeliveredMarkdown(
    markdown: string,
    metadata: ExportMetadata,
    warnings: string[] = []
  ): string {
    const normalizedMetadata: ExportMetadata = {
      title: metadata?.title || 'Untitled Page',
      url: metadata?.url || '',
      capturedAt: metadata?.capturedAt || new Date().toISOString(),
      selectionHash: metadata?.selectionHash || 'N/A',
      publishedAt: metadata?.publishedAt,
      publishedAtText: metadata?.publishedAtText,
      updatedAt: metadata?.updatedAt,
      updatedAtText: metadata?.updatedAtText,
      byline: metadata?.byline,
    };

    let result = this.normalizeUnicodeWhitespace(markdown || '');
    result = this.stripLeadingCitationBlock(result);
    result = this.sanitizeRiskyMarkdown(result, warnings);
    result = this.stripResidualUiNoiseLines(result, warnings);
    result = this.stripUiNoiseCodeBlocks(result, warnings);
    result = this.stripLowSignalMediaArtifacts(result, warnings);
    result = this.stripLeadingNavigationPrelude(result, warnings);
    result = this.normalizeMarkdownSpacing(result);
    result = this.collapseFragmentedWordRuns(result, warnings);
    result = this.normalizeMergedTokenBoundaries(result, warnings);
    result = this.stripTerminalFooterCluster(result, warnings);
    result = this.ensurePrimaryHeading(result, normalizedMetadata.title);

    if (!result || result.trim().length === 0) {
      result = `# ${normalizedMetadata.title}`;
    }

    return this.insertCiteFirstBlock(result, normalizedMetadata);
  }

  private static normalizeMarkdownSpacing(markdown: string): string {
    if (!markdown) {
      return markdown;
    }

    return markdown
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\s+$/gm, '')
      .trim();
  }

  private static formatMetadataTimestamp(value?: string): string {
    if (!value) {
      return '';
    }
    const normalized = this.normalizeInputText(value);
    if (!normalized) {
      return '';
    }
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
    return normalized;
  }

  private static stripLeadingCitationBlock(markdown: string): string {
    if (!markdown) {
      return markdown;
    }

    const lines = markdown.split('\n');
    let index = 0;

    while (index < lines.length && lines[index].trim() === '') {
      index++;
    }

    if (index >= lines.length || !/^>\s*source:/i.test(lines[index])) {
      return markdown;
    }

    index++;
    while (index < lines.length) {
      const line = lines[index];
      if (!/^\s*>/.test(line)) {
        break;
      }
      const text = line.replace(/^\s*>\s?/, '').trim().toLowerCase();
      if (
        !text ||
        text.startsWith('captured:') ||
        text.startsWith('hash:') ||
        text.startsWith('published:') ||
        text.startsWith('updated:') ||
        text.startsWith('by:')
      ) {
        index++;
        continue;
      }
      break;
    }

    while (index < lines.length && lines[index].trim() === '') {
      index++;
    }

    return lines.slice(index).join('\n');
  }

  // =============================================================================
  // Performance Metrics Public API
  // =============================================================================

  /**
   * Get current performance metrics summary
   */
  static getPerformanceMetrics() {
    return this.performance.getMetricsSummary();
  }

  /**
   * Generate comprehensive performance report
   */
  static generatePerformanceReport() {
    return this.performance.generateReport();
  }

  /**
   * Check if performance monitoring overhead is acceptable
   */
  static checkPerformanceOverhead() {
    return this.performance.checkPerformanceOverhead();
  }

  /**
   * Reset performance metrics for new session
   */
  static resetPerformanceMetrics() {
    this.performance.reset();
  }

  /**
   * Get performance session ID
   */
  static getPerformanceSessionId() {
    return this.performance.getSessionId();
  }

  /**
   * Get cache statistics with performance tracking
   */
  static async getEnhancedCacheStats(): Promise<{
    size: number;
    totalSize: number;
    oldestEntry: number;
    newestEntry: number;
    hitRate: number;
    averageRetrievalTime: number;
    performanceGrade: string;
  }> {
    const basicStats = await this.getCacheStats();
    const performanceMetrics = this.performance.getCacheMetrics();

    // Calculate performance grade
    let performanceGrade = 'A';
    if (performanceMetrics.hitRate < 0.3 || performanceMetrics.averageRetrievalTime > 100) {
      performanceGrade = 'D';
    } else if (performanceMetrics.hitRate < 0.5 || performanceMetrics.averageRetrievalTime > 50) {
      performanceGrade = 'C';
    } else if (performanceMetrics.hitRate < 0.7 || performanceMetrics.averageRetrievalTime > 25) {
      performanceGrade = 'B';
    }

    return {
      ...basicStats,
      ...performanceMetrics,
      performanceGrade
    };
  }

  /**
   * Analyze processing performance trends
   */
  static getProcessingTrends() {
    const report = this.performance.generateReport();

    return {
      pipelineEfficiency: report.pipelinePerformance,
      bottlenecks: this.identifyBottlenecks(report),
      optimizationOpportunities: report.recommendations,
      memoryHealth: report.memoryEfficiency,
      qualityTrends: report.qualityAssessment
    };
  }

  /**
   * Identify performance bottlenecks
   */
  private static identifyBottlenecks(report: any): string[] {
    const bottlenecks: string[] = [];

    // Check pipeline stages
    const { readability, turndown, postProcessing } = report.pipelinePerformance;

    if (readability.avg > 500) {
      bottlenecks.push('Readability extraction is slow (>500ms average)');
    }

    if (turndown.avg > 300) {
      bottlenecks.push('Turndown conversion is slow (>300ms average)');
    }

    if (postProcessing.avg > 200) {
      bottlenecks.push('Post-processing is slow (>200ms average)');
    }

    // Check memory
    if (report.memoryEfficiency.peakUsage > 85) {
      bottlenecks.push('High memory usage detected (>85% of heap)');
    }

    if (report.memoryEfficiency.leakDetection) {
      bottlenecks.push('Potential memory leak detected');
    }

    return bottlenecks;
  }

  // =============================================================================
  // Real-Time Performance Tracking Methods
  // =============================================================================

  /**
   * Generate unique session ID for tracking
   */
  private static generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Update session metrics with real-time data
   */
  private static updateSessionMetrics(sessionId: string, metrics: {
    totalTime: number;
    qualityScore: number;
    warningsCount: number;
    errorsCount: number;
    markdownLength: number;
  }): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      // Store session metrics for real-time access
      this.activeSessions.set(sessionId, {
        ...session,
        ...metrics,
        lastUpdate: Date.now()
      });
      this.pruneSessionStore();
    }
  }

  private static completeSession(
    sessionId: string,
    status: 'completed' | 'failed' | 'cached',
    metrics?: {
      totalTime?: number;
      qualityScore?: number;
      warningsCount?: number;
      errorsCount?: number;
      markdownLength?: number;
    }
  ): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return;
    }

    const now = Date.now();
    this.activeSessions.set(sessionId, {
      ...session,
      ...metrics,
      status,
      endTime: now,
      lastUpdate: now,
    });
    this.pruneSessionStore();
  }

  private static pruneSessionStore(): void {
    const now = Date.now();

    // Evict stale non-active sessions after TTL
    for (const [id, session] of this.activeSessions.entries()) {
      if (session.status !== 'active' && session.endTime && (now - session.endTime) > this.SESSION_TTL_MS) {
        this.activeSessions.delete(id);
      }
    }

    // Keep bounded history to avoid unbounded growth in long-running workers
    if (this.activeSessions.size > this.MAX_SESSION_HISTORY) {
      const overflow = this.activeSessions.size - this.MAX_SESSION_HISTORY;
      const prunable = Array.from(this.activeSessions.entries())
        .filter(([, session]) => session.status !== 'active')
        .sort((a, b) => (a[1].endTime || a[1].lastUpdate || a[1].startTime) - (b[1].endTime || b[1].lastUpdate || b[1].startTime));

      for (let i = 0; i < Math.min(overflow, prunable.length); i++) {
        this.activeSessions.delete(prunable[i][0]);
      }

      // Fallback hard cap if still above limit
      if (this.activeSessions.size > this.MAX_SESSION_HISTORY) {
        const oldestFirst = Array.from(this.activeSessions.entries())
          .sort((a, b) => (a[1].lastUpdate || a[1].startTime) - (b[1].lastUpdate || b[1].startTime));
        while (this.activeSessions.size > this.MAX_SESSION_HISTORY && oldestFirst.length > 0) {
          const [id] = oldestFirst.shift()!;
          this.activeSessions.delete(id);
        }
      }
    }
  }

  /**
   * Get current active session metrics
   */
  static getCurrentSessionMetrics(): {
    activeSessions: number;
    averageProcessingTime: number;
    averageQualityScore: number;
    totalProcessedContent: number;
    recentSessions: Array<{
      id: string;
      duration: number;
      qualityScore: number;
      status: 'completed' | 'failed' | 'active';
    }>;
  } {
    this.pruneSessionStore();
    const sessions = Array.from(this.activeSessions.values());
    const activeSessions = sessions.filter(s => s.status === 'active');

    const averageProcessingTime = sessions.length > 0
      ? sessions.reduce((sum, s) => sum + (s.totalTime || (s.lastUpdate ? s.lastUpdate - s.startTime : 0)), 0) / sessions.length
      : 0;

    const averageQualityScore = sessions.length > 0
      ? sessions.reduce((sum, s) => sum + (s.qualityScore || 0), 0) / sessions.length
      : 0;

    const totalProcessedContent = sessions.reduce((sum, s) => sum + (s.markdownLength || 0), 0);

    const recentSessions = sessions.slice(-10).map((s, index) => ({
      id: `session_${index}`,
      duration: s.totalTime || (s.lastUpdate ? s.lastUpdate - s.startTime : 0),
      qualityScore: s.qualityScore || 0,
      status: (s.status === 'failed' ? 'failed' : s.status === 'active' ? 'active' : 'completed') as 'completed' | 'failed' | 'active'
    }));

    return {
      activeSessions: activeSessions.length,
      averageProcessingTime,
      averageQualityScore,
      totalProcessedContent,
      recentSessions
    };
  }

  /**
   * Get real-time performance stream for monitoring
   */
  static async getRealTimeMetrics(): Promise<{
    timestamp: number;
    activeProcessingSessions: number;
    currentMemoryUsage?: number;
    cachePerformance: any;
    processingTrends: any;
    systemHealth: 'optimal' | 'warning' | 'critical';
    recommendations: string[];
  }> {
    const sessionMetrics = this.getCurrentSessionMetrics();
    const cacheMetrics = this.performance.getCacheMetrics();
    const memoryEfficiency = this.performance.getMemoryEfficiency();

    // Determine system health
    let systemHealth: 'optimal' | 'warning' | 'critical' = 'optimal';
    const recommendations: string[] = [];

    if (sessionMetrics.averageProcessingTime > 1000) {
      systemHealth = 'critical';
      recommendations.push('Processing times are exceeding 1 second - optimization needed');
    } else if (sessionMetrics.averageProcessingTime > 500) {
      systemHealth = 'warning';
      recommendations.push('Processing times are elevated - monitor closely');
    }

    if (cacheMetrics.hitRate < 60) {
      systemHealth = systemHealth === 'critical' ? 'critical' : 'warning';
      recommendations.push('Cache hit rate below 60% - review cache strategy');
    }

    if (memoryEfficiency.leakDetection) {
      systemHealth = 'critical';
      recommendations.push('Memory leak detected - immediate investigation required');
    }

    return {
      timestamp: Date.now(),
      activeProcessingSessions: sessionMetrics.activeSessions,
      currentMemoryUsage: memoryEfficiency.currentUsage,
      cachePerformance: cacheMetrics,
      processingTrends: sessionMetrics,
      systemHealth,
      recommendations
    };
  }

  /**
   * Start real-time metrics monitoring (call from background script)
   */
  static startRealTimeMonitoring(): {
    stop: () => void;
    getMetrics: () => Promise<any>;
  } {
    const startMonitoring = () => {
      console.log('[OfflineModeManager] Starting real-time performance monitoring');
      if (this.monitoringIntervalHandle) {
        clearInterval(this.monitoringIntervalHandle);
        this.monitoringIntervalHandle = null;
      }

      this.monitoringIntervalHandle = setInterval(async () => {
        try {
          const metrics = await this.getRealTimeMetrics();

          // Broadcast to extension components for dashboard updates
          if (typeof browser !== 'undefined' && browser.runtime) {
            browser.runtime.sendMessage({
              type: 'PERFORMANCE_METRICS_UPDATE',
              payload: metrics
            }).catch(() => {
              // Silently ignore if no receivers
            });
          }

          // Log significant events
          if (metrics.systemHealth === 'critical') {
            console.warn('[OfflineModeManager] Critical performance issue detected:', metrics.recommendations);
          }
        } catch (error) {
          console.error('[OfflineModeManager] Real-time monitoring error:', error);
        }
      }, this.METRICS_UPDATE_INTERVAL);
    };

    const stopMonitoring = () => {
      if (this.monitoringIntervalHandle) {
        clearInterval(this.monitoringIntervalHandle);
        this.monitoringIntervalHandle = null;
        console.log('[OfflineModeManager] Real-time monitoring stopped');
      }
    };

    const getMetrics = async () => {
      return await this.getRealTimeMetrics();
    };

    // Auto-start monitoring
    startMonitoring();

    return { stop: stopMonitoring, getMetrics };
  }

  /**
   * Get performance analytics for dashboard
   */
  static async getPerformanceAnalytics(): Promise<{
    overview: {
      totalSessions: number;
      averageProcessingTime: number;
      averageQualityScore: number;
      successRate: number;
    };
    timeline: Array<{
      timestamp: number;
      processingTime: number;
      qualityScore: number;
      sessionType: string;
    }>;
    cacheAnalytics: {
      hitRate: number;
      totalRequests: number;
      averageRetrievalTime: number;
    };
    systemHealth: {
      status: 'optimal' | 'warning' | 'critical';
      issues: string[];
    };
    recommendations: string[];
  }> {
    this.pruneSessionStore();
    const sessionMetrics = this.getCurrentSessionMetrics();
    const cacheMetrics = this.performance.getCacheMetrics();
    const performanceReport = this.performance.generateReport();

    // Calculate success rate
    const totalSessions = this.activeSessions.size;
    const successfulSessions = Array.from(this.activeSessions.values()).filter(s => s.qualityScore && s.qualityScore > 50).length;
    const successRate = totalSessions > 0 ? (successfulSessions / totalSessions) * 100 : 0;

    // Generate timeline data
    const timeline = Array.from(this.activeSessions.entries()).slice(-20).map(([, session]) => ({
      timestamp: session.startTime,
      processingTime: session.totalTime || (session.lastUpdate ? session.lastUpdate - session.startTime : 0),
      qualityScore: session.qualityScore || 0,
      sessionType: session.config.readabilityPreset || 'standard'
    }));

    // System health analysis
    const systemHealth: {
      status: 'optimal' | 'warning' | 'critical';
      issues: string[];
    } = {
      status: performanceReport.recommendations.length > 3 ? 'critical' :
                performanceReport.recommendations.length > 1 ? 'warning' : 'optimal',
      issues: performanceReport.recommendations
    };

    return {
      overview: {
        totalSessions,
        averageProcessingTime: sessionMetrics.averageProcessingTime,
        averageQualityScore: sessionMetrics.averageQualityScore,
        successRate
      },
      timeline,
      cacheAnalytics: cacheMetrics,
      systemHealth,
      recommendations: performanceReport.recommendations
    };
  }
}
