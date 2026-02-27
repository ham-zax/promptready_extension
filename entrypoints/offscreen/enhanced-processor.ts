// Enhanced offscreen processor integrating the new offline capabilities
// Replaces the existing offscreen processing with optimized pipeline

import { browser } from 'wxt/browser';
import { OfflineModeManager, OfflineModeConfig } from '../../core/offline-mode-manager.js';
import { processWithProviderChain } from '../../core/extraction-provider.js';

import { BYOKClient } from '../../pro/byok-client';
import { CaptureDiagnostics, Settings } from '../../lib/types';
import type { ExportMetadata } from '../../lib/types';
import { MarkdownPostProcessor } from '../../core/post-processor.js';
import { PerformanceMetrics } from '../../core/performance-metrics.js';
import { getRuntimeProfile, validateRuntimeProfile, assertRuntimeProfileSafe } from '../../lib/runtime-profile.js';
import { normalizeByokProvider } from '../../lib/byok-provider.js';
import { buildCanonicalMetadata, canonicalizeDeliveredMarkdown } from '../../lib/markdown-canonicalizer.js';
import { buildByokPrompt } from '../../core/prompts/byok-prompt.js';

interface ProcessingMessage {
  type: 'ENHANCED_OFFSCREEN_PROCESS';
  payload: {
    html: string;
    url: string;
    title: string;
    metadataHtml?: string;
    captureDiagnostics?: CaptureDiagnostics;
    selectionHash: string;
    mode: 'offline' | 'ai';
    useReadability?: boolean;
    renderer?: 'turndown' | 'structurer';
    customConfig?: Partial<OfflineModeConfig>;
    settings?: any; // Pass settings from background to avoid storage access issues
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
    aiAttempted: boolean;
    aiProvider: 'openrouter' | null;
    aiOutcome: 'not_attempted' | 'success' | 'fallback_provider' | 'fallback_missing_key' | 'fallback_request_failed';
    fallbackCode?: 'ai_fallback:provider_not_supported' | 'ai_fallback:missing_openrouter_key' | 'ai_fallback:request_failed';
  };
}

type AIAttemptTrace = {
  aiAttempted: boolean;
  aiProvider: 'openrouter' | null;
  aiOutcome: 'not_attempted' | 'success' | 'fallback_provider' | 'fallback_missing_key' | 'fallback_request_failed';
  fallbackCode?: 'ai_fallback:provider_not_supported' | 'ai_fallback:missing_openrouter_key' | 'ai_fallback:request_failed';
};

