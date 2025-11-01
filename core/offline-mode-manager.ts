// Offline Mode Manager - orchestrates the complete offline processing workflow
// Integrates with the simplified popup UI and processing pipeline

import { ReadabilityConfigManager } from './readability-config.js';
import { TurndownConfigManager } from './turndown-config.js';
import { MarkdownPostProcessor } from './post-processor.js';
import { Storage } from '../lib/storage.js';
import { ExportMetadata } from '../lib/types.js';
import { CacheManager } from '../lib/cache-manager.js';
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
    const startTime = performance.now();
    const config = { ...this.DEFAULT_CONFIG, ...customConfig };
    const warnings: string[] = [];
    const errors: string[] = [];
    let fallbacksUsed: string[] = [];

    try {
      console.log('[OfflineModeManager] Starting offline processing...');

      // Check cache first
      if (config.performance.enableCaching) {
        const cacheKey = await this.generateCacheKey(html, url, config);
        const cached = await CacheManager.get(cacheKey);
        if (cached) {
          console.log('[OfflineModeManager] Returning cached result');
          return cached;
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
      const readabilityStart = performance.now();
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
          const result = await ReadabilityConfigManager.extractContent(doc, url, readabilityConfig);
          extractedContent = result.content;
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

      const readabilityTime = performance.now() - readabilityStart;

      // Step 2: HTML to Markdown conversion
      const turndownStart = performance.now();
      let markdown: string;

      try {
        markdown = await TurndownConfigManager.convert(extractedContent, config.turndownPreset);
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

      const turndownTime = performance.now() - turndownStart;

      // Step 3: Post-processing
      const postProcessingStart = performance.now();
      let processedMarkdown = markdown;

      if (config.postProcessing.enabled) {
        try {
          const postProcessingOptions = this.getPostProcessingOptions(config);
          const result = MarkdownPostProcessor.process(processedMarkdown, postProcessingOptions);
          processedMarkdown = result.markdown;
          warnings.push(...result.warnings);
          console.log(`[OfflineModeManager] Post-processing completed with ${result.improvements.length} improvements`);
        } catch (error) {
          console.warn('[OfflineModeManager] Post-processing failed:', error);
          warnings.push('Post-processing failed, using raw markdown');
        }
      }

      const postProcessingTime = performance.now() - postProcessingStart;

      // Step 4: Generate metadata and insert cite-first block
      const selectionHash = await this.generateCacheKey(html, url, config);
      const metadata = this.generateMetadata(title, url, selectionHash);
      processedMarkdown = this.insertCiteFirstBlock(processedMarkdown, metadata);

      // Step 5: Quality assessment
      const qualityScore = this.assessQuality(processedMarkdown, html, warnings, errors);

      const totalTime = performance.now() - startTime;

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

      console.log(`[OfflineModeManager] Processing completed in ${totalTime.toFixed(2)}ms`);
      return result;

    } catch (error) {
      console.error('[OfflineModeManager] Processing failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);

      return {
        success: false,
        markdown: '',
        metadata: this.generateMetadata(title, url, 'error-' + Date.now()),
        processingStats: {
          totalTime: performance.now() - startTime,
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

    // Detect content type and adjust configuration
    if (url.includes('github.com') || url.includes('docs.') || url.includes('api.')) {
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
   */
  private static async fallbackContentExtraction(html: string): Promise<string> {
    const doc = safeParseHTML(html);
    if (!doc) {
      return html; // Return original HTML if parsing fails
    }

    // Try semantic elements first using centralized utility
    const semanticContent = extractSemanticContent(doc, 500);
    if (semanticContent) {
      return semanticContent;
    }

    // Fallback to body content with basic cleaning
    const body = doc.body;
    if (body) {
      // Remove obvious noise using centralized utility
      removeUnwantedElements(body, ['.ad', '.advertisement']);
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
}
