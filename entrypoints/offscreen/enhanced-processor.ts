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
      this.sendProgress('Processing content...', 10, 'initialization');
      if (!html || html.trim().length === 0) throw new Error('No HTML content provided');
      
      const optimalConfig = await OfflineModeManager.getOptimalConfig(url, settings);
      const finalConfig = { ...optimalConfig, ...customConfig };

      if (mode === 'offline') {
        return await this.processOfflineMode(html, url, title, finalConfig);
      } else {
        return await this.processAIMode(html, url, title, finalConfig);
      }
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
    
    const sanitizedHtml = DOMPurify.sanitize(html);
    const parser = new DOMParser();
    const doc = parser.parseFromString(sanitizedHtml, 'text/html');
    
    // 1. Apply the "safe" boilerplate filter first.
    BoilerplateFilter.applyRules(doc.body);
    console.warn('[BMAD_DBG] Safe BoilerplateFilter applied in offscreen.');

    // 2. HYBRID PIPELINE ORCHESTRATOR: Decide which path to take.
    if (BoilerplateFilter.shouldBypassReadability(doc.body)) {
      console.warn('[BMAD_BYPASS] Technical content detected. Engaging Intelligent Bypass Pipeline.');
      return this.runIntelligentBypassPipeline(doc, url, title, config);
    } else {
      console.warn('[BMAD_BYPASS] No technical signal — using Standard Readability Pipeline.');
      const preProcessedHtml = doc.body.innerHTML;
      return this.runStandardPipeline(preProcessedHtml, url, title, config);
    }
  }

  private async runStandardPipeline(
    html: string,
    url: string,
    title: string,
    config: OfflineModeConfig
  ): Promise<ProcessingCompleteMessage['payload']> {
    this.sendProgress('Extracting main article...', 40, 'extraction');
    
    // This path uses the standard Readability.js engine.
    const result = await OfflineModeManager.processContent(html, url, title, config);
    if (!result.success) {
      throw new Error(`Readability processing failed: ${result.errors.join(', ')}`);
    }

    this.sendProgress('Post-processing markdown...', 80, 'postprocessing');
    const enhancedResult = await this.enhanceProcessingResult(result, config);
    const exportJson = this.generateStructuredExport(enhancedResult, url, title);

    this.sendComplete(enhancedResult.markdown, exportJson, enhancedResult.metadata, enhancedResult.processingStats, enhancedResult.warnings, html);
    return {
      exportMd: enhancedResult.markdown,
      exportJson,
      metadata: enhancedResult.metadata,
      stats: enhancedResult.processingStats,
      warnings: enhancedResult.warnings,
      originalHtml: html,
    };
  }

  private async runIntelligentBypassPipeline(
    doc: Document,
    url: string,
    title: string,
    config: OfflineModeConfig
  ): Promise<ProcessingCompleteMessage['payload']> {
    // This path uses our custom scoring and pruning engine.
    this.sendProgress('Applying aggressive filters...', 40, 'filtering');
    BoilerplateFilter.applyRules(doc.body, AGGRESSIVE_FILTER_RULES);
    console.warn('[BMAD_BYPASS] Aggressive second-stage filtering applied.');

    this.sendProgress('Scoring content candidates...', 60, 'scoring');
    const { bestCandidate } = ScoringEngine.findBestCandidate(doc.body);

    let cleanedHtml: string;
    if (bestCandidate) {
      console.log(`[BMAD_WINNER] Selected candidate with score ${bestCandidate.score}:`, bestCandidate.element);
      this.sendProgress('Pruning final content...', 75, 'pruning');
      const prunedCandidate = ScoringEngine.pruneNode(bestCandidate.element);
      cleanedHtml = prunedCandidate.outerHTML;
    } else {
      console.warn('[BMAD_BYPASS] ScoringEngine failed to find a confident candidate. Falling back to body conversion.');
      cleanedHtml = doc.body.innerHTML;
    }

    this.sendProgress('Converting to markdown...', 85, 'conversion');
    const turndownPreset = (config as any).turndownPreset || 'standard';
    const markdown = await TurndownConfigManager.convert(cleanedHtml, turndownPreset);
    
    const postOptions = { /* ... your post-processing options ... */ };
    const postResult = MarkdownPostProcessor.process(markdown, postOptions);

    const resultPayload = {
      markdown: postResult.markdown,
      metadata: { title: title || 'Untitled', url, capturedAt: new Date().toISOString() },
      processingStats: { qualityScore: bestCandidate ? bestCandidate.score : 80 },
      warnings: postResult.warnings || [],
    };

    const exportJson = this.generateStructuredExport(resultPayload, url, title);
    this.sendComplete(resultPayload.markdown, exportJson, resultPayload.metadata, resultPayload.processingStats, resultPayload.warnings, cleanedHtml);
    
    return {
      exportMd: resultPayload.markdown,
      exportJson,
      metadata: resultPayload.metadata,
      stats: resultPayload.processingStats,
      warnings: resultPayload.warnings,
      originalHtml: cleanedHtml,
    };
  }

  private async processAIMode(
    html: string,
    url: string,
    title: string,
    config: OfflineModeConfig
  ): Promise<ProcessingCompleteMessage['payload']> {
    this.sendProgress('AI mode not yet implemented, using enhanced offline processing...', 20, 'fallback');
    return await this.processOfflineMode(html, url, title, config);
  }

  private async enhanceProcessingResult(
    result: any,
    config: OfflineModeConfig
  ): Promise<any> {
    // ... (existing implementation)
    return result;
  }

  private getPlatformOptimizations(platform: string) {
    // ... (existing implementation)
  }

  private generateStructuredExport(result: any, url: string, title: string): any {
    // ... (existing implementation)
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
