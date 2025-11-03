// Enhanced offscreen processor integrating the new offline capabilities
// Replaces the existing offscreen processing with optimized pipeline

import { browser } from 'wxt/browser';
import { getUserId } from '../../lib/user';
import { OfflineModeManager, OfflineModeConfig } from '../../core/offline-mode-manager.js';

import { BYOKClient } from '../../pro/byok-client';
import { Settings } from '../../lib/types';
import { MarkdownPostProcessor } from '../../core/post-processor.js';
import { PerformanceMetrics } from '../../core/performance-metrics.js';

// ============= DEVELOPMENT MODE CONFIGURATION =============
// Set to true to use hardcoded API credentials for testing
const DEV_MODE = true;
const DEV_API_CONFIG = {
  apiBase: 'https://api.z.ai/api/coding/paas/v4',
  apiKey: 'cead729df8374268918c14db2bddb43e.bObIHNe6TwmTefrR',
  model: 'glm-4.6'
};
// ==========================================================

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
  private static performance = PerformanceMetrics.getInstance();

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

      // New: handle clipboard writes via offscreen document as a fallback path
      if (message.type === 'OFFSCREEN_COPY') {
        const text = (message.payload && (message.payload as any).content) || '';
        this.performOffscreenCopy(text)
          .then(res => sendResponse(res))
          .catch(err => sendResponse({
            success: false,
            error: err instanceof Error ? err.message : String(err)
          }));
        return true; // async response
      }

      // Handle performance analytics requests
      if (message.type === 'GET_PERFORMANCE_ANALYTICS') {
        OfflineModeManager.getPerformanceAnalytics()
          .then(data => sendResponse({ success: true, data }))
          .catch(err => sendResponse({
            success: false,
            error: err instanceof Error ? err.message : String(err)
          }));
        return true; // async response
      }

      // Handle real-time metrics requests
      if (message.type === 'GET_REAL_TIME_METRICS') {
        OfflineModeManager.getRealTimeMetrics()
          .then(data => sendResponse({ success: true, data }))
          .catch(err => sendResponse({
            success: false,
            error: err instanceof Error ? err.message : String(err)
          }));
        return true; // async response
      }

      return false;
    });
  }

  private async handleProcessingRequest(message: ProcessingMessage): Promise<ProcessingCompleteMessage['payload']> {
    if (this.isProcessing) {
      throw new Error('Another processing operation is already in progress');
    }
    this.isProcessing = true;

    // Initialize performance tracking for this session
    EnhancedOffscreenProcessor.performance.captureMemorySnapshot('offscreen_processing_start');
    EnhancedOffscreenProcessor.performance.recordProcessingSnapshot('offscreen_processing_start');

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
      // DEV_MODE: Use hardcoded credentials for development/testing
      let apiKey: string;
      let apiBase: string;
      let model: string;

      if (DEV_MODE) {
        console.log('[AI Mode] DEV_MODE enabled - using hardcoded API credentials');
        apiKey = DEV_API_CONFIG.apiKey;
        apiBase = DEV_API_CONFIG.apiBase;
        model = DEV_API_CONFIG.model;
      } else {
        // Production: Get API key from passed settings
        apiKey = settings.byok?.apiKey || '';
        apiBase = settings.byok?.apiBase || '';
        model = settings.byok?.model || settings.byok?.selectedByokModel || 'anthropic/claude-3.5-sonnet';
      }

      if (!apiKey) {
        // No API key and no credit service available - inform user and fallback
        console.warn('[AI Mode] No API key configured and no credit service available. Falling back to offline mode.');
        this.sendProgress('No API key configured. Using offline mode...', 50, 'fallback');
        return await this.processOfflineMode(html, url, title, config);
      }

      // Use BYOK client if API key is available
      this.sendProgress('Using your API key for AI processing...', 40, 'byok-processing');
      const byokResult = await BYOKClient.makeRequest(
        { prompt: html, maxTokens: 4000, temperature: 0.7 }, // Use html as prompt
        {
          apiBase: apiBase,
          apiKey: apiKey,
          model: model
        }
      );

      const processedMarkdown = byokResult.content;

      this.sendProgress('Post-processing AI response...', 80, 'postprocessing');
      const postResult = MarkdownPostProcessor.process(processedMarkdown, {});
      const exportJson = this.generateStructuredExport(postResult, url, title);

      this.sendComplete(postResult.markdown, exportJson, { title, url }, {}, [], html);

      return {
        exportMd: postResult.markdown,
        exportJson,
        metadata: { title, url },
        stats: {},
        warnings: [],
        originalHtml: html,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown AI processing error';
      console.error('[AI Mode] Processing failed:', errorMessage);
      this.sendError(errorMessage, 'ai-processing');
      this.sendProgress('AI processing failed, falling back to offline mode...', 90, 'fallback');
      return await this.processOfflineMode(html, url, title, config);
    }
  }



  private async performOffscreenCopy(text: string): Promise<{ success: boolean; method?: string; error?: string }> {
    try {
      // Tier 1: navigator.clipboard
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        try {
          await navigator.clipboard.writeText(text);
          return { success: true, method: 'offscreen:navigator.clipboard' };
        } catch (err: any) {
          // fall through to execCommand
          console.warn('[Offscreen] navigator.clipboard.writeText failed:', err);
        }
      }

      // Tier 2: execCommand fallback
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.setAttribute('readonly', '');
        document.body.appendChild(ta);
        ta.select();

        let ok = false;
        try {
          ok = document.execCommand('copy');
        } catch (e: any) {
          console.warn('[Offscreen] document.execCommand("copy") failed:', e);
        }

        try {
          document.body.removeChild(ta);
        } catch { }

        if (ok) {
          return { success: true, method: 'offscreen:execCommand' };
        }
      } catch (fallbackErr: any) {
        console.warn('[Offscreen] execCommand fallback threw:', fallbackErr);
      }

      return { success: false, error: 'Offscreen copy failed' };
    } catch (outerErr: any) {
      return { success: false, error: outerErr instanceof Error ? outerErr.message : String(outerErr) };
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

  private generateStructuredExport(result: any, url: string, title: string): any {
    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: {
        url,
        title: title || 'Untitled',
        extractedAt: new Date().toISOString()
      },
      content: {
        markdown: result.markdown,
        html: result.originalHtml || '',
        wordCount: (result.markdown || '').split(/\s+/).length,
        characterCount: (result.markdown || '').length
      },
      metadata: result.metadata || {},
      quality: result.qualityReport || {},
      processing: {
        pipeline: result.pipelineUsed || 'standard',
        stats: result.processingStats || {},
        warnings: result.warnings || []
      }
    };
  }
}

// Initialize the enhanced processor when the offscreen document loads
if (typeof window !== 'undefined') {
  console.log('[EnhancedOffscreenProcessor] Initializing enhanced offscreen processor...');
  EnhancedOffscreenProcessor.getInstance();
}
