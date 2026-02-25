// Offline Mode Manager - orchestrates the complete offline processing workflow
// Integrates with the simplified popup UI and processing pipeline

import { ReadabilityConfigManager } from './readability-config.js';
import { MarkdownPostProcessor } from './post-processor.js';
import { Storage } from '../lib/storage.js';
import { ExportMetadata } from '../lib/types.js';
import { CacheManager } from '../lib/cache-manager.js';
import { PerformanceMetrics } from './performance-metrics.js';
import { safeParseHTML, extractSemanticContent, removeUnwantedElements, extractTextContent } from '../lib/dom-utils.js';

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

  /**
   * Main offline processing entry point
   */
  static async processContent(
    html: string,
    url: string,
    title: string,
    customConfig?: Partial<OfflineModeConfig>
  ): Promise<OfflineProcessingResult> {
    const config = { ...this.DEFAULT_CONFIG, ...customConfig };
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
        const cacheKey = await this.generateCacheKey(html, url, config);

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
          const doc = safeParseHTML(html);
          if (!doc) {
            throw new Error('Failed to parse HTML for Readability processing');
          }
          const { result: extractionResult } = await this.performance.measureAsyncOperation(
            'readability_extraction',
            () => ReadabilityConfigManager.extractContent(doc, url, readabilityConfig)
          );
          extractedContent = extractionResult.content;
          if (config.fallbacks.enableReadabilityFallback && this.shouldFallbackForCoverage(extractedContent, html)) {
            const fallbackCandidate = await this.fallbackContentExtraction(html);
            if (this.shouldAdoptFallbackCandidate(html, extractedContent, fallbackCandidate)) {
              extractedContent = fallbackCandidate;
              fallbacksUsed.push('readability-low-coverage-fallback');
              warnings.push('Readability extraction coverage low; used fallback content extraction');
            } else {
              warnings.push('Readability extraction coverage low; retained readability candidate after quality check');
            }
          }
          console.log('[OfflineModeManager] Readability extraction successful');
        } else {
          throw new Error('No suitable Readability configuration found');
        }
      } catch (error) {
        console.warn('[OfflineModeManager] Readability extraction failed:', error);
        if (config.fallbacks.enableReadabilityFallback) {
          extractedContent = await this.fallbackContentExtraction(html);
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
          const { TurndownConfigManager } = await import('./turndown-config.js');
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
      const selectionHash = await this.generateCacheKey(html, url, config);
      const metadata = this.generateMetadata(title, url, selectionHash);
      processedMarkdown = this.normalizeUnicodeWhitespace(processedMarkdown);
      processedMarkdown = this.sanitizeRiskyMarkdown(processedMarkdown, warnings);
      if (!processedMarkdown || processedMarkdown.trim().length === 0) {
        const sparseFallback = this.buildSparseContentFallback(html, warnings);
        if (sparseFallback) {
          processedMarkdown = sparseFallback;
          warnings.push('Used sparse content fallback');
        } else {
          throw new Error('No HTML content provided');
        }
      }
      processedMarkdown = this.insertCiteFirstBlock(processedMarkdown, metadata);

      // Step 5: Quality assessment
      const qualityScore = this.assessQuality(processedMarkdown, html, warnings, errors);

      const totalTime = Date.now() - startTime;

      // Record comprehensive extraction metrics
      const extractionMetrics = this.performance.recordExtractionComplete(
        readabilityTime,
        turndownTime,
        postProcessingTime,
        html.length,
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
        contentLength: html.length,
        contentQuality: qualityScore,
        charThreshold: html.length > config.performance.maxContentLength ? 'truncated' : 'within_limit',
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
        const cacheKey = await this.generateCacheKey(html, url, config);
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
    const preferred = doc.querySelector(
      'main, article, [role="main"], #content, .content, .main-content'
    ) as HTMLElement | null;
    return preferred ?? (doc.body as HTMLElement);
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
      return linkDensity <= 0.5;
    }).length;
  }

  private static containsUiNoiseSignals(text: string): boolean {
    return /(subscribe|newsletter|related links|accept all .*cookie|cookie settings|join waitlist|sign up)/i.test(text);
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

    if (fallbackAnalysis.textLength < Math.min(200, readabilityAnalysis.textLength * 0.55)) {
      return false;
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

    return false;
  }

  private static analyzeExtractionCandidate(
    originalHtml: string,
    candidateHtml: string
  ): {
    textLength: number;
    headingCoverage: number;
    sectionCount: number;
    hasNoiseSignals: boolean;
    leadHeadingPresent: boolean;
  } {
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
    const baseConfig = { ...this.DEFAULT_CONFIG };

    // Reddit-specific configuration
    if (url.includes('reddit.com')) {
      baseConfig.readabilityPreset = 'reddit-post';
      baseConfig.turndownPreset = 'standard';
      baseConfig.postProcessing = {
        ...baseConfig.postProcessing,
        addTableOfContents: false,
        optimizeForPlatform: 'standard',
      };
      console.log('[OfflineModeManager] Using Reddit-specific configuration');
    }
    // GitHub configuration
    else if (url.includes('github.com') || url.includes('docs.') || url.includes('api.')) {
      baseConfig.readabilityPreset = 'technical-documentation';
      baseConfig.turndownPreset = 'github';
      baseConfig.postProcessing.optimizeForPlatform = 'github';
    } else if (url.includes('blog') || url.includes('medium.com') || url.includes('substack.com')) {
      baseConfig.readabilityPreset = 'blog-article';
      baseConfig.turndownPreset = 'standard';
      baseConfig.postProcessing.addTableOfContents = true;
    } else if (url.includes('wikipedia.org') || url.includes('wiki')) {
      baseConfig.readabilityPreset = 'wiki-content';
      baseConfig.turndownPreset = 'standard';
      baseConfig.postProcessing.addTableOfContents = true;
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
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    
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

  /**
   * Fallback content extraction when Readability fails
   * Now uses ScoringEngine for better heuristic-based selection
   */
  private static async fallbackContentExtraction(html: string): Promise<string> {
    const doc = safeParseHTML(html);
    if (!doc) {
      return html;
    }
  
    // For npm pages, look for README specifically
    if (doc.querySelector('[data-testid="readme"]')) {
      const readme = doc.querySelector('[data-testid="readme"]');
      if (readme) {
        return readme.innerHTML;
      }
    }
  
    // Try ScoringEngine first for better boilerplate pruning
    try {
      const { ScoringEngine } = await import('./scoring/scoring-engine.js');
      const body = doc.body as HTMLElement | null;
      if (body) {
        const { bestCandidate } = ScoringEngine.findBestCandidate(body);
        if (bestCandidate && bestCandidate.element && bestCandidate.score > 0) {
          console.log(`[OfflineModeManager] Using ScoringEngine result with score: ${bestCandidate.score}`);
          const selectedContainer = this.expandScoringCandidate(bestCandidate.element, body);
          const pruned = ScoringEngine.pruneNode(selectedContainer);
          if (this.normalizeInputText(extractTextContent(pruned.innerHTML)).length === 0) {
            return selectedContainer.innerHTML;
          }
          return pruned.innerHTML;
        }
      }
    } catch (error) {
      console.warn('[OfflineModeManager] ScoringEngine fallback failed:', error);
    }

    // Try semantic extraction after heuristic scoring
    const semanticContent = extractSemanticContent(doc, 500);
    if (semanticContent) {
      return semanticContent;
    }
  
    // Final fallback to body
    const body = doc.body;
    if (body) {
      removeUnwantedElements(body, [
        '.ad', 
        '.advertisement',
        'nav',
        'header',
        'footer',
        '[role="navigation"]',
        '[role="banner"]',
        '[role="contentinfo"]'
      ]);
      return body.innerHTML;
    }
  
    return html;
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
      const role = (current.getAttribute('role') || '').toLowerCase();
      const isPrimaryContainer =
        current.tagName.toLowerCase() === 'main' ||
        current.tagName.toLowerCase() === 'article' ||
        role === 'main';

      const expandsMeaningfully = currentTextLength >= selectedTextLength * 1.5;
      const gainsStructure = headingCount >= 2 || sectionCount >= 2;
      const withinReasonableBounds = isPrimaryContainer
        ? currentTextLength <= bodyTextLength * 1.02
        : currentTextLength <= bodyTextLength * 0.95;
      const acceptableDensity = isPrimaryContainer ? linkDensity <= 0.55 : linkDensity <= 0.42;

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
  private static generateMetadata(title: string, url: string, selectionHash: string): ExportMetadata {
    return {
      title: title || 'Untitled',
      url,
      capturedAt: new Date().toISOString(),
      selectionHash,
    };
  }

  /**
   * Assess the quality of processed markdown
   */
  private static assessQuality(markdown: string, originalHtml: string, warnings: string[], errors: string[]): number {
    let score = 100;

    // Penalize for errors and warnings
    score -= errors.length * 20;
    score -= warnings.length * 3;

    // Check content preservation
    const reductionRatio = markdown.length / originalHtml.length;
    if (reductionRatio < 0.1) score -= 30;
    else if (reductionRatio < 0.3) score -= 15;

    // Check structure preservation
    const headings = (markdown.match(/^#{1,6}\s/gm) || []).length;
    const originalHeadings = (originalHtml.match(/<h[1-6]/gi) || []).length;
    if (headings < originalHeadings * 0.5) score -= 20;

    // Check for markdown quality
    if (markdown.includes('<') && markdown.includes('>')) score -= 15; // HTML tags present
    if (markdown.match(/\n{4,}/)) score -= 10; // Excessive whitespace
    if (warnings.some(w => /hidden|invisible/i.test(w))) score -= 20;

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
    const captured = metadata.capturedAt ? new Date(metadata.capturedAt).toISOString() : 'Unknown Date';
    const hash = metadata.selectionHash || 'N/A';

    const citationHeader = `> Source: [${title}](${url})\n> Captured: ${captured}\n> Hash: ${hash}\n\n`;

    return citationHeader + result;
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
