// Enhanced offscreen processor integrating the new offline capabilities
// Replaces the existing offscreen processing with optimized pipeline

import { browser } from 'wxt/browser';
import { getUserId } from '../../lib/user';
import { OfflineModeManager, OfflineModeConfig } from '../../core/offline-mode-manager.js';

import { Storage } from '../../lib/storage';
import { BYOKClient } from '../../pro/byok-client';
import { Settings } from '../../lib/types';

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

interface AIErrorResponse {
  error: string;
}

interface AISuccessResponse {
  content: string;
  remaining: number;
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
      return false;
    });
  }

  private async handleProcessingRequest(message: ProcessingMessage): Promise<ProcessingCompleteMessage['payload']> {
    if (this.isProcessing) {
      throw new Error('Another processing operation is already in progress');
    }
    this.isProcessing = true;
    try {
      const { html, url, title, mode, customConfig, settings, selectionHash } = message.payload;
      this.sendProgress('Processing content...', 10, 'initialization');
      if (!html || html.trim().length === 0) throw new Error('No HTML content provided');
      
      const optimalConfig = await OfflineModeManager.getOptimalConfig(url, settings);
      const finalConfig = { ...optimalConfig, ...customConfig };

      let processingResult;
      if (mode === 'offline') {
        processingResult = await this.processOfflineMode(html, url, title, finalConfig);
      } else {
        processingResult = await this.processAIMode(html, url, title, finalConfig, settings); // Pass settings here
      }

      // Propagate selectionHash back to the background so it can map results to originating tab
      try {
        if (selectionHash) {
          if (!processingResult.metadata) processingResult.metadata = {};
          processingResult.metadata.selectionHash = selectionHash;

          if (processingResult.exportJson && typeof processingResult.exportJson === 'object') {
            if (!processingResult.exportJson.metadata) processingResult.exportJson.metadata = {};
            processingResult.exportJson.metadata.selectionHash = selectionHash;
          }
        }
      } catch (attachErr) {
        console.warn('[EnhancedOffscreenProcessor] Failed to attach selectionHash to result:', attachErr);
      }

      return processingResult;
    } catch (error) {
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
    this.sendProgress('Cleaning and preparing content...', 20, 'preprocessing');
    
    const result = await OfflineModeManager.processContent(html, url, title, config);
    if (!result.success) {
      throw new Error(`Offline processing failed: ${result.errors.join(', ')}`);
    }

    const exportJson = this.generateStructuredExport(result, url, title);

    this.sendComplete(result.markdown, exportJson, result.metadata, result.processingStats, result.warnings, html);
    return {
      exportMd: result.markdown,
      exportJson,
      metadata: result.metadata,
      stats: result.processingStats,
      warnings: result.warnings,
      originalHtml: html,
    };
  }

  private async processAIMode(
    html: string,
    url: string,
    title: string,
    config: OfflineModeConfig,
    settings: Settings // Add settings here
  ): Promise<ProcessingCompleteMessage['payload']> {
    this.sendProgress('Sending to AI for processing...', 30, 'ai-processing');

    try {
      const apiKey = await Storage.getApiKey(); // Get API key from storage

      let processedMarkdown: string;
      let remainingCredits: number | undefined;

      if (apiKey) {
        // Use BYOK client if API key is available
        this.sendProgress('Using BYOK for AI processing...', 40, 'byok-processing');
        const byokResult = await BYOKClient.makeRequest(
          { prompt: html, maxTokens: 4000, temperature: 0.7 }, // Use html as prompt
          { apiBase: settings.byok.apiBase, apiKey: apiKey, model: settings.byok.model }
        );
        processedMarkdown = byokResult.content;
        // BYOK does not return remaining credits, so it will be undefined
      } else {
        // Fallback to trial proxy
        const userId = await getUserId();
        // NOTE: This assumes the AI proxy is available at this relative path.
        // In a real extension, this would be a full URL to the deployed function.
        const response = await fetch('/api/process-ai', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: userId,
            content: html,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json() as AIErrorResponse;
          throw new Error(errorData.error || `AI service returned status ${response.status}`);
        }

        const result = await response.json() as AISuccessResponse;
        processedMarkdown = result.content;
        remainingCredits = result.remaining;
      }

      this.sendProgress('Post-processing AI response...', 80, 'postprocessing');
      const postResult = MarkdownPostProcessor.process(processedMarkdown, {});
      const exportJson = this.generateStructuredExport(postResult, url, title);

      this.sendComplete(postResult.markdown, exportJson, { title, url, remainingCredits }, {}, [], html);
      
      return {
        exportMd: postResult.markdown,
        exportJson,
        metadata: { title, url, remainingCredits },
        stats: {},
        warnings: [],
        originalHtml: html,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown AI processing error';
      this.sendError(errorMessage, 'ai-processing');
      this.sendProgress('AI processing failed, falling back to offline mode...', 90, 'fallback');
      return await this.processOfflineMode(html, url, title, config);
    }
  }



  private lastProgressTime = 0;
  private readonly PROGRESS_THROTTLE_MS = 200;

  private sendProgress(message: string, progress: number, stage: string): void {
    // ... (existing implementation)
  }

  private sendComplete(
    markdown: string,
    exportJson: any,
    metadata: any,
    stats: any,
    warnings: string[],
    originalHtml: string
  ): void {
    // ... (existing implementation)
  }

  private sendError(error: string, stage: string, fallbackUsed = false): void {
    // ... (existing implementation)
  }

  async getProcessingStats(): Promise<{ isProcessing: boolean; cacheStats: any }> {
    return {
      isProcessing: this.isProcessing,
      cacheStats: await OfflineModeManager.getCacheStats(),
    };
  }

  async clearCache(): Promise<void> {
    await OfflineModeManager.clearCache();
  }
}

// Initialize the enhanced processor when the offscreen document loads
if (typeof window !== 'undefined') {
  console.log('[EnhancedOffscreenProcessor] Initializing enhanced offscreen processor...');
  EnhancedOffscreenProcessor.getInstance();
}
