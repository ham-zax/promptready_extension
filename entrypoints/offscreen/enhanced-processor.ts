// Enhanced offscreen processor integrating the new offline capabilities
// Replaces the existing offscreen processing with optimized pipeline

import { browser } from 'wxt/browser';
import { OfflineModeManager, OfflineModeConfig } from '../../core/offline-mode-manager.js';
import { processWithProviderChain } from '../../core/extraction-provider.js';

import { BYOKClient } from '../../pro/byok-client';
import { CaptureDiagnostics, Settings } from '../../lib/types';
import type { AIAttemptOutcome, AIFallbackCode, ExportMetadata } from '../../lib/types';
import { MarkdownPostProcessor } from '../../core/post-processor.js';
import { PerformanceMetrics } from '../../core/performance-metrics.js';
import { getRuntimeProfile, validateRuntimeProfile, assertRuntimeProfileSafe } from '../../lib/runtime-profile.js';
import { resolveEntitlements } from '../../lib/entitlement-policy.js';
import { normalizeByokProvider } from '../../lib/byok-provider.js';
import { buildCanonicalMetadata, canonicalizeDeliveredMarkdown } from '../../lib/markdown-canonicalizer.js';
import { buildByokPrompt } from '../../core/prompts/byok-prompt.js';

const OFFSCREEN_TARGET = 'promptready-offscreen';
const OFFSCREEN_PROCESS_RESPONSE_PREFIX = 'offscreen_process_response_';

interface ProcessingMessage {
  type: 'ENHANCED_OFFSCREEN_PROCESS';
  target?: typeof OFFSCREEN_TARGET;
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
    runId?: string;
    aiGate?: {
      canUseAIMode: boolean;
      lockReason?: 'missing_api_key' | 'daily_limit_reached' | null;
      fallbackCode?: AIFallbackCode;
    };
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
    aiOutcome: AIAttemptOutcome;
    fallbackCode?: AIFallbackCode;
    runId?: string;
  };
}

type AIAttemptTrace = {
  aiAttempted: boolean;
  aiProvider: 'openrouter' | null;
  aiOutcome: AIAttemptOutcome;
  fallbackCode?: AIFallbackCode;
  runId?: string;
};

const DEFAULT_AI_TRACE: AIAttemptTrace = {
  aiAttempted: false,
  aiProvider: null,
  aiOutcome: 'not_attempted',
};

type AiMarkdownQualityResult = {
  accepted: boolean;
  reasons: string[];
};

