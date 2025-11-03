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

  // Real-time metrics tracking
  private static activeSessions = new Map<string, {
    startTime: number;
    htmlLength: number;
    config: OfflineModeConfig;
    lastUpdate?: number;
    qualityScore?: number;
    markdownLength?: number;
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
    const startTime = Date.now();
    const config = { ...this.DEFAULT_CONFIG, ...customConfig };
    const warnings: string[] = [];
    const errors: string[] = [];
    let fallbacksUsed: string[] = [];

    // Initialize real-time tracking
    const sessionId = this.generateSessionId();
    this.activeSessions.set(sessionId, {
      startTime,
      htmlLength: html.length,
      config
    });

    // Initialize performance tracking
    this.performance.captureMemorySnapshot('processing_start');
    this.performance.recordProcessingSnapshot('processing_start');

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
          console.log('[OfflineModeManager] Returning cached result');
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

      // Step 1: Content extraction with Readability
      this.performance.captureMemorySnapshot('readability_start');
      this.performance.recordProcessingSnapshot('readability_start');
      const readabilityTimerId = this.performance.recordExtractionStart();
      let extractedContent: string;
      let readabilityUsed = false;

      try {
        const readabilityConfig = config.readabilityPreset 
          ? ReadabilityConfigManager.getPresetConfig(config.readabilityPreset)
          : ReadabilityConfigManager.getConfigForUrl(url);

        if (readabilityConfig) {
          const doc = safeParseHTML(html);
          if (!doc) {
            throw new Error('Failed to parse HTML for Readability processing');
          }
          const { result: extractionResult, duration: readabilityDuration } = await this.performance.measureAsyncOperation(
            'readability_extraction',
            () => ReadabilityConfigManager.extractContent(doc, url, readabilityConfig)
          );
          extractedContent = extractionResult.content;
          readabilityUsed = true;
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

      // Step 2: HTML to Markdown conversion
      this.performance.captureMemorySnapshot('turndown_start');
      this.performance.recordProcessingSnapshot('turndown_start');
      let markdown: string;

      const turndownTimerId = this.performance.recordExtractionStart();

      try {
        const { TurndownConfigManager } = await import('./turndown-config.js');
        const { result: turndownResult, duration: turndownDuration } = await this.performance.measureAsyncOperation(
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
      this.updateSessionMetrics(sessionId, {
        totalTime,
        qualityScore,
        warningsCount: warnings.length,
        errorsCount: errors.length,
        markdownLength: processedMarkdown.length
      });

      console.log(`[OfflineModeManager] Processing completed in ${totalTime.toFixed(2)}ms`);
      return result;

        } catch (error) {
      console.error('[OfflineModeManager] Processing failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);

      // Record failure metrics
      this.performance.recordExtractionFailure();
      this.performance.captureMemorySnapshot('processing_error');

      const totalTime = performance.now() - startTime;

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

      return {
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
    }
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
  
    // Try semantic elements first
    const semanticContent = extractSemanticContent(doc, 500);
    if (semanticContent) {
      return semanticContent;
    }
  
    // Try ScoringEngine to find best content element
    try {
      const { ScoringEngine } = await import('./scoring/scoring-engine.js');
      const { bestCandidate } = ScoringEngine.findBestCandidate(doc.body);
      if (bestCandidate && bestCandidate.element) {
        console.log(`[OfflineModeManager] Using ScoringEngine result with score: ${bestCandidate.score}`);
        const pruned = ScoringEngine.pruneNode(bestCandidate.element);
        return pruned.innerHTML;
      }
    } catch (error) {
      console.warn('[OfflineModeManager] ScoringEngine fallback failed:', error);
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
    score -= warnings.length * 5;

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
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Split large content into manageable chunks
   */
  private static splitIntoChunks(html: string, chunkSize: number): string[] {
    const chunks: string[] = [];

    // Fallback: if DOMParser isn't available (e.g., certain test environments), slice by length
    if (typeof DOMParser === 'undefined') {
      for (let i = 0; i < html.length; i += chunkSize) {
        chunks.push(html.slice(i, i + chunkSize));
      }
      return chunks;
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
    } catch (e) {
      // Last-resort fallback if parsing fails
      for (let i = 0; i < html.length; i += chunkSize) {
        chunks.push(html.slice(i, i + chunkSize));
      }
      return chunks;
    }
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
    const date = metadata.capturedAt ? new Date(metadata.capturedAt).toLocaleDateString() : 'Unknown Date';

    const citationFooter = `\n\n---\n*Cleaned from: [${title}](${url}) on ${date}*`;

    return result + citationFooter;
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
    const sessions = Array.from(this.activeSessions.values());
    const activeSessions = sessions.filter(s => !s.lastUpdate || (Date.now() - s.lastUpdate) < 30000); // Active within 30s

    const averageProcessingTime = sessions.length > 0
      ? sessions.reduce((sum, s) => sum + (s.lastUpdate ? s.lastUpdate - s.startTime : 0), 0) / sessions.length
      : 0;

    const averageQualityScore = sessions.length > 0
      ? sessions.reduce((sum, s) => sum + (s.qualityScore || 0), 0) / sessions.length
      : 0;

    const totalProcessedContent = sessions.reduce((sum, s) => sum + (s.markdownLength || 0), 0);

    const recentSessions = sessions.slice(-10).map((s, index) => ({
      id: `session_${index}`,
      duration: s.lastUpdate ? s.lastUpdate - s.startTime : 0,
      qualityScore: s.qualityScore || 0,
      status: (s.lastUpdate ? 'completed' : 'active') as 'completed' | 'failed' | 'active'
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
    let monitoringInterval: NodeJS.Timeout;

    const startMonitoring = () => {
      console.log('[OfflineModeManager] Starting real-time performance monitoring');

      monitoringInterval = setInterval(async () => {
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
      if (monitoringInterval) {
        clearInterval(monitoringInterval);
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
    const sessionMetrics = this.getCurrentSessionMetrics();
    const cacheMetrics = this.performance.getCacheMetrics();
    const performanceReport = this.performance.generateReport();

    // Calculate success rate
    const totalSessions = this.activeSessions.size;
    const successfulSessions = Array.from(this.activeSessions.values()).filter(s => s.qualityScore && s.qualityScore > 50).length;
    const successRate = totalSessions > 0 ? (successfulSessions / totalSessions) * 100 : 0;

    // Generate timeline data
    const timeline = Array.from(this.activeSessions.entries()).slice(-20).map(([id, session]) => ({
      timestamp: session.startTime,
      processingTime: session.lastUpdate ? session.lastUpdate - session.startTime : 0,
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
