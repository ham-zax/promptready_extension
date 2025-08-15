// Enhanced offscreen processor integrating the new offline capabilities
// Replaces the existing offscreen processing with optimized pipeline

import { browser } from 'wxt/browser';
import { OfflineModeManager, OfflineModeConfig } from '../../core/offline-mode-manager.js';
import { ReadabilityConfigManager } from '../../core/readability-config.js';
import { TurndownConfigManager } from '../../core/turndown-config.js';
import { MarkdownPostProcessor } from '../../core/post-processor.js';
import { BoilerplateFilter, AGGRESSIVE_FILTER_RULES } from '../../core/filters/boilerplate-filters';
import { ScoringEngine } from '../../core/scoring/scoring-engine';
import DOMPurify from 'dompurify';

interface ProcessingMessage {
  type: 'ENHANCED_OFFSCREEN_PROCESS';
  payload: {
    html: string;
    url: string;
    title: string;
    selectionHash: string;
    mode: 'offline' | 'ai';
    useReadability?: boolean;
    renderer?: 'turndown' | 'structurer';
    customConfig?: Partial<OfflineModeConfig>;
    settings?: any; // Pass settings from background to avoid storage access issues
  };
}

interface ProcessingProgressMessage {
  type: 'PROCESSING_PROGRESS';
  payload: {
    message: string;
    progress: number;
    stage: string;
  };
}

interface ProcessingCompleteMessage {
  type: 'PROCESSING_COMPLETE';
  payload: {
    exportMd: string;
    exportJson: any;
    metadata: any;
    stats: any;
    warnings: string[];
    originalHtml: string; // Include original HTML for quality validation
  };
}

interface ProcessingErrorMessage {
  type: 'PROCESSING_ERROR';
  payload: {
    error: string;
    stage: string;
    fallbackUsed?: boolean;
  };
}

export class EnhancedOffscreenProcessor {
  private static instance: EnhancedOffscreenProcessor | null = null;
  private isProcessing = false;

  static getInstance(): EnhancedOffscreenProcessor {
    if (!this.instance) {
      this.instance = new EnhancedOffscreenProcessor();
    }
    return this.instance;
  }

  constructor() {
    this.setupMessageListener();
  }

