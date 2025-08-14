// Enhanced offscreen processor integrating the new offline capabilities
// Replaces the existing offscreen processing with optimized pipeline

import { browser } from 'wxt/browser';
import { OfflineModeManager, OfflineModeConfig } from '../../core/offline-mode-manager.js';
import { ReadabilityConfigManager } from '../../core/readability-config.js';
import { TurndownConfigManager } from '../../core/turndown-config.js';
import { MarkdownPostProcessor } from '../../core/post-processor.js';

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

      if (message.type === 'OFFSCREEN_COPY') {
        this.handleCopyRequest(message.payload.content)
          .then(() => sendResponse({ success: true }))
          .catch(error => sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Copy failed'
          }));
        return true;
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

      // Check if content is large and needs chunking
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

  private async handleCopyRequest(content: string): Promise<void> {
    console.log('[EnhancedOffscreenProcessor] Handling copy request, content length:', content.length);

    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard API not available');
      }

      await navigator.clipboard.writeText(content);
      console.log('[EnhancedOffscreenProcessor] Content copied to clipboard via navigator.clipboard');
    } catch (error) {
      console.error('[EnhancedOffscreenProcessor] navigator.clipboard failed:', error);
      // Fallback: try using the legacy method
      try {
        console.log('[EnhancedOffscreenProcessor] Trying execCommand fallback...');
        const textArea = document.createElement('textarea');
        textArea.value = content;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const success = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (!success) {
          throw new Error('execCommand returned false');
        }

        console.log('[EnhancedOffscreenProcessor] Content copied using execCommand fallback');
      } catch (fallbackError) {
        console.error('[EnhancedOffscreenProcessor] Fallback copy also failed:', fallbackError);
        throw new Error(`Both clipboard methods failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
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