const DEFAULT_AI_TRACE: AIAttemptTrace = {
  aiAttempted: false,
  aiProvider: null,
  aiOutcome: 'not_attempted',
};

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
    const runtimeProfile = getRuntimeProfile();
    const runtimeValidation = validateRuntimeProfile(runtimeProfile);
    if (runtimeValidation.warnings.length > 0) {
      console.warn('[RuntimeProfile] Offscreen warnings:', runtimeValidation.warnings);
    }
    assertRuntimeProfileSafe(runtimeProfile);

    this.setupMessageListener();

    // Eagerly load runtime modules used by dynamic fallbacks. This prevents
    // mid-request chunk fetch failures after extension hot-reloads/update churn.
    void OfflineModeManager.preloadRuntimeModules();
  }

  private setupMessageListener(): void {
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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

      // Background service worker can’t access IndexedDB/DOM cache directly; proxy via offscreen.
      if (message.type === 'OFFSCREEN_GET_PROCESSING_STATS') {
        this.getProcessingStats()
          .then(data => sendResponse({ success: true, data }))
          .catch(err => sendResponse({
            success: false,
            error: err instanceof Error ? err.message : String(err)
          }));
        return true;
      }

      if (message.type === 'OFFSCREEN_CLEAR_CACHE') {
        this.clearCache()
          .then(() => sendResponse({ success: true }))
          .catch(err => sendResponse({
            success: false,
            error: err instanceof Error ? err.message : String(err)
          }));
        return true;
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
      const { html, url, title, mode, customConfig, settings, selectionHash, metadataHtml, captureDiagnostics } = message.payload;
      this.sendProgress('Processing content...', 10, 'initialization');
      if (!html || html.trim().length === 0) throw new Error('No HTML content provided');

      const optimalConfig = await OfflineModeManager.getOptimalConfig(url, settings);
      const finalConfig = { ...optimalConfig, ...customConfig };

      let processingResult;
      if (mode === 'offline') {
        processingResult = await this.processOfflineMode(html, url, title, finalConfig, metadataHtml);
      } else {
        processingResult = await this.processAIMode(
          html,
          url,
          title,
          finalConfig,
          settings,
          metadataHtml,
          selectionHash
        );
      }

      // Propagate selectionHash back to the background so it can map results to originating tab
      try {
        if (selectionHash) {
          if (!processingResult.metadata) processingResult.metadata = {};
          processingResult.metadata.selectionHash = selectionHash;
          if (captureDiagnostics) {
            (processingResult.metadata as any).captureDiagnostics = captureDiagnostics;
          }

          if (processingResult.exportJson && typeof processingResult.exportJson === 'object') {
            if (!processingResult.exportJson.metadata) processingResult.exportJson.metadata = {};
            processingResult.exportJson.metadata.selectionHash = selectionHash;
            if (captureDiagnostics) {
              processingResult.exportJson.metadata.captureDiagnostics = captureDiagnostics;
            }
          }
        }
      } catch (attachErr) {
        console.warn('[EnhancedOffscreenProcessor] Failed to attach selectionHash to result:', attachErr);
      }

      const warnings = Array.isArray(processingResult.warnings) ? processingResult.warnings : [];
      const metadata = buildCanonicalMetadata(
        processingResult.metadata as Partial<ExportMetadata>,
        {
          title,
          url,
          capturedAt: new Date().toISOString(),
          selectionHash: selectionHash || undefined,
        }
      );
      processingResult.metadata = metadata;
      processingResult.exportMd = canonicalizeDeliveredMarkdown(processingResult.exportMd || '', metadata, warnings);
      processingResult.warnings = warnings;
      if (processingResult.exportJson && typeof processingResult.exportJson === 'object') {
        if (!processingResult.exportJson.metadata) {
          processingResult.exportJson.metadata = metadata;
        } else {
          processingResult.exportJson.metadata = {
            ...processingResult.exportJson.metadata,
            ...metadata,
          };
        }
        if (processingResult.exportJson.content && typeof processingResult.exportJson.content === 'object') {
          processingResult.exportJson.content.markdown = processingResult.exportMd;
        }
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
    config: OfflineModeConfig,
    metadataHtml?: string,
    aiTrace: AIAttemptTrace = DEFAULT_AI_TRACE
  ): Promise<ProcessingCompleteMessage['payload']> {
    this.sendProgress('Cleaning and preparing content...', 20, 'preprocessing');

    const chain = await processWithProviderChain(html, url, title, config, metadataHtml);
    const result = chain.result;
    if (!result.success) {
      throw new Error(`Offline processing failed: ${result.errors.join(', ')}`);
    }

    if (!result.metadata) result.metadata = {} as any;
    (result.metadata as any).extractionProvider = chain.decision.provider;
    (result.metadata as any).extractionFallbackReason = chain.decision.fallbackReason;

    if (result.processingStats) {
      (result.processingStats as any).provider = chain.decision.provider;
      (result.processingStats as any).providerFallbackReason = chain.decision.fallbackReason;
    }

    const exportJson = this.generateStructuredExport(result, url, title);

    return {
      exportMd: result.markdown,
      exportJson,
      metadata: result.metadata,
      stats: result.processingStats,
      warnings: result.warnings,
      originalHtml: html,
      ...aiTrace,
    };
  }

  private async processAIMode(
    html: string,
    url: string,
    title: string,
    config: OfflineModeConfig,
    settings: Settings, // Add settings here
    metadataHtml?: string,
    selectionHash?: string
  ): Promise<ProcessingCompleteMessage['payload']> {
    this.sendProgress('Sending to AI for processing...', 30, 'ai-processing');

    try {
      const runtimeProfile = getRuntimeProfile();
      const providerNormalization = normalizeByokProvider(settings.byok?.provider);
      const provider = providerNormalization.canonicalProvider;
      const apiKey = settings.byok?.apiKey || '';
      const model = settings.byok?.model || settings.byok?.selectedByokModel || 'arcee-ai/trinity-large-preview:free';

      if (!providerNormalization.isSupported || provider !== 'openrouter') {
        const warningCode = 'ai_fallback:provider_not_supported';
        console.warn('[AI Mode] Unsupported BYOK provider. OpenRouter is the only supported provider.');
        this.sendProgress('Only OpenRouter BYOK is supported. Using offline mode...', 50, 'fallback');
        const offlineResult = await this.processOfflineMode(
          html,
          url,
          title,
          config,
          metadataHtml,
          {
            aiAttempted: false,
            aiProvider: null,
            aiOutcome: 'fallback_provider',
            fallbackCode: warningCode,
          }
        );
        offlineResult.warnings = [...(offlineResult.warnings || []), warningCode];
        return offlineResult;
      }

      if (providerNormalization.wasLegacyAlias) {
        console.info('[AI Mode] Normalized legacy BYOK provider alias to OpenRouter.');
      }

      if (!apiKey.trim()) {
        const warningCode = 'ai_fallback:missing_openrouter_key';
        console.warn('[AI Mode] Missing OpenRouter API key. Falling back to offline mode.');
        this.sendProgress('No OpenRouter API key configured. Using offline mode...', 50, 'fallback');
        const offlineResult = await this.processOfflineMode(
          html,
          url,
          title,
          config,
          metadataHtml,
          {
            aiAttempted: false,
            aiProvider: null,
            aiOutcome: 'fallback_missing_key',
            fallbackCode: warningCode,
          }
        );
        offlineResult.warnings = [...(offlineResult.warnings || []), warningCode];
        return offlineResult;
      }

      // Use OpenRouter BYOK client (single provider workflow) with a prompt
      // template sourced from markdown so it is easy to iterate without touching
      // processing code.
      this.sendProgress(
        runtimeProfile.isDevelopment
          ? 'Using OpenRouter BYOK in development...'
          : 'Using your OpenRouter key for AI processing...',
      40,
      'byok-processing');

      const byokPrompt = buildByokPrompt({
        html,
        url,
        title,
        selectionHash,
        metadataHtml,
        capturedAt: new Date().toISOString(),
      });

      const byokResult = await BYOKClient.makeRequest(
        { prompt: byokPrompt, maxTokens: 4000, temperature: 0.7 },
        {
          apiBase: 'https://openrouter.ai/api/v1',
          apiKey: apiKey.trim(),
          model: model
        }
      );

      const processedMarkdown = byokResult.content;
      const aiWarnings = providerNormalization.wasLegacyAlias
        ? ['ai_provider_normalized:legacy_alias']
        : [];

      this.sendProgress('Post-processing AI response...', 80, 'postprocessing');
      const postResult = MarkdownPostProcessor.process(processedMarkdown, {});
      const canonicalMetadata = buildCanonicalMetadata(
        { title, url, selectionHash },
        { title, url, capturedAt: new Date().toISOString(), selectionHash }
      );
      const canonicalMarkdown = canonicalizeDeliveredMarkdown(postResult.markdown, canonicalMetadata, aiWarnings);
      const exportJson = this.generateStructuredExport(postResult, url, title);
      if (exportJson?.content && typeof exportJson.content === 'object') {
        exportJson.content.markdown = canonicalMarkdown;
      }
      exportJson.metadata = { ...(exportJson.metadata || {}), ...canonicalMetadata };

      return {
        exportMd: canonicalMarkdown,
        exportJson,
        metadata: canonicalMetadata,
        stats: {},
        warnings: aiWarnings,
        originalHtml: html,
        aiAttempted: true,
        aiProvider: 'openrouter',
        aiOutcome: 'success',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown AI processing error';
      console.error('[AI Mode] Processing failed:', errorMessage);
      this.sendError(errorMessage, 'ai-processing', true);
      this.sendProgress('AI processing failed, falling back to offline mode...', 90, 'fallback');
      const warningCode = 'ai_fallback:request_failed';
      const offlineResult = await this.processOfflineMode(
        html,
        url,
        title,
        config,
        metadataHtml,
        {
          aiAttempted: true,
          aiProvider: 'openrouter',
          aiOutcome: 'fallback_request_failed',
          fallbackCode: warningCode,
        }
      );
      offlineResult.warnings = [...(offlineResult.warnings || []), warningCode];
      return offlineResult;
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
        } catch {
          // Textarea may already be detached by browser cleanup.
        }

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
    const now = Date.now();
    if (now - this.lastProgressTime < this.PROGRESS_THROTTLE_MS && progress < 100) {
      return;
    }

    this.lastProgressTime = now;
    browser.runtime.sendMessage({
      type: 'PROCESSING_PROGRESS',
      payload: { message, progress, stage },
    }).catch((err) => {
      console.warn('[EnhancedOffscreenProcessor] Failed to send progress:', err);
    });
  }

  private sendComplete(
    markdown: string,
    exportJson: any,
    metadata: any,
    stats: any,
    warnings: string[],
    originalHtml: string,
    aiTrace: AIAttemptTrace = DEFAULT_AI_TRACE
  ): void {
    browser.runtime.sendMessage({
      type: 'PROCESSING_COMPLETE',
      payload: {
        exportMd: markdown,
        exportJson,
        metadata,
        stats,
        warnings,
        originalHtml,
        ...aiTrace,
      },
    }).catch((err) => {
      console.warn('[EnhancedOffscreenProcessor] Failed to send complete event:', err);
    });
  }

  private sendError(error: string, stage: string, fallbackUsed = false): void {
    browser.runtime.sendMessage({
      type: 'PROCESSING_ERROR',
      payload: {
        error,
        stage,
        fallbackUsed,
      },
    }).catch((err) => {
      console.warn('[EnhancedOffscreenProcessor] Failed to send error event:', err);
    });
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