  private setupMessageListener(): void {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'ENHANCED_OFFSCREEN_PROCESS') {
        this.handleProcessingRequest(message as ProcessingMessage)
          .then(result => sendResponse({ success: true, data: result }))
          .catch(error => sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }));
        return true; // Keep message channel open for async response
      }

      // Return false for unhandled messages
      return false;
    });
  }

  private async handleProcessingRequest(message: ProcessingMessage): Promise<ProcessingCompleteMessage['payload']> {
    if (this.isProcessing) {
      throw new Error('Another processing operation is already in progress');
    }

    this.isProcessing = true;

    try {
      const { html, url, title, mode, customConfig, settings } = message.payload;

      console.log('[EnhancedOffscreenProcessor] Starting enhanced processing...');
      this.sendProgress('Processing content...', 10, 'initialization');

      // Validate inputs
      if (!html || html.trim().length === 0) {
        throw new Error('No HTML content provided');
      }

      // Get optimal configuration for the URL (pass settings to avoid storage access)
      const optimalConfig = await OfflineModeManager.getOptimalConfig(url, settings);
      const finalConfig = { ...optimalConfig, ...customConfig };

      console.log('[EnhancedOffscreenProcessor] Using configuration:', finalConfig);

      // Process based on mode
      if (mode === 'offline') {
        return await this.processOfflineMode(html, url, title, finalConfig);
      } else {
        // AI mode processing (placeholder for future implementation)
        return await this.processAIMode(html, url, title, finalConfig);
      }

    } catch (error) {
      console.error('[EnhancedOffscreenProcessor] Processing failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
      throw new Error(errorMessage);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processOfflineMode(
    html: string,
    url: string,
    title: string,
    config: OfflineModeConfig
  ): Promise<ProcessingCompleteMessage['payload']> {
    try {
      this.sendProgress('Extracting content...', 30, 'extraction');

      // Sanitize incoming HTML with DOMPurify first to remove script/style and other unsafe nodes.
      let doc: Document;
      try {
        const sanitizedHtml = DOMPurify.sanitize(html);
        const parser = new DOMParser();
        doc = parser.parseFromString(sanitizedHtml, 'text/html');
        console.warn('[BMAD_SANITIZE] DOMPurify sanitization applied in offscreen');
      } catch (sanitizeErr) {
        // If sanitization fails for any reason, fall back to parsing the raw HTML
        console.warn('[BMAD_SANITIZE] DOMPurify sanitization failed, falling back to raw HTML:', sanitizeErr);
        const parser = new DOMParser();
        doc = parser.parseFromString(html, 'text/html');
      }

      if (typeof (BoilerplateFilter as any)?.applyRules === 'function') {
        // Apply boilerplate rules to the document body in offscreen and emit sentinel
        BoilerplateFilter.applyRules(doc.body);
        console.warn('[BMAD_DBG] BoilerplateFilter applied in offscreen (body)');
      } else {
        console.warn('[BMAD_DBG] BoilerplateFilter not found in offscreen bundle');
      }

      // Serialize cleaned body back into the HTML string for downstream processing
      html = doc.body.innerHTML;

      // Intelligent Readability bypass:
      // If BoilerplateFilter signals this is technical content we should bypass Readability
      try {
        if (typeof (BoilerplateFilter as any)?.shouldBypassReadability === 'function' &&
            BoilerplateFilter.shouldBypassReadability(doc.body)) {
          console.warn('[BMAD_BYPASS] Technical content detected. Engaging ScoringEngine.');

          // Two-stage cleaning: after the safe UNWRAP pass, apply an aggressive REMOVE-only pass
          try {
            if (typeof (BoilerplateFilter as any)?.applyRules === 'function') {
              BoilerplateFilter.applyRules(doc.body, AGGRESSIVE_FILTER_RULES);
              console.warn('[BMAD_BYPASS] Aggressive second-stage filtering applied.');
            }
          } catch (aggErr) {
            console.warn('[BMAD_BYPASS] Aggressive second-stage filtering failed:', aggErr);
          }

          try {
            // Candidate selection: look for likely content containers
            const candidates = Array.from(doc.body.querySelectorAll('main, article, section, div')) as HTMLElement[];
            console.log(`[BMAD_DBG] Scoring ${candidates.length} potential candidates...`);

            let bestCandidate: HTMLElement | null = null;
            let maxScore = -Infinity;
            for (const candidate of candidates) {
              const score = ScoringEngine.scoreNode(candidate);
              console.log(`[BMAD_DBG] Candidate: <${candidate.tagName.toLowerCase()} id="${candidate.id}" class="${candidate.className}"> -- Score: ${score}`);
              if (score > maxScore) {
                maxScore = score;
                bestCandidate = candidate;
              }
            }

            const turndownPreset = (config && (config as any).turndownPreset) ? (config as any).turndownPreset : 'standard';

            if (bestCandidate && maxScore > 10) {
              console.log(`[BMAD_WINNER] Selected candidate with score ${maxScore}:`, bestCandidate);

              // --- PRUNE the winner to remove low-scoring direct children before conversion.
              const prunedCandidate = ScoringEngine.pruneNode(bestCandidate);
              const cleanedHtml = prunedCandidate.outerHTML;
              // --------------------------------

              const markdown = await TurndownConfigManager.convert(cleanedHtml, turndownPreset);
              const postOptions = {
                cleanupWhitespace: true,
                normalizeHeadings: true,
                fixListFormatting: true,
                removeEmptyLines: true,
                maxConsecutiveNewlines: 2,
                improveCodeBlocks: true,
                enhanceLinks: true,
                optimizeImages: true,
                addTableOfContents: config.postProcessing?.addTableOfContents || false,
                preserveLineBreaks: config.postProcessing?.optimizeForPlatform === 'obsidian',
              };
              const postResult = MarkdownPostProcessor.process(markdown, postOptions);

              const bypassResult: any = {
                success: true,
                markdown: postResult.markdown,
                metadata: {
                  title: title || 'Untitled',
                  url,
                  capturedAt: new Date().toISOString(),
                  selectionHash: `bypass-${Date.now()}`,
                },
                processingStats: {
                  totalTime: 0,
                  readabilityTime: 0,
                  turndownTime: 0,
                  postProcessingTime: 0,
                  fallbacksUsed: [],
                  qualityScore: 100,
                },
                warnings: postResult.warnings || [],
                errors: [],
              };

              const exportJson = this.generateStructuredExport(bypassResult, url, title);

              // Notify background via PROCESSING_COMPLETE from offscreen processor
              try {
                        console.log('[BMAD_TRACE] Offscreen returning markdown (bypass):', (bypassResult.markdown || '').substring(0, 100));
                        this.sendComplete(bypassResult.markdown, exportJson, bypassResult.metadata, bypassResult.processingStats, bypassResult.warnings, cleanedHtml);
              } catch (e) {
                console.warn('[EnhancedOffscreenProcessor] sendComplete failed:', e);
              }

              return {
                exportMd: bypassResult.markdown,
                exportJson,
                metadata: bypassResult.metadata,
                stats: bypassResult.processingStats,
                warnings: bypassResult.warnings,
                originalHtml: cleanedHtml,
              };
            } else {
              console.warn('[BMAD_BYPASS] ScoringEngine failed to find a confident candidate. Falling back to body conversion.');
              const cleanedHtml = doc.body.innerHTML;
              const markdown = await TurndownConfigManager.convert(cleanedHtml, turndownPreset);
              const postResult = MarkdownPostProcessor.process(markdown, {
                cleanupWhitespace: true,
                normalizeHeadings: true,
                fixListFormatting: true,
                removeEmptyLines: true,
                maxConsecutiveNewlines: 2,
                improveCodeBlocks: true,
                enhanceLinks: true,
                optimizeImages: true,
                addTableOfContents: config.postProcessing?.addTableOfContents || false,
                preserveLineBreaks: config.postProcessing?.optimizeForPlatform === 'obsidian',
              });

              const bypassResult: any = {
                success: true,
                markdown: postResult.markdown,
                metadata: {
                  title: title || 'Untitled',
                  url,
                  capturedAt: new Date().toISOString(),
                  selectionHash: `bypass-${Date.now()}`,
                },
                processingStats: {
                  totalTime: 0,
                  readabilityTime: 0,
                  turndownTime: 0,
                  postProcessingTime: 0,
                  fallbacksUsed: [],
                  qualityScore: 90,
                },
                warnings: postResult.warnings || [],
                errors: [],
              };

              const exportJson = this.generateStructuredExport(bypassResult, url, title);

              // Notify background via PROCESSING_COMPLETE from offscreen processor
              try {
                  console.log('[BMAD_TRACE] Offscreen returning markdown (bypass fallback):', (bypassResult.markdown || '').substring(0, 100));
                  this.sendComplete(bypassResult.markdown, exportJson, bypassResult.metadata, bypassResult.processingStats, bypassResult.warnings, cleanedHtml);
              } catch (e) {
                console.warn('[EnhancedOffscreenProcessor] sendComplete failed:', e);
              }

              return {
                exportMd: bypassResult.markdown,
                exportJson,
                metadata: bypassResult.metadata,
                stats: bypassResult.processingStats,
                warnings: bypassResult.warnings,
                originalHtml: cleanedHtml,
              };
            }
          } catch (scoreErr) {
            console.warn('[BMAD_BYPASS] ScoringEngine processing failed, falling back to direct conversion:', scoreErr);
            const cleanedHtml = doc.body.innerHTML;
            const turndownPreset = (config && (config as any).turndownPreset) ? (config as any).turndownPreset : 'standard';
            const markdown = await TurndownConfigManager.convert(cleanedHtml, turndownPreset);
            const postResult = MarkdownPostProcessor.process(markdown, {
              cleanupWhitespace: true,
              normalizeHeadings: true,
              fixListFormatting: true,
              removeEmptyLines: true,
              maxConsecutiveNewlines: 2,
              improveCodeBlocks: true,
              enhanceLinks: true,
              optimizeImages: true,
              addTableOfContents: config.postProcessing?.addTableOfContents || false,
              preserveLineBreaks: config.postProcessing?.optimizeForPlatform === 'obsidian',
            });
            const bypassResult: any = {
              success: true,
              markdown: postResult.markdown,
              metadata: {
                title: title || 'Untitled',
                url,
                capturedAt: new Date().toISOString(),
                selectionHash: `bypass-${Date.now()}`,
              },
              processingStats: {
                totalTime: 0,
                readabilityTime: 0,
                turndownTime: 0,
                postProcessingTime: 0,
                fallbacksUsed: [],
                qualityScore: 80,
              },
              warnings: postResult.warnings || [],
              errors: [],
            };
            const exportJson = this.generateStructuredExport(bypassResult, url, title);
            // Notify background via PROCESSING_COMPLETE from offscreen processor
            try {
                console.log('[BMAD_TRACE] Offscreen returning markdown (scoring fallback):', (bypassResult.markdown || '').substring(0, 100));
                this.sendComplete(bypassResult.markdown, exportJson, bypassResult.metadata, bypassResult.processingStats, bypassResult.warnings, cleanedHtml);
            } catch (e) {
              console.warn('[EnhancedOffscreenProcessor] sendComplete failed:', e);
            }

            return {
              exportMd: bypassResult.markdown,
              exportJson,
              metadata: bypassResult.metadata,
              stats: bypassResult.processingStats,
              warnings: bypassResult.warnings,
              originalHtml: cleanedHtml,
            };
          }
        } else {
          console.warn('[BMAD_BYPASS] No technical signal — using Readability pipeline.');
        }
      } catch (bypassErr) {
        console.warn('[BMAD_BYPASS] Bypass check/processing failed:', bypassErr);
      }

      const isLargeContent = html.length > config.performance.maxContentLength;

      let result;
      if (isLargeContent) {
        result = await OfflineModeManager.processLargeContent(html, url, title, config);
      } else {
        result = await OfflineModeManager.processContent(html, url, title, config);
      }

      if (!result.success) {
        throw new Error(`Processing failed: ${result.errors.join(', ')}`);
      }

      this.sendProgress('Converting to markdown...', 70, 'conversion');

      // Additional validation and enhancement
      const enhancedResult = await this.enhanceProcessingResult(result, config);

      // Generate structured export
      const exportJson = this.generateStructuredExport(enhancedResult, url, title);

      this.sendProgress('Complete!', 100, 'complete');

      console.log('[EnhancedOffscreenProcessor] Offline processing completed successfully');

      // Return the result instead of sending it
      // Notify background via PROCESSING_COMPLETE message
      try {
    console.log('[BMAD_TRACE] Offscreen returning markdown (standard path):', (enhancedResult.markdown || '').substring(0, 100));
    this.sendComplete(enhancedResult.markdown, exportJson, enhancedResult.metadata, enhancedResult.processingStats, enhancedResult.warnings, html);
      } catch (e) {
        console.warn('[EnhancedOffscreenProcessor] sendComplete failed:', e);
      }

      return {
        exportMd: enhancedResult.markdown,
        exportJson,
        metadata: enhancedResult.metadata,
        stats: enhancedResult.processingStats,
        warnings: enhancedResult.warnings,
        originalHtml: html,
      };

    } catch (error) {
      console.error('[EnhancedOffscreenProcessor] Offline processing failed:', error);
      throw error;
    }
  }

  private async processAIMode(
    html: string,
    url: string,
    title: string,
    config: OfflineModeConfig
  ): Promise<ProcessingCompleteMessage['payload']> {
    // For now, fall back to offline processing
    // This will be enhanced with AI capabilities in the Pro version
    this.sendProgress('AI mode not yet implemented, using enhanced offline processing...', 20, 'fallback');
    return await this.processOfflineMode(html, url, title, config);
  }

  private async enhanceProcessingResult(
    result: any,
    config: OfflineModeConfig
  ): Promise<any> {
    try {
      // Additional post-processing based on platform optimization
      if (config.postProcessing.optimizeForPlatform) {
        const platformOptimizations = this.getPlatformOptimizations(config.postProcessing.optimizeForPlatform);
        
        const enhancedResult = MarkdownPostProcessor.process(result.markdown, platformOptimizations);
        
        return {
          ...result,
          markdown: enhancedResult.markdown,
          warnings: [...result.warnings, ...enhancedResult.warnings],
          processingStats: {
            ...result.processingStats,
            enhancementTime: performance.now(),
            improvements: enhancedResult.improvements,
          },
        };
      }

      return result;
    } catch (error) {
      console.warn('[EnhancedOffscreenProcessor] Enhancement failed, using original result:', error);
      return result;
    }
  }

  private getPlatformOptimizations(platform: string) {
    switch (platform) {
      case 'obsidian':
        return {
          cleanupWhitespace: true,
          normalizeHeadings: true,
          fixListFormatting: true,
          removeEmptyLines: true,
          maxConsecutiveNewlines: 1,
          improveCodeBlocks: true,
          enhanceLinks: false, // Obsidian has its own link syntax
          optimizeImages: false, // Obsidian has its own image syntax
          addTableOfContents: false,
          preserveLineBreaks: true,
        };
      
      case 'github':
        return {
          cleanupWhitespace: true,
          normalizeHeadings: true,
          fixListFormatting: true,
          removeEmptyLines: true,
          maxConsecutiveNewlines: 2,
          improveCodeBlocks: true,
          enhanceLinks: true,
          optimizeImages: true,
          addTableOfContents: true,
          preserveLineBreaks: false,
        };
      
      default:
        return {
          cleanupWhitespace: true,
          normalizeHeadings: true,
          fixListFormatting: true,
          removeEmptyLines: true,
          maxConsecutiveNewlines: 2,
          improveCodeBlocks: true,
          enhanceLinks: true,
          optimizeImages: true,
          addTableOfContents: false,
          preserveLineBreaks: false,
        };
    }
  }

  private generateStructuredExport(result: any, url: string, title: string): any {
    return {
      version: '1.0',
      metadata: {
        ...result.metadata,
        processingMode: 'enhanced-offline',
        qualityScore: result.processingStats.qualityScore,
        processingTime: result.processingStats.totalTime,
      },
      content: {
        markdown: result.markdown,
        wordCount: result.markdown.split(/\s+/).length,
        characterCount: result.markdown.length,
        headingCount: (result.markdown.match(/^#{1,6}\s/gm) || []).length,
        codeBlockCount: (result.markdown.match(/```[\s\S]*?```/g) || []).length,
        linkCount: (result.markdown.match(/\[.*?\]\(.*?\)/g) || []).length,
        imageCount: (result.markdown.match(/!\[.*?\]\(.*?\)/g) || []).length,
      },
      processing: {
        stats: result.processingStats,
        warnings: result.warnings,
        fallbacksUsed: result.processingStats.fallbacksUsed,
      },
    };
  }

  private lastProgressTime = 0;
  private readonly PROGRESS_THROTTLE_MS = 200; // Only send progress updates every 200ms

  private sendProgress(message: string, progress: number, stage: string): void {
    const now = Date.now();

    // Throttle progress updates except for completion (100%)
    if (progress < 100 && now - this.lastProgressTime < this.PROGRESS_THROTTLE_MS) {
      return;
    }

    this.lastProgressTime = now;

    const progressMessage: ProcessingProgressMessage = {
      type: 'PROCESSING_PROGRESS',
      payload: { message, progress, stage },
    };

    browser.runtime.sendMessage(progressMessage).catch(error => {
      console.warn('[EnhancedOffscreenProcessor] Failed to send progress update:', error);
    });
  }

  private sendComplete(
    markdown: string,
    exportJson: any,
    metadata: any,
    stats: any,
    warnings: string[],
    originalHtml: string
  ): void {
    const completeMessage: ProcessingCompleteMessage = {
      type: 'PROCESSING_COMPLETE',
      payload: {
        exportMd: markdown,
        exportJson,
        metadata,
        stats,
        warnings,
        originalHtml,
      },
    };

    browser.runtime.sendMessage(completeMessage).catch(error => {
      console.error('[EnhancedOffscreenProcessor] Failed to send completion message:', error);
    });
  }

  private sendError(error: string, stage: string, fallbackUsed = false): void {
    const errorMessage: ProcessingErrorMessage = {
      type: 'PROCESSING_ERROR',
      payload: { error, stage, fallbackUsed },
    };

    browser.runtime.sendMessage(errorMessage).catch(sendError => {
      console.error('[EnhancedOffscreenProcessor] Failed to send error message:', sendError);
    });
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(): Promise<{ isProcessing: boolean; cacheStats: any }> {
    return {
      isProcessing: this.isProcessing,
      cacheStats: await OfflineModeManager.getCacheStats(),
    };
  }

  /**
   * Clear processing cache
   */
  async clearCache(): Promise<void> {
    await OfflineModeManager.clearCache();
  }
}

// Initialize the enhanced processor when the offscreen document loads
if (typeof window !== 'undefined') {
  console.log('[EnhancedOffscreenProcessor] Initializing enhanced offscreen processor...');
  EnhancedOffscreenProcessor.getInstance();
}