function countFenceMarkers(markdown: string): number {
  return (markdown.match(/```/g) || []).length;
}

function extractHeadingTexts(markdown: string): string[] {
  return markdown
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      let headingLevel = 0;
      while (headingLevel < trimmed.length && headingLevel < 6 && trimmed[headingLevel] === '#') {
        headingLevel++;
      }
      if (headingLevel === 0 || trimmed[headingLevel] !== ' ') {
        return '';
      }

      return trimmed
        .slice(headingLevel + 1)
        .replace(/#+$/, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
    })
    .filter(Boolean);
}

function comparableMarkdownTextLength(markdown: string): number {
  const withoutCiteBlock = markdown
    .replace(/\r\n?/g, '\n')
    .replace(/^> Source:[^\n]*(?:\n>.*)*\n{0,2}/, '');

  return withoutCiteBlock
    .replace(/```[\s\S]*?```/g, block => block.replace(/```[^\n]*\n?/g, ''))
    .replace(/[#>*_`[\]()!-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .length;
}

function retainedHeadingOrderRatio(baselineHeadings: string[], aiHeadings: string[]): number {
  if (baselineHeadings.length === 0) {
    return 1;
  }

  let cursor = 0;
  let ordered = 0;
  for (const heading of baselineHeadings) {
    const foundAt = aiHeadings.indexOf(heading, cursor);
    if (foundAt !== -1) {
      ordered++;
      cursor = foundAt + 1;
    }
  }

  return ordered / baselineHeadings.length;
}

function removeLeadingCitationBlock(markdown: string): string {
  return markdown
    .replace(/\r\n?/g, '\n')
    .replace(/^> Source:[^\n]*(?:\n>.*)*\n{0,2}/, '');
}

function looksLikeCommandToken(token: string): boolean {
  const trimmed = token.replace(/^\$+\s*/, '').trim();
  if (!trimmed) {
    return false;
  }

  const command = trimmed.split(/\s+/)[0]?.toLowerCase() || '';
  const commandSubcommands: Record<string, Set<string>> = {
    npm: new Set(['add', 'build', 'ci', 'create', 'dev', 'exec', 'i', 'init', 'install', 'link', 'publish', 'remove', 'run', 'start', 'test', 'uninstall', 'update']),
    pnpm: new Set(['add', 'build', 'create', 'dev', 'dlx', 'exec', 'i', 'install', 'link', 'publish', 'remove', 'run', 'start', 'test', 'uninstall', 'update']),
    yarn: new Set(['add', 'build', 'create', 'dev', 'dlx', 'exec', 'install', 'link', 'remove', 'run', 'start', 'test', 'upgrade']),
    git: new Set(['add', 'branch', 'checkout', 'clone', 'commit', 'diff', 'fetch', 'log', 'merge', 'pull', 'push', 'rebase', 'remote', 'reset', 'restore', 'show', 'status', 'switch']),
    docker: new Set(['build', 'compose', 'exec', 'login', 'logs', 'ps', 'pull', 'push', 'run', 'start', 'stop']),
    node: new Set(['--check', '--eval', '--inspect', '-e', 'test']),
    bun: new Set(['add', 'build', 'create', 'dev', 'install', 'remove', 'run', 'start', 'test', 'x']),
    deno: new Set(['bundle', 'cache', 'compile', 'fmt', 'install', 'lint', 'run', 'task', 'test']),
  };
  const words = trimmed.split(/\s+/);
  const subcommand = words[1]?.toLowerCase() || '';

  if (/^\$+\s+/.test(token)) {
    return true;
  }
  if (/[|<>]/.test(trimmed) || /\s-{1,2}[A-Za-z0-9]/.test(trimmed)) {
    return true;
  }
  if (/@[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)?(?:@[^\s`"')\]]+)?/i.test(trimmed) || /https?:\/\//i.test(trimmed)) {
    return true;
  }
  if ((command === 'npx' || command === 'curl' || command === 'python' || command === 'python3') && words.length > 1) {
    return true;
  }

  if (!commandSubcommands[command]?.has(subcommand)) {
    return false;
  }

  const rest = words.slice(2);
  if (rest.length === 0) {
    return true;
  }
  const restText = rest.join(' ');
  if (/[|<>:=]/.test(restText) || /\s-{1,2}[A-Za-z0-9]/.test(` ${restText}`)) {
    return true;
  }
  if (/@[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)?(?:@[^\s`"')\]]+)?/i.test(restText) || /https?:\/\//i.test(restText)) {
    return true;
  }
  if (rest.length === 1 && /^[A-Za-z0-9_.@/-]+$/.test(rest[0]) && !/^[a-z]+s$/i.test(rest[0])) {
    return true;
  }

  return false;
}

function extractTechnicalTokens(markdown: string): string[] {
  const tokens = new Set<string>();
  const source = removeLeadingCitationBlock(markdown);

  for (const match of source.matchAll(/`([^`\n]+)`/g)) {
    tokens.add(match[1].trim());
  }
  for (const match of source.matchAll(/\b[A-Z][A-Z0-9_]{2,}\b/g)) {
    tokens.add(match[0]);
  }
  for (const match of source.matchAll(/@[a-z0-9_.-]+\/[a-z0-9_.-]+(?:@[^\s`"')\]]+)?/gi)) {
    tokens.add(match[0]);
  }
  for (const match of source.matchAll(/(?:^|\$+\s*)(?:npx|npm|pnpm|yarn|curl|docker|git|node|python3?|deno|bun)\b[^\n`]*/gim)) {
    const token = match[0].trim();
    if (looksLikeCommandToken(token)) {
      tokens.add(token.replace(/^\$+\s*/, '').trim());
    }
  }
  for (const match of source.matchAll(/https?:\/\/[^\s`"')\]]+/gi)) {
    tokens.add(match[0]);
  }
  for (const match of source.matchAll(/\bv?\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?\b/g)) {
    tokens.add(match[0]);
  }

  return [...tokens].filter(token => token.length >= 3);
}

function retainedTechnicalTokenRatio(baselineMarkdown: string, aiMarkdown: string): number {
  const baselineTokens = extractTechnicalTokens(baselineMarkdown);
  if (baselineTokens.length < 2) {
    return 1;
  }

  const retained = baselineTokens.filter(token => aiMarkdown.includes(token)).length;
  return retained / baselineTokens.length;
}

function attachWarningsToExportJson(exportJson: any, warnings: string[]): any {
  if (!exportJson || typeof exportJson !== 'object') {
    return exportJson;
  }
  if (!exportJson.processing || typeof exportJson.processing !== 'object') {
    exportJson.processing = {};
  }
  exportJson.processing.warnings = warnings;
  return exportJson;
}

function evaluateAiMarkdownQuality(
  aiMarkdown: string,
  offlineMarkdownBaseline: string,
  rawAiMarkdown: string
): AiMarkdownQualityResult {
  const reasons: string[] = [];

  if (countFenceMarkers(rawAiMarkdown) % 2 !== 0) {
    reasons.push('malformed_fences');
  }

  const baselineHeadings = extractHeadingTexts(offlineMarkdownBaseline);
  if (baselineHeadings.length > 0) {
    const aiHeadingList = extractHeadingTexts(aiMarkdown);
    const aiHeadings = new Set(aiHeadingList);
    const retainedHeadingCount = baselineHeadings.filter(heading => aiHeadings.has(heading)).length;
    const retainedHeadingRatio = retainedHeadingCount / baselineHeadings.length;
    if (retainedHeadingRatio < 0.85) {
      reasons.push('heading_loss');
    }
    if (retainedHeadingOrderRatio(baselineHeadings, aiHeadingList) < 0.85) {
      reasons.push('heading_order_loss');
    }
  }

  const baselineLength = comparableMarkdownTextLength(offlineMarkdownBaseline);
  const aiLength = comparableMarkdownTextLength(aiMarkdown);
  if (baselineLength > 0 && aiLength / baselineLength < 0.7) {
    reasons.push('content_loss');
  }

  if (retainedTechnicalTokenRatio(offlineMarkdownBaseline, aiMarkdown) < 0.9) {
    reasons.push('technical_token_loss');
  }

  return {
    accepted: reasons.length === 0,
    reasons,
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
      if (message?.target && message.target !== OFFSCREEN_TARGET) {
        return false;
      }

      if (message.type === 'ENHANCED_OFFSCREEN_PROCESS') {
        this.handleProcessingRequest(message as ProcessingMessage)
          .then(result => sendResponse({ success: true, data: result }))
          .catch(async error => {
            const response = {
              success: false as const,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
            await this.storeProcessResponse((message as ProcessingMessage).payload?.runId, response);
            sendResponse(response);
          });
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
      const {
        html,
        url,
        title,
        mode,
        customConfig,
        settings,
        selectionHash,
        metadataHtml,
        captureDiagnostics,
        runId,
        aiGate,
      } = message.payload;
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
          selectionHash,
          runId,
          aiGate,
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

      processingResult.runId = runId;
      await this.storeProcessResponse(runId, { success: true, data: processingResult });
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
    aiTrace: AIAttemptTrace = DEFAULT_AI_TRACE,
    progressStage = 'preprocessing',
    progressMessage = 'Cleaning and preparing content...'
  ): Promise<ProcessingCompleteMessage['payload']> {
    this.sendProgress(progressMessage, 20, progressStage);

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

  private withFallbackStat<T extends ProcessingCompleteMessage['payload']>(
    payload: T,
    fallbackCode: AIFallbackCode,
  ): T {
    const stats = payload.stats && typeof payload.stats === 'object'
      ? payload.stats
      : {};
    const existingFallbacks = Array.isArray((stats as any).fallbacksUsed)
      ? (stats as any).fallbacksUsed.filter((item: unknown): item is string => typeof item === 'string')
      : [];
    const fallbacksUsed = existingFallbacks.includes(fallbackCode)
      ? existingFallbacks
      : [...existingFallbacks, fallbackCode];

    return {
      ...payload,
      stats: {
        ...(stats as Record<string, unknown>),
        fallbacksUsed,
      },
    };
  }

  private async processAIMode(
    html: string,
    url: string,
    title: string,
    config: OfflineModeConfig,
    settings: Settings,
    metadataHtml?: string,
    selectionHash?: string,
    runId?: string,
    aiGate?: {
      canUseAIMode: boolean;
      lockReason?: 'missing_api_key' | 'daily_limit_reached' | null;
      fallbackCode?: AIFallbackCode;
    },
  ): Promise<ProcessingCompleteMessage['payload']> {
    let preparedOfflineResult: ProcessingCompleteMessage['payload'] | null = null;

    try {
      const runtimeProfile = getRuntimeProfile();
      const entitlements = resolveEntitlements(settings, runtimeProfile);
      const providerNormalization = normalizeByokProvider(settings.byok?.provider);
      const provider = providerNormalization.canonicalProvider;
      const apiKey = settings.byok?.apiKey || '';
      const model = (settings.byok?.selectedByokModel || settings.byok?.model || '').trim();

      const gateBlockedByDailyLimit =
        aiGate?.fallbackCode === 'ai_fallback:daily_limit_reached' ||
        (!entitlements.hasUnlimitedAccess && entitlements.aiLockReason === 'daily_limit_reached');

      if (gateBlockedByDailyLimit) {
        const warningCode: AIFallbackCode = 'ai_fallback:daily_limit_reached';
        this.sendProgress('Daily BYOK AI limit reached. Using offline mode...', 50, 'fallback');
        const offlineResult = await this.processOfflineMode(
          html,
          url,
          title,
          config,
          metadataHtml,
          {
            aiAttempted: false,
            aiProvider: null,
            aiOutcome: 'fallback_daily_limit_reached',
            fallbackCode: warningCode,
            runId,
          }
        );
        offlineResult.warnings = [...(offlineResult.warnings || []), warningCode];
        attachWarningsToExportJson(offlineResult.exportJson, offlineResult.warnings);
        return this.withFallbackStat(offlineResult, warningCode);
      }

      if (!providerNormalization.isSupported || provider !== 'openrouter') {
        const warningCode: AIFallbackCode = 'ai_fallback:provider_not_supported';
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
            runId,
          }
        );
        offlineResult.warnings = [...(offlineResult.warnings || []), warningCode];
        attachWarningsToExportJson(offlineResult.exportJson, offlineResult.warnings);
        return this.withFallbackStat(offlineResult, warningCode);
      }

      if (providerNormalization.wasLegacyAlias) {
        console.info('[AI Mode] Normalized legacy BYOK provider alias to OpenRouter.');
      }

      if (!apiKey.trim()) {
        const warningCode: AIFallbackCode = 'ai_fallback:missing_openrouter_key';
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
            runId,
          }
        );
        offlineResult.warnings = [...(offlineResult.warnings || []), warningCode];
        attachWarningsToExportJson(offlineResult.exportJson, offlineResult.warnings);
        return this.withFallbackStat(offlineResult, warningCode);
      }

      if (!model) {
        const warningCode: AIFallbackCode = 'ai_fallback:missing_openrouter_model';
        console.warn('[AI Mode] Missing OpenRouter model. Falling back to offline mode.');
        this.sendProgress('No OpenRouter model selected. Using offline mode...', 50, 'fallback');
        const offlineResult = await this.processOfflineMode(
          html,
          url,
          title,
          config,
          metadataHtml,
          {
            aiAttempted: false,
            aiProvider: null,
            aiOutcome: 'fallback_missing_model',
            fallbackCode: warningCode,
            runId,
          }
        );
        offlineResult.warnings = [...(offlineResult.warnings || []), warningCode];
        attachWarningsToExportJson(offlineResult.exportJson, offlineResult.warnings);
        return this.withFallbackStat(offlineResult, warningCode);
      }

      const capturedAt = new Date().toISOString();
      const offlineBaselineResult = await this.processOfflineMode(
        html,
        url,
        title,
        config,
        metadataHtml,
        { aiAttempted: false, aiProvider: null, aiOutcome: 'not_attempted', runId },
        'offline-baseline',
        'Preparing offline Markdown baseline...'
      );
      const offlineWarnings = [...(offlineBaselineResult.warnings || [])];
      const canonicalMetadata = buildCanonicalMetadata(
        offlineBaselineResult.metadata as Partial<ExportMetadata>,
        { title, url, capturedAt, selectionHash }
      );
      const offlineMarkdownBaseline = canonicalizeDeliveredMarkdown(
        offlineBaselineResult.exportMd || '',
        canonicalMetadata,
        offlineWarnings
      );
      const offlineExportJson = offlineBaselineResult.exportJson && typeof offlineBaselineResult.exportJson === 'object'
        ? { ...offlineBaselineResult.exportJson }
        : this.generateStructuredExport(
          { markdown: offlineMarkdownBaseline, metadata: canonicalMetadata, warnings: offlineWarnings },
          url,
          title
        );
      offlineExportJson.metadata = { ...(offlineExportJson.metadata || {}), ...canonicalMetadata };
      if (!offlineExportJson.content || typeof offlineExportJson.content !== 'object') {
        offlineExportJson.content = {};
      }
      offlineExportJson.content.markdown = offlineMarkdownBaseline;
      attachWarningsToExportJson(offlineExportJson, offlineWarnings);

      preparedOfflineResult = {
        ...offlineBaselineResult,
        exportMd: offlineMarkdownBaseline,
        exportJson: offlineExportJson,
        metadata: canonicalMetadata,
        warnings: offlineWarnings,
        originalHtml: html,
        aiAttempted: false,
        aiProvider: null,
        aiOutcome: 'not_attempted',
        runId,
      };

      this.sendProgress('Sending request to OpenRouter...', 35, 'ai-processing');
      this.sendProgress(
        runtimeProfile.isDevelopment
          ? 'Using BYOK in development...'
          : 'Using your BYOK key for AI processing...',
      40,
      'byok-processing');

      const byokPrompt = buildByokPrompt({
        html,
        offlineMarkdownBaseline,
        url,
        title,
        selectionHash,
        metadataHtml,
        capturedAt,
        customPrompt: settings.byok?.customPrompt,
      });

      const byokResult = await BYOKClient.makeRequest(
        { prompt: byokPrompt, maxTokens: 4000, temperature: 0.7 },
        {
          apiBase: settings.byok?.apiBase || 'https://openrouter.ai/api/v1',
          apiKey: apiKey.trim(),
          model,
        }
      );

      const processedMarkdown = byokResult.content;
      const aiWarnings = providerNormalization.wasLegacyAlias
        ? ['ai_provider_normalized:legacy_alias']
        : [];

      this.sendProgress('Post-processing AI response...', 80, 'postprocessing');
      const postResult = MarkdownPostProcessor.process(processedMarkdown, {});
      const canonicalMarkdown = canonicalizeDeliveredMarkdown(postResult.markdown, canonicalMetadata, aiWarnings);
      const qualityGate = evaluateAiMarkdownQuality(canonicalMarkdown, offlineMarkdownBaseline, processedMarkdown);
      if (!qualityGate.accepted) {
        const warningCode: AIFallbackCode = 'ai_fallback:quality_gate_failed';
        console.warn('[AI Mode] AI output failed quality gate:', qualityGate.reasons.join(','));
        const qualityWarnings = qualityGate.reasons.map(reason => `ai_quality_gate:${reason}`);
        const fallbackWarnings = Array.from(new Set([
          ...(preparedOfflineResult.warnings || []),
          ...aiWarnings,
          warningCode,
          ...qualityWarnings,
        ]));
        const fallbackExportJson = preparedOfflineResult.exportJson && typeof preparedOfflineResult.exportJson === 'object'
          ? { ...preparedOfflineResult.exportJson }
          : { version: '1.0' };
        fallbackExportJson.metadata = { ...(fallbackExportJson.metadata || {}), ...canonicalMetadata };
        if (!fallbackExportJson.content || typeof fallbackExportJson.content !== 'object') {
          fallbackExportJson.content = {};
        }
        fallbackExportJson.content.markdown = preparedOfflineResult.exportMd;
        attachWarningsToExportJson(fallbackExportJson, fallbackWarnings);

        return this.withFallbackStat({
          ...preparedOfflineResult,
          exportJson: fallbackExportJson,
          warnings: fallbackWarnings,
          aiAttempted: true,
          aiProvider: 'openrouter',
          aiOutcome: 'fallback_quality_gate_failed',
          fallbackCode: warningCode,
          runId,
        }, warningCode);
      }

      const exportJson = this.generateStructuredExport(postResult, url, title);
      if (exportJson?.content && typeof exportJson.content === 'object') {
        exportJson.content.markdown = canonicalMarkdown;
      }
      exportJson.metadata = { ...(exportJson.metadata || {}), ...canonicalMetadata };
      attachWarningsToExportJson(exportJson, aiWarnings);

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
        runId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown AI processing error';
      const isCancelled = /cancel|abort/i.test(errorMessage);
      const warningCode: AIFallbackCode = isCancelled
        ? 'ai_fallback:cancelled'
        : 'ai_fallback:request_failed';
      const aiOutcome: AIAttemptOutcome = isCancelled
        ? 'fallback_cancelled'
        : 'fallback_request_failed';

      console.error('[AI Mode] Processing failed:', errorMessage);
      this.sendError(errorMessage, isCancelled ? 'cancelled' : 'ai-processing', true, runId);
      this.sendProgress('AI processing failed, falling back to offline mode...', 90, 'fallback');

      if (preparedOfflineResult) {
        const fallbackWarnings = [...(preparedOfflineResult.warnings || []), warningCode];
        attachWarningsToExportJson(preparedOfflineResult.exportJson, fallbackWarnings);
        return this.withFallbackStat({
          ...preparedOfflineResult,
          warnings: fallbackWarnings,
          aiAttempted: true,
          aiProvider: 'openrouter',
          aiOutcome,
          fallbackCode: warningCode,
          runId,
        }, warningCode);
      }

      const offlineResult = await this.processOfflineMode(
        html,
        url,
        title,
        config,
        metadataHtml,
        {
          aiAttempted: true,
          aiProvider: 'openrouter',
          aiOutcome,
          fallbackCode: warningCode,
          runId,
        }
      );
      offlineResult.warnings = [...(offlineResult.warnings || []), warningCode];
      attachWarningsToExportJson(offlineResult.exportJson, offlineResult.warnings);
      return this.withFallbackStat(offlineResult, warningCode);
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

  private async storeProcessResponse(
    runId: string | undefined,
    response: { success: true; data: ProcessingCompleteMessage['payload'] } | { success: false; error?: string }
  ): Promise<void> {
    if (!runId) {
      return;
    }

    try {
      const sessionStorage = (browser as any)?.storage?.session;
      if (!sessionStorage?.set) {
        return;
      }

      await sessionStorage.set({
        [`${OFFSCREEN_PROCESS_RESPONSE_PREFIX}${runId}`]: response,
      });
    } catch (error) {
      console.warn('[EnhancedOffscreenProcessor] Failed to store processing response handoff:', error);
    }
  }

  private sendError(error: string, stage: string, fallbackUsed = false, runId?: string): void {
    browser.runtime.sendMessage({
      type: 'PROCESSING_ERROR',
      payload: {
        error,
        stage,
        fallbackUsed,
        runId,
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
