// Enhanced background script integrating the new offline capabilities system
// This replaces the existing background.ts with improved processing pipeline

import { browser } from 'wxt/browser';
import { Storage } from '../lib/storage.js';
import { getRuntimeProfile, validateRuntimeProfile, assertRuntimeProfileSafe } from '../lib/runtime-profile.js';
import { sanitizeCapturePayload } from '../lib/capture-contract.js';
import type { ExportMetadata } from '../lib/types.js';

import { ContentQualityValidator } from '../core/content-quality-validator.js';
import { SessionMetricsStore } from '../core/metrics-session-store.js';

export default defineBackground(() => {
  const runtimeProfile = getRuntimeProfile();
  const runtimeValidation = validateRuntimeProfile(runtimeProfile);
  console.log('[RuntimeProfile] Effective profile:', runtimeProfile);
  if (runtimeValidation.warnings.length > 0) {
    console.warn('[RuntimeProfile] Warnings:', runtimeValidation.warnings);
  }
  assertRuntimeProfileSafe(runtimeProfile);

  console.log('PromptReady Enhanced Background Service Worker initialized');

  // Initialize the enhanced processing pipeline
  const processor = new EnhancedContentProcessor();

  // Handle keyboard shortcut
  browser.commands?.onCommand.addListener(async (command) => {
    console.log('Keyboard command received:', command);
    if (command === 'capture-selection') {
      await processor.handleCaptureCommand();
    }
  });

  // Handle messages from content script and popup
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background script received message:', message);
    return processor.handleMessage(message, sender, sendResponse);
  });
});

/**
 * Enhanced content processing pipeline with offline capabilities
 */
type ExportData = {
  markdown: string;
  json: any;
  metadata: any;
  qualityReport?: any;
  warnings?: string[];
  aiAttempted?: boolean;
  aiProvider?: 'openrouter' | null;
  aiOutcome?: 'not_attempted' | 'success' | 'fallback_provider' | 'fallback_missing_key' | 'fallback_request_failed';
  fallbackCode?: 'ai_fallback:provider_not_supported' | 'ai_fallback:missing_openrouter_key' | 'ai_fallback:request_failed';
};

function isExportData(value: unknown): value is ExportData {
  if (!value || typeof value !== 'object') return false;
  const v = value as any;
  return typeof v.markdown === 'string' && 'json' in v && 'metadata' in v;
}

class EnhancedContentProcessor {
  private readonly offscreenPath = '/offscreen.html' as const;
  private readonly EXPORT_DATA_KEY = 'currentExportData';
  private offscreenCreationPromise: Promise<void> | null = null;
  // Simple dedupe cache for COPY_TO_CLIPBOARD forwarding to avoid message storms
  private recentCopyFingerprints: Map<string, number> = new Map(); // fingerprint -> timestamp

  // Map selectionHash -> tabId so we can forward processing results back to the originating tab
  private pendingCaptureMap: Map<string, number> = new Map();

  // Gatekeeper to prevent duplicate long-running processing for the same selectionHash
  private inProgressRequests: Set<string> = new Set();

  // Periodic cleanup timer for fingerprints
  private fingerprintCleanupTimer: any = null;
  private captureDebounceTimer: any = null;
  private readonly CAPTURE_DEBOUNCE_MS = 500; // 500ms debounce

  constructor() {
    // Setup periodic cleanup of old fingerprints every 2 minutes
    this.fingerprintCleanupTimer = setInterval(() => {
      this.cleanupOldFingerprints();
    }, 2 * 60 * 1000);
  }

  private cleanupOldFingerprints(): void {
    const now = Date.now();
    const pruned: string[] = [];
    for (const [fp, ts] of Array.from(this.recentCopyFingerprints.entries())) {
      if (now - ts > 60 * 1000) {
        this.recentCopyFingerprints.delete(fp);
        pruned.push(fp);
      }
    }
    if (pruned.length > 0) {
      console.log(`[Background] Pruned ${pruned.length} old copy fingerprints`);
    }
  }

  /**
   * Store export data in session storage to survive service worker termination
   */
  private async setCurrentExportData(data: ExportData | null): Promise<void> {
    try {
      if (data) {
        await browser.storage.session.set({ [this.EXPORT_DATA_KEY]: data });
      } else {
        await browser.storage.session.remove([this.EXPORT_DATA_KEY]);
      }
    } catch (error: any) {
      console.error('Failed to store export data:', error);
      throw error;
    }
  }

  /**
   * Retrieve export data from session storage
   */
  private async getCurrentExportData(): Promise<ExportData | null> {
    try {
      const result = (await browser.storage.session.get([this.EXPORT_DATA_KEY])) as Record<string, unknown>;
      const raw = result[this.EXPORT_DATA_KEY];
      return isExportData(raw) ? raw : null;
    } catch (error: any) {
      console.error('Failed to retrieve export data:', error);
      return null;
    }
  }

  private buildCanonicalMetadata(
    sourceMetadata: Partial<ExportMetadata> | undefined,
    fallback?: Partial<ExportMetadata>
  ): ExportMetadata {
    const source = sourceMetadata || {};
    const fallbackSource = fallback || {};
    return {
      title: typeof source.title === 'string' && source.title.trim()
        ? source.title.trim()
        : (fallbackSource.title || 'Untitled Page'),
      url: typeof source.url === 'string' && source.url.trim()
        ? source.url.trim()
        : (fallbackSource.url || 'Unknown URL'),
      capturedAt: typeof source.capturedAt === 'string' && source.capturedAt.trim()
        ? source.capturedAt
        : (fallbackSource.capturedAt || new Date().toISOString()),
      selectionHash: typeof source.selectionHash === 'string' && source.selectionHash.trim()
        ? source.selectionHash
        : (fallbackSource.selectionHash || `bg-${Date.now()}`),
      publishedAt: typeof source.publishedAt === 'string' && source.publishedAt.trim()
        ? source.publishedAt
        : undefined,
      publishedAtText: typeof source.publishedAtText === 'string' && source.publishedAtText.trim()
        ? source.publishedAtText
        : undefined,
      updatedAt: typeof source.updatedAt === 'string' && source.updatedAt.trim()
        ? source.updatedAt
        : undefined,
      updatedAtText: typeof source.updatedAtText === 'string' && source.updatedAtText.trim()
        ? source.updatedAtText
        : undefined,
      byline: typeof source.byline === 'string' && source.byline.trim()
        ? source.byline.trim()
        : undefined,
    };
  }

  /**
   * Worker-safe markdown canonicalization. This keeps background independent
   * from DOM-only extraction modules.
   */
  private canonicalizeDeliveredMarkdown(
    markdown: string,
    metadata: ExportMetadata,
    warnings: string[] = []
  ): string {
    const normalizedMetadata: ExportMetadata = {
      title: metadata?.title || 'Untitled Page',
      url: metadata?.url || '',
      capturedAt: metadata?.capturedAt || new Date().toISOString(),
      selectionHash: metadata?.selectionHash || 'N/A',
      publishedAt: metadata?.publishedAt,
      publishedAtText: metadata?.publishedAtText,
      updatedAt: metadata?.updatedAt,
      updatedAtText: metadata?.updatedAtText,
      byline: metadata?.byline,
    };

    let result = this.normalizeUnicodeWhitespace(markdown || '');
    result = this.stripLeadingCitationBlock(result);
    result = this.sanitizeRiskyMarkdown(result, warnings);
    result = this.stripResidualUiNoiseLines(result, warnings);
    result = this.normalizeMarkdownSpacing(result);
    result = this.ensurePrimaryHeading(result, normalizedMetadata.title);

    if (!result || result.trim().length === 0) {
      result = `# ${normalizedMetadata.title}`;
    }

    return this.insertCiteFirstBlock(result, normalizedMetadata);
  }

  private normalizeInputText(value: string): string {
    return this.normalizeUnicodeWhitespace(
      value
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<!\[cdata\[[\s\S]*?\]\]>/gi, ' ')
        .replace(/-->/g, ' ')
    ).replace(/\s+/g, ' ').trim();
  }

  private normalizeUnicodeWhitespace(value: string): string {
    if (!value) {
      return '';
    }
    const joinerPattern = /((?:\p{L}|\p{N}))(?:\u200B|\u200C|\u200D|\u2060|\uFEFF|\u180E)+(?=(?:\p{L}|\p{N}))/gu;
    return value
      .replace(joinerPattern, '$1 ')
      .replace(/(?:\u200B|\u200C|\u200D|\u2060|\uFEFF|\u180E)/g, '')
      .replace(/[\u00A0\u2000-\u200A\u2028\u2029]/g, ' ');
  }

  private stripLeadingCitationBlock(markdown: string): string {
    if (!markdown) {
      return markdown;
    }

    const lines = markdown.split('\n');
    let index = 0;
    while (index < lines.length && lines[index].trim() === '') {
      index++;
    }
    if (index >= lines.length || !/^\s*>\s*source:/i.test(lines[index])) {
      return markdown;
    }

    index++;
    while (index < lines.length) {
      const line = lines[index];
      if (!/^\s*>/.test(line)) {
        break;
      }
      const text = line.replace(/^\s*>\s?/, '').trim().toLowerCase();
      if (
        !text ||
        text.startsWith('captured:') ||
        text.startsWith('hash:') ||
        text.startsWith('published:') ||
        text.startsWith('updated:') ||
        text.startsWith('by:')
      ) {
        index++;
        continue;
      }
      break;
    }

    while (index < lines.length && lines[index].trim() === '') {
      index++;
    }
    return lines.slice(index).join('\n');
  }

  private sanitizeRiskyMarkdown(markdown: string, warnings: string[]): string {
    if (!markdown) {
      return markdown;
    }

    const before = markdown;
    const sanitized = markdown
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/\bon[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/(?:java\s*script|vb\s*script)\s*:/gi, 'blocked:')
      .replace(/data\s*:\s*text\/html/gi, 'data:text/blocked')
      .replace(/\balert\s*\(/gi, 'blocked_call(')
      .replace(/%3c\/?script%3e/gi, ' ');

    if (sanitized !== before) {
      warnings.push('Sanitized potentially unsafe markdown payload');
    }
    return this.normalizeUnicodeWhitespace(sanitized);
  }

  private stripResidualUiNoiseLines(markdown: string, warnings: string[]): string {
    if (!markdown) {
      return markdown;
    }

    const lines = markdown.split('\n');
    const filtered = lines.filter((line) => {
      const normalized = this.normalizeInputText(line).toLowerCase();
      const trimmed = line.trim();

      if (!normalized) return true;
      if (/^#{1,6}\s/.test(trimmed)) return true;

      const isUiNoise =
        normalized.length <= 220 &&
        (
          /accept all .*cookies?|manage (cookie|privacy) preferences|allow all cookies/.test(normalized) ||
          /popup ad|tracking cookies? to continue/.test(normalized) ||
          /limit my search to|advanced search: by author|see the search faq|join reddit|view more:/.test(normalized)
        );
      const isSocialActionLine =
        /^(share|save|copy link|print|whatsapp|twitter|facebook|instagram|linkedin|telegram|x)$/i.test(trimmed) ||
        /^\[(share|save|copy link|print|whatsapp|twitter|facebook|instagram|linkedin|telegram|x)\]\([^)]+\)$/i.test(trimmed);
      const isStandaloneMarker = trimmed === '*' || trimmed === '•';
      const isTrivialCounter = /^\d{1,6}$/.test(trimmed) || /^links from:?$/i.test(trimmed);

      return !(isUiNoise || isSocialActionLine || isStandaloneMarker || isTrivialCounter);
    });

    if (filtered.length !== lines.length) {
      warnings.push('Removed residual UI-noise lines from markdown');
    }
    return filtered.join('\n');
  }

  private normalizeMarkdownSpacing(markdown: string): string {
    if (!markdown) {
      return markdown;
    }
    return markdown
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\s+$/gm, '')
      .trim();
  }

  private normalizeHeadingForComparison(value: string): string {
    return this.normalizeInputText(value)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private areHeadingsEquivalent(source: string, candidate: string): boolean {
    if (!source || !candidate) return false;
    if (source === candidate) return true;
    if (source.length >= 20 && candidate.includes(source)) return true;
    if (candidate.length >= 20 && source.includes(candidate)) return true;
    return false;
  }

  private ensurePrimaryHeading(markdown: string, title: string): string {
    const normalizedTitle = this.normalizeInputText(title);
    if (!normalizedTitle) {
      return markdown;
    }

    const body = markdown.trimStart();
    if (!body) {
      return `# ${normalizedTitle}`;
    }

    const h1Match = body.match(/^#\s+(.+)$/m);
    if (
      h1Match &&
      this.areHeadingsEquivalent(
        this.normalizeHeadingForComparison(normalizedTitle),
        this.normalizeHeadingForComparison(h1Match[1])
      )
    ) {
      return markdown;
    }

    return `# ${normalizedTitle}\n\n${markdown}`;
  }

  private formatMetadataTimestamp(value?: string): string {
    if (!value) {
      return '';
    }
    const normalized = this.normalizeInputText(value);
    if (!normalized) {
      return '';
    }
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
    return normalized;
  }

  private insertCiteFirstBlock(markdown: string, metadata: ExportMetadata): string {
    let result = markdown.trim();
    const title = (metadata.title || 'Untitled Page').trim();
    const url = (metadata.url || '').trim() || 'Unknown URL';
    const hash = (metadata.selectionHash || 'N/A').trim() || 'N/A';

    const captured = this.formatMetadataTimestamp(metadata.capturedAt) || new Date().toISOString();
    const published = this.formatMetadataTimestamp(metadata.publishedAt || metadata.publishedAtText);
    const updated = this.formatMetadataTimestamp(metadata.updatedAt || metadata.updatedAtText);
    const byline = this.normalizeInputText(metadata.byline || '');

    const citationLines = [
      `> Source: [${title}](${url})`,
      `> Captured: ${captured}`,
    ];
    if (published) {
      citationLines.push(`> Published: ${published}`);
    }
    if (updated) {
      citationLines.push(`> Updated: ${updated}`);
    }
    if (byline) {
      citationLines.push(`> By: ${byline}`);
    }
    citationLines.push(`> Hash: ${hash}`);

    const citationHeader = `${citationLines.join('\n')}\n\n`;
    const hasPrimaryHeading = /^#\s+/m.test(result);
    if (!hasPrimaryHeading) {
      result = `# ${title}\n\n${result.trimStart()}`;
    }

    return citationHeader + result;
  }

  /**
   * Handle keyboard shortcut activation
   */
  async handleCaptureCommand(): Promise<void> {
    // Clear any pending capture
    if (this.captureDebounceTimer) {
      clearTimeout(this.captureDebounceTimer);
    }

    // Debounce: Wait 500ms before actually capturing
    this.captureDebounceTimer = setTimeout(async () => {
      try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

        if (!tab.id) {
          throw new Error('No active tab found');
        }

        // Check if tab is accessible
        if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
          this.broadcastError('Cannot capture content from this page').catch(console.error);
          return;
        }

        console.log('Initiating capture for tab:', tab.id);
        const settings = await Storage.getSettings();
        const capturePolicy = settings.processing?.capturePolicy;

        const ok = await this.ensureContentScript(tab.id);
        if (!ok) {
          console.error('Content script ping failed for tab:', tab.id);
          this.broadcastError('Content script not available. Please refresh the page.');
          return;
        }

        // Send capture request
        await browser.tabs.sendMessage(tab.id, {
          type: 'CAPTURE_SELECTION',
          payload: {
            tabId: tab.id,
            capturePolicy,
          },
        });

      } catch (error: any) {
        console.error('Capture command failed:', error);
        this.broadcastError('Failed to capture content. Please try again.').catch(console.error);
      }
    }, this.CAPTURE_DEBOUNCE_MS);
  }

  /**
   * Handle messages from various components
   */
  async handleMessage(message: any, _sender: any, sendResponse: any): Promise<boolean> {
    try {
      switch (message.type) {
        case 'CAPTURE_COMPLETE':
          // Pass sender so we can remember the originating tab for later forwarding
          await this.handleCaptureComplete(message, _sender);
          break;

        case 'CAPTURE_REQUEST':
          await this.handleCaptureRequest(message);
          break;

        case 'EXPORT_REQUEST':
          await this.handleExportRequest(message);
          break;

        case 'COPY_TO_CLIPBOARD':
          await this.handleCopyToClipboard(message);
          break;

        case 'PROCESSING_COMPLETE':
          await this.handleProcessingComplete(message);
          break;

        case 'PROCESSING_ERROR':
          await this.handleProcessingError(message);
          break;

        case 'PROCESSING_PROGRESS':
          // Forward progress updates to popup with reduced retries for performance
          this.broadcastMessage(message, 0).catch(_error => {
            // Silently ignore progress broadcast failures to avoid console spam
          });
          break;

        case 'GET_PROCESSING_STATS':
          sendResponse(await this.getProcessingStats());
          break;

        case 'CLEAR_CACHE':
          await this.clearProcessingCache();
          sendResponse({ success: true });
          break;

        case 'GET_PERFORMANCE_ANALYTICS':
          try {
            await this.ensureOffscreenDocument();
            const analyticsResponse = await browser.runtime.sendMessage({
              type: 'GET_PERFORMANCE_ANALYTICS',
              payload: {}
            });
            sendResponse({
              success: true,
              data: analyticsResponse?.data || {}
            });
          } catch (error: any) {
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : 'Failed to get analytics'
            });
          }
          break;

        case 'GET_REAL_TIME_METRICS':
          try {
            await this.ensureOffscreenDocument();
            const metricsResponse = await browser.runtime.sendMessage({
              type: 'GET_REAL_TIME_METRICS',
              payload: {}
            });
            sendResponse({
              success: true,
              data: metricsResponse?.data || {}
            });
          } catch (error: any) {
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : 'Failed to get metrics'
            });
          }
          break;

        case 'CONTENT_SCRIPT_READY':
          console.log('Content script ready signal received from tab');
          break;

        default:
          console.warn('Unknown message type:', message.type);
          break;
      }
    } catch (error: any) {
      console.error('Message handling failed:', error);
      this.broadcastError(`Message handling failed: ${error instanceof Error ? error.message : 'Unknown error'}`).catch(console.error);
    }

    return true; // Keep message channel open
  }

  /**
   * Handle capture completion from content script
   */
  async handleCaptureComplete(message: any, sender: any): Promise<void> {
    // Gatekeeper: ensure only one processing pipeline runs per unique selectionHash
    const selectionHash = message?.payload?.selectionHash;

    if (!selectionHash) {
      // If there's no selectionHash, proceed but log a warning — we can't gate duplicate requests
      console.warn('[BMAD_GATE] Missing selectionHash for incoming capture; proceeding without gate');
    } else {
      if (this.inProgressRequests.has(selectionHash)) {
        console.warn(`[BMAD_GATE] Request for hash ${selectionHash} is already in progress. Aborting duplicate.`);
        return; // Abort duplicate request early
      }
      // Register this selectionHash as in-progress
      this.inProgressRequests.add(selectionHash);
      console.log(`[BMAD_GATE] Registered in-progress request for hash ${selectionHash}`);
    }

    try {
      const canonicalCapture = sanitizeCapturePayload(message?.payload);
      const { html, url, title, metadataHtml, captureDiagnostics } = canonicalCapture;

      if (captureDiagnostics) {
        console.log('[Background] Capture diagnostics:', captureDiagnostics);
      }

      // Determine originating tab id from sender (content scripts send messages with sender.tab)
      const originatingTabId = sender?.tab?.id || canonicalCapture.tabId;
      if (selectionHash && originatingTabId) {
        try {
          this.pendingCaptureMap.set(selectionHash, originatingTabId);
        } catch (e: any) {
          console.warn('[Background] Failed to record pending capture mapping:', e);
        }
      }

      const settings = await Storage.getSettings();

      console.log(`Processing content: ${title} (${html.length} chars)`);

      // Validate content
      if (!html || html.trim().length === 0) {
        throw new Error('No content captured');
      }

      // Ensure offscreen document exists
      await this.ensureOffscreenDocument();

      // Send to enhanced offscreen processor with direct response
      const response = await browser.runtime.sendMessage({
        type: 'ENHANCED_OFFSCREEN_PROCESS',
        payload: {
          html,
          url,
          title,
          metadataHtml,
          captureDiagnostics,
          selectionHash,
          mode: settings.mode,
          useReadability: settings.useReadability !== false,
          renderer: settings.renderer || 'turndown',
          customConfig: undefined,
          settings: settings, // Pass full settings to offscreen document
        },
      });

      // Handle the direct response
      if (!response.success) {
        throw new Error(response.error || 'Processing failed');
      }

      // Check performance overhead after processing
      const perfMetrics = await import('../core/performance-metrics.js');
      const perfInstance = perfMetrics.PerformanceMetrics.getInstance();
      const overheadAcceptable = perfInstance.checkPerformanceOverhead();
      if (!overheadAcceptable) {
        console.warn('[Background] Performance overhead detected - consider optimizing pipeline');
      }

      // Process the successful result
      await this.handleProcessingComplete({ payload: response.data });

	    } catch (error: any) {
	      console.error('Content processing failed:', error);
	      // Recovery is owned by the offscreen pipeline (DOM context). In the service
	      // worker context we fail closed and surface a clear error to the user.
	      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
	      this.broadcastError(`Failed to process content: ${errorMessage}`).catch(console.error);
	    } finally {
      // Ensure we always clear the gatekeeper entry for this selectionHash so future requests can proceed
      try {
        if (selectionHash && this.inProgressRequests.has(selectionHash)) {
          this.inProgressRequests.delete(selectionHash);
          console.log(`[BMAD_GATE] Cleared in-progress request for hash ${selectionHash}`);
        }
        // Also cleanup pendingCaptureMap after a delay to prevent memory leak
        // Keep it briefly in case of retries, but ensure eventual cleanup
        if (selectionHash) {
          setTimeout(() => {
            if (this.pendingCaptureMap.has(selectionHash)) {
              this.pendingCaptureMap.delete(selectionHash);
              console.log(`[BMAD_GATE] Cleaned up stale capture mapping for hash ${selectionHash}`);
            }
          }, 5000); // 5 second grace period
        }
      } catch (cleanupErr: any) {
        console.warn('[BMAD_GATE] Failed to clear in-progress request:', cleanupErr);
      }
    }
  }

  /**
   * Handle capture request from popup
   */
  async handleCaptureRequest(message: any): Promise<void> {
    try {
      const tabId = message.payload?.tabId;
      const settings = await Storage.getSettings();
      const capturePolicy = settings.processing?.capturePolicy;
      if (!tabId) {
        throw new Error('No tab ID provided');
      }

      console.log(`[Background] Sending CAPTURE_SELECTION to tab ${tabId}`);

      try {
        // Send capture request to content script
        await browser.tabs.sendMessage(tabId, {
          type: 'CAPTURE_SELECTION',
          payload: {
            tabId,
            capturePolicy,
          },
        });

        console.log(`[Background] CAPTURE_SELECTION sent successfully to tab ${tabId}`);
      } catch (messageError: any) {
        console.warn('[Background] Content script not responding, attempting to inject:', messageError.message);

        // Try to inject content script dynamically
        try {
	          await browser.scripting.executeScript({
	            target: { tabId },
	            files: ['/content-scripts/content.js']
	          });

          console.log('[Background] Content script injected, retrying message...');

          // Wait a moment for script to initialize
          await new Promise(resolve => setTimeout(resolve, 100));

          // Retry the message
          await browser.tabs.sendMessage(tabId, {
            type: 'CAPTURE_SELECTION',
            payload: {
              tabId,
              capturePolicy,
            },
          });

          console.log('[Background] CAPTURE_SELECTION successful after injection');
        } catch (injectError: any) {
          console.error('[Background] Failed to inject content script:', injectError);
          throw messageError; // Throw original error with better context
        }
      }

    } catch (error: any) {
      console.error('[Background] Capture request failed:', error);
      console.error('[Background] Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });

      // More descriptive error message
      let errorMessage = 'Failed to initiate capture';
      if (error.message.includes('Receiving end does not exist')) {
        errorMessage = 'Content script not available - try refreshing the page';
      } else if (error.message.includes('Could not establish connection')) {
        errorMessage = 'Cannot connect to page - try reloading the extension';
      } else if (error.message.includes('Cannot access')) {
        errorMessage = 'Cannot access this page - try on a regular website';
      }

      this.broadcastError(errorMessage).catch(console.error);
    }
  }

  /**
   * Handle processing completion from offscreen document
   */
  async handleProcessingComplete(message: any): Promise<void> {
    try {
      const {
        exportMd,
        exportJson,
        metadata,
        stats,
        warnings: payloadWarnings,
        originalHtml,
        aiAttempted = false,
        aiProvider = null,
        aiOutcome = 'not_attempted',
        fallbackCode,
      } = message.payload;
      const warnings: string[] = Array.isArray(payloadWarnings) ? [...payloadWarnings] : [];

      // BMAD TRACE: log what we received from offscreen before any insertion
      console.log('[BMAD_TRACE] Background received from offscreen:', (exportMd || '').substring(0, 100));

      const sourceMetadata = (metadata || exportJson?.metadata || {}) as Partial<ExportMetadata>;
      const canonicalMetadata = this.buildCanonicalMetadata(sourceMetadata);

      // Enforce one canonical finalization path for every delivery route.
      const finalMd = this.canonicalizeDeliveredMarkdown(exportMd || '', canonicalMetadata, warnings);

      // BMAD TRACE: log the finalized markdown after insertion (or unchanged)
      console.log('[BMAD_TRACE] Background after cite block insertion:', (finalMd || '').substring(0, 100));

      // If we have a selectionHash -> tabId mapping, forward the raw markdown to that tab's content script.
      try {
        const selectionHash = sourceMetadata.selectionHash;
        if (selectionHash) {
          const tabId = this.pendingCaptureMap.get(selectionHash);
          if (tabId) {
            console.log(`[Background] Forwarding PROCESSING_COMPLETE exportMd to originating tab ${tabId} for selection ${selectionHash}`);
            try {
              // Send the markdown directly to the content script so it can perform the clipboard write
              await browser.tabs.sendMessage(tabId, {
                type: 'COPY_TO_CLIPBOARD',
                payload: { content: finalMd },
              });
            } catch (sendErr: any) {
              console.warn('[Background] Failed to send processing result to content script:', sendErr);

              // Attempt to inject content script and retry once
              try {
	                await browser.scripting.executeScript({
	                  target: { tabId },
	                  files: ['/content-scripts/content.js'],
	                });
                // Short delay to allow the content script to initialize
                await new Promise((r) => setTimeout(r, 150));

                await browser.tabs.sendMessage(tabId, {
                  type: 'COPY_TO_CLIPBOARD',
                  payload: { content: finalMd },
                });

                console.log('[Background] ✅ Forwarded processing result after injection for tab', tabId);
              } catch (injectErr: any) {
                console.warn('[Background] Injection/retry failed; using offscreen clipboard fallback:', injectErr);
                try {
                  // Fallback: use offscreen document to perform clipboard write
                  await this.ensureOffscreenDocument();
                  const offRes: any = await browser.runtime.sendMessage({
                    type: 'OFFSCREEN_COPY',
                    payload: { content: finalMd },
                  });

                  if (offRes && offRes.success) {
                    console.log('[Background] ✅ Offscreen copy succeeded for processing result via', offRes.method || 'offscreen');
                    // Best-effort notify UI about copy completion
                    await this.broadcastMessage({
                      type: 'COPY_COMPLETE',
                      payload: { success: true, method: offRes.method || 'offscreen' },
                    }).catch(() => { });
                  } else {
                    console.warn('[Background] Offscreen copy reported failure:', offRes?.error || 'unknown');
                  }
                } catch (offErr: any) {
                  console.error('[Background] Offscreen copy fallback failed for processing result:', offErr);
                }
              }
            }
            // remove mapping after forwarding to avoid leaks
            this.pendingCaptureMap.delete(selectionHash);
          }
        }
      } catch (forwardErr: any) {
        console.warn('[Background] Forwarding step failed:', forwardErr);
      }

      // Validate quality of processed content with original HTML for accurate scoring
      const qualityReport = ContentQualityValidator.validate(
        finalMd,
        originalHtml || '', // Use original HTML for accurate content preservation calculation
        stats
      );

      // Store export data in session storage to survive service worker termination
      await this.setCurrentExportData({
        markdown: finalMd,
        json: exportJson,
        metadata: canonicalMetadata,
        qualityReport,
        warnings,
        aiAttempted,
        aiProvider,
        aiOutcome,
        fallbackCode,
      });

      // Broadcast success with quality information (critical message)
      await this.broadcastMessage({
        type: 'PROCESSING_COMPLETE',
        payload: {
          exportMd: finalMd,
          exportJson,
          metadata: canonicalMetadata,
          stats,
          warnings,
          qualityReport,
          aiAttempted,
          aiProvider,
          aiOutcome,
          fallbackCode,
        },
      });

      console.log(`Processing completed successfully. Quality score: ${qualityReport.overallScore}/100`);

      // Log quality warnings if any
      const qualityWarnings = qualityReport.issues.filter(issue => issue.type === 'warning');
      if (qualityWarnings.length > 0) {
        console.warn('Quality warnings:', qualityWarnings.map(w => w.message));
      }

    } catch (error: any) {
      console.error('Processing completion handling failed:', error);
      this.broadcastError('Failed to complete processing').catch(console.error);
    }
  }

  /**
   * Handle processing errors from offscreen document
   */
  async handleProcessingError(message: any): Promise<void> {
    const { error, stage, fallbackUsed } = message.payload;

    console.error(`Processing error in ${stage}:`, error);

    if (fallbackUsed) {
      console.log('Fallback was used, processing may continue');
      // Don't broadcast error if fallback was successful
      return;
    }

    this.broadcastError(`Processing failed in ${stage}: ${error}`).catch(console.error);
  }

  /**
   * Handle export requests from popup
   */
  async handleExportRequest(message: any): Promise<void> {
    try {
      const { format, action, content: directContent } = message.payload;

      let content: string;

      // If content is provided directly (for direct copy), use it
      if (directContent) {
        content = directContent;
        console.log('[Background] Using direct content for export, length:', content.length);
      } else {
        // Otherwise, get content from stored export data
        const currentExportData = await this.getCurrentExportData();
        if (!currentExportData) {
          throw new Error('No content available for export');
        }

        switch (format) {
          case 'md':
            content = currentExportData.markdown;
            break;
          case 'json':
            content = JSON.stringify(currentExportData.json, null, 2);
            break;
          default:
            throw new Error(`Unsupported export format: ${format}`);
        }
      }

      if (action === 'copy') {
        await this.copyToClipboard(content);
        await this.broadcastMessage({
          type: 'EXPORT_COMPLETE',
          payload: { format, action: 'copy', success: true },
        });
      } else if (action === 'download') {
        // For download, send content back to popup to handle
        await this.broadcastMessage({
          type: 'EXPORT_COMPLETE',
          payload: { format, action: 'download', content, success: true },
        });
      }

    } catch (error: any) {
      console.error('Export failed:', error);
      this.broadcastError(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`).catch(console.error);
    }
  }

  /**
   * Handle copy to clipboard request from popup
   */
  async handleCopyToClipboard(message: any): Promise<void> {
    try {
      const { content } = message.payload;
      if (!content) {
        throw new Error('No content provided for clipboard copy');
      }

      const currentExportData = await this.getCurrentExportData();
      const canonicalMetadata = this.buildCanonicalMetadata(
        (currentExportData?.metadata || message.payload?.metadata || {}) as Partial<ExportMetadata>
      );
      const normalizedContent = this.canonicalizeDeliveredMarkdown(
        content,
        canonicalMetadata
      );

      console.log('[Background] Handling clipboard copy request, content length:', normalizedContent.length);

      // Enhanced clipboard copy with better error handling
      await this.copyToClipboardEnhanced(normalizedContent);

      // Send success response back to popup
      await this.broadcastMessage({
        type: 'COPY_COMPLETE',
        payload: { success: true, method: 'background' },
      });

    } catch (error: any) {
      console.error('[Background] Clipboard copy failed:', error);
      await this.broadcastMessage({
        type: 'COPY_COMPLETE',
        payload: {
          success: false,
          error: error instanceof Error ? error.message : 'Copy failed',
          method: 'background'
        },
      });
    }
  }
  /**
   * Process fallback result when primary processing fails
   */
  async processFallbackResult(result: any, originalPayload: any): Promise<void> {
    try {
      const fallbackWarningCode = 'processing_fallback:background_error';
      const canonicalMetadata = this.buildCanonicalMetadata(
        undefined,
        {
          title: originalPayload.title || 'Untitled Page',
          url: originalPayload.url || 'Unknown URL',
          capturedAt: new Date().toISOString(),
          selectionHash: originalPayload.selectionHash || `fallback-${Date.now()}`,
        }
      );
      const canonicalMarkdown = this.canonicalizeDeliveredMarkdown(
        result || 'Content extraction failed',
        canonicalMetadata
      );

      // Create minimal export data from fallback result
      const exportData = {
        markdown: canonicalMarkdown,
        json: {
          version: '1.0',
          metadata: canonicalMetadata,
          content: canonicalMarkdown,
        },
        metadata: canonicalMetadata,
        warnings: [fallbackWarningCode],
        aiAttempted: false,
        aiProvider: null,
        aiOutcome: 'not_attempted' as const,
      };

      await this.setCurrentExportData(exportData);

      await this.broadcastMessage({
        type: 'PROCESSING_COMPLETE',
        payload: {
          exportMd: exportData.markdown,
          exportJson: exportData.json,
          metadata: exportData.metadata,
          stats: { fallbackUsed: true },
          warnings: exportData.warnings,
          aiAttempted: exportData.aiAttempted,
          aiProvider: exportData.aiProvider,
          aiOutcome: exportData.aiOutcome,
        },
      });

    } catch (error: any) {
      console.error('Fallback processing failed:', error);
      this.broadcastError('Both primary and fallback processing failed').catch(console.error);
    }
  }

  /**
   * Enhanced copy content to clipboard via offscreen document
   */
  async copyToClipboardEnhanced(content: string): Promise<void> {
    try {
      console.log('[Background] Forwarding copy request to an active tab content script...');

      // Prefer to use the tab that most recently initiated a capture if available
      let targetTabId: number | undefined;
      // If there's a recently pending capture map entry, use its value (last one)
      if (this.pendingCaptureMap.size > 0) {
        // use the last inserted mapping
        const lastEntry = Array.from(this.pendingCaptureMap.values()).pop();
        targetTabId = lastEntry;
      }

      // Fallback to active tab in current window
      if (!targetTabId) {
        const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
        targetTabId = activeTab?.id;
      }

      if (!targetTabId) {
        throw new Error('No target tab available to perform clipboard operation');
      }

      // Ensure target window/tab are focused to improve clipboard success (user activation/focus)
      try {
        const targetTab = await browser.tabs.get(targetTabId);
        if (targetTab?.windowId) {
          try {
            await browser.windows.update(targetTab.windowId, { focused: true } as any);
          } catch {
            // Best-effort focus only; ignore failures.
          }
        }
        try {
          await browser.tabs.update(targetTabId, { active: true } as any);
        } catch {
          // Best-effort focus only; ignore failures.
        }
        // small delay to allow focus to settle
        await new Promise((r) => setTimeout(r, 200));
      } catch (focusErr: any) {
        console.warn('[Background] Could not focus target tab/window before clipboard:', focusErr);
      }

      // Compute a lightweight fingerprint to detect repeated identical forwards
      const fingerprint = `${content.length}:${content.slice(0, 100)}::${content.slice(-100)}`;
      const now = Date.now();
      const lastTs = this.recentCopyFingerprints.get(fingerprint) || 0;
      const SUPPRESSION_WINDOW_MS = 3000; // 3 seconds

      if (now - lastTs < SUPPRESSION_WINDOW_MS) {
        console.log('[Background] Suppressing duplicate copy forward (within window) for tab', targetTabId);
        return; // Skip forwarding duplicate within suppression window
      }

      // Record fingerprint timestamp before sending to avoid races
      this.recentCopyFingerprints.set(fingerprint, now);

      try {
        // Use helper method to inject and send message
        await this.injectAndSendMessage(targetTabId, {
          type: 'COPY_TO_CLIPBOARD',
          payload: { content, waitForPopupClose: true },
        });
        console.log('[Background] ✅ Forwarded copy request to content script for tab', targetTabId);
      } catch (sendErr: any) {
        console.error('[Background] Failed to forward copy request to content script:', sendErr);

        // Last resort: fallback to offscreen copy
        try {
          await this.ensureOffscreenDocument();
          const offRes: any = await browser.runtime.sendMessage({
            type: 'OFFSCREEN_COPY',
            payload: { content },
          });

          if (offRes && offRes.success) {
            console.log('[Background] ✅ Offscreen copy succeeded via', offRes.method || 'offscreen');
            // Optionally notify UI about copy completion
            await this.broadcastMessage({
              type: 'COPY_COMPLETE',
              payload: { success: true, method: offRes.method || 'offscreen' },
            }).catch(() => { });
            return;
          } else {
            const errMsg = offRes?.error || 'Offscreen copy failed';
            throw new Error(errMsg);
          }
        } catch (offErr: any) {
          console.error('[Background] Offscreen copy fallback failed:', offErr);
          // Re-throw the original send error to bubble up
          throw sendErr;
        }
      }
    } catch (error: any) {
      console.error('[Background] ❌ Enhanced clipboard copy failed:', error);
      throw error;
    }
  }  /**
   * Legacy copy content to clipboard via offscreen document
   */
  async copyToClipboard(content: string): Promise<void> {
    return this.copyToClipboardEnhanced(content);
  }

  /**
   * Ensure offscreen document exists with atomic creation to prevent race conditions
   */
  async ensureOffscreenDocument(): Promise<void> {
    // If there's already a creation in progress, wait for it
    if (this.offscreenCreationPromise) {
      return this.offscreenCreationPromise;
    }

    // Create the promise for atomic creation
    this.offscreenCreationPromise = this.createOffscreenDocumentAtomic();

    try {
      await this.offscreenCreationPromise;
    } finally {
      // Clear the promise once creation is complete (success or failure)
      this.offscreenCreationPromise = null;
    }
  }

  /**
   * Atomic offscreen document creation
   */
  private async createOffscreenDocumentAtomic(): Promise<void> {
    try {
      // Check if offscreen document already exists
      const existingContexts = await browser.runtime.getContexts({
        contextTypes: [browser.runtime.ContextType.OFFSCREEN_DOCUMENT],
        documentUrls: [browser.runtime.getURL(this.offscreenPath)],
      });

      if (existingContexts.length > 0) {
        console.log('Offscreen document already exists');
        return; // Already exists
      }

      // Create offscreen document
      await browser.offscreen.createDocument({
        url: this.offscreenPath,
        reasons: ['DOM_PARSER', 'CLIPBOARD'],
        justification: 'Parse HTML content and copy to clipboard',
      });

      console.log('Offscreen document created successfully');
    } catch (error: any) {
      // Handle the case where another context created the document between our check and creation
      if (error instanceof Error && error.message.includes('Only a single offscreen document may be created')) {
        console.log('Offscreen document was created by another context, continuing...');
        return;
      }

      console.error('Failed to create offscreen document:', error);
      throw error;
    }
  }

  /**
   * Get processing statistics
   */
	  async getProcessingStats(): Promise<any> {
	    try {
	      await this.ensureOffscreenDocument();
	      let cacheStats: any = { message: 'Cache stats not available' };
	      let isProcessing = false;
	      try {
	        const response = await browser.runtime.sendMessage({
	          type: 'OFFSCREEN_GET_PROCESSING_STATS',
	          payload: {},
	        });
	        if (response?.success) {
	          isProcessing = Boolean(response.data?.isProcessing);
	          cacheStats = response.data?.cacheStats ?? cacheStats;
	        }
	      } catch (err) {
	        console.warn('[Background] Failed to retrieve offscreen stats:', err);
	      }

	      // Get current export data from session storage
	      const currentExportData = await this.getCurrentExportData();

	      return {
	        cache: {
	          ...cacheStats,
	          // Add convenience properties for backward compatibility
	          keys: [], // IndexedDB doesn't expose keys directly for performance
	        },
	        errors: { message: 'Error stats not available in service worker' },
	        isProcessing,
	        currentExport: currentExportData ? {
	          hasContent: true,
	          contentLength: currentExportData.markdown.length,
	          qualityScore: currentExportData.qualityReport?.overallScore,
        } : { hasContent: false },
      };
    } catch (error: any) {
      console.error('Failed to get processing stats:', error);
      return { error: 'Failed to get stats' };
    }
  }

  /**
   * Clear processing cache
   */
	  async clearProcessingCache(): Promise<void> {
	    try {
	      await this.ensureOffscreenDocument();
	      try {
	        await browser.runtime.sendMessage({
	          type: 'OFFSCREEN_CLEAR_CACHE',
	          payload: {},
	        });
	      } catch (err) {
	        console.warn('[Background] Offscreen cache clear failed:', err);
	      }
	      await this.setCurrentExportData(null);
	      console.log('Processing cache cleared');
	    } catch (error: any) {
      console.error('Failed to clear cache:', error);
      throw error;
    }
  }

  /**
   * Record pipeline metric to session store for analytics
   */
  private async recordPipelineMetric(metric: any): Promise<void> {
    try {
      await SessionMetricsStore.recordMetric(metric);
    } catch (error: any) {
      console.warn('[Background] Failed to record pipeline metric:', error);
    }
  }

  /**
   * Broadcast message to all extension contexts with retry mechanism
   */
  private async broadcastMessage(message: any, retries: number = 3): Promise<void> {
    const isCriticalMessage = this.isCriticalMessage(message.type);

    // Pre-check for UI-bound messages to avoid noisy errors when no receiver exists
    if (message?.type === 'EXPORT_COMPLETE' || message?.type === 'PROCESSING_COMPLETE') {
      try {
        const hasPopup = await this.hasPopupContext();
        if (!hasPopup) {
          // No popup available to receive; persist for polling and skip broadcast
          if (isCriticalMessage) {
            await this.handleCriticalMessageFailure(message, new Error('No popup context available'), true);
          }
          console.log(`[Background] No popup available to receive ${message.type}; stored for polling and skipped broadcast`);
          return;
        }
      } catch (ctxErr) {
        // If context check fails, continue with best-effort broadcast
        console.warn('[Background] Popup context check failed; attempting broadcast anyway:', ctxErr);
      }
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await browser.runtime.sendMessage(message);
        console.log(`[Background] Message broadcast successful: ${message.type}`);
        return; // Success, exit retry loop
      } catch (error: any) {
        const isLastAttempt = attempt === retries;

        // Suppress noisy logs for "Receiving end does not exist" when there may be no UI
        const msg = typeof error?.message === 'string' ? error.message : String(error);
        const isNoReceiver = msg.includes('Receiving end does not exist') || msg.includes('Could not establish connection');

        if (isLastAttempt) {
          if (isNoReceiver && (message?.type === 'EXPORT_COMPLETE' || message?.type === 'PROCESSING_COMPLETE')) {
            // Downgrade to warn and persist for polling
            console.log(`[Background] No receiver for ${message.type}; stored for polling`);
            if (isCriticalMessage) {
              await this.handleCriticalMessageFailure(message, error, true);
            }
            return;
          }

          console.error(`[Background] Failed to broadcast message after ${retries} attempts:`, error);

          // For critical messages, try alternative notification methods
          if (isCriticalMessage) {
            await this.handleCriticalMessageFailure(message, error, false);
          }
        } else {
          if (isNoReceiver && (message?.type === 'EXPORT_COMPLETE' || message?.type === 'PROCESSING_COMPLETE')) {
            // No point retrying if no receiver exists; break early after persisting
            if (isCriticalMessage) {
              await this.handleCriticalMessageFailure(message, error, true);
            }
            console.log(`[Background] No receiver for ${message.type}; skipping retries`);
            return;
          }
          console.warn(`[Background] Broadcast attempt ${attempt} failed, retrying...`, error);
          // Wait before retry with exponential backoff
          await this.delay(Math.pow(2, attempt - 1) * 100);
        }
      }
    }
  }

  // Check if popup UI context exists (so it can receive broadcasts)
  private async hasPopupContext(): Promise<boolean> {
    try {
      const contexts = await browser.runtime.getContexts({
        contextTypes: [browser.runtime.ContextType.POPUP],
      });
      return Array.isArray(contexts) && contexts.length > 0;
    } catch (e) {
      console.warn('[Background] getContexts(POPUP) failed:', e);
      return false;
    }
  }

  /**
   * Check if a message type is critical and requires special handling on failure
   */
  private isCriticalMessage(messageType: string): boolean {
    const criticalTypes = [
      'PROCESSING_COMPLETE',
      'EXPORT_COMPLETE',
      'PROCESSING_ERROR'
    ];
    return criticalTypes.includes(messageType);
  }

  /**
   * Handle failure of critical message broadcasts
   * @param message - The message that failed to broadcast
   * @param error - The error that occurred
   * @param isExpectedFailure - If true, this is an expected condition (popup closed) and should not be logged as an error
   */
  private async handleCriticalMessageFailure(message: any, error: any, isExpectedFailure: boolean = false): Promise<void> {
    if (isExpectedFailure) {
      // This is expected behavior when popup is closed, just store for later
      console.log(`[Background] Critical message stored for later delivery: ${message.type}`);
    } else {
      // This is an unexpected failure
      console.error(`[Background] Critical message broadcast failed: ${message.type}`, error);
    }

	    try {
	      // Store the failed message in session storage for UI to poll
	      const result = (await browser.storage.session.get(['failed_broadcasts'])) as Record<string, unknown>;
	      const rawMessages = result.failed_broadcasts;
	      const messages = Array.isArray(rawMessages) ? (rawMessages as any[]) : [];

	      messages.push({
	        ...message,
	        timestamp: new Date().toISOString(),
	        error: error instanceof Error ? error.message : 'Unknown error'
	      });

	      // Keep only the last 10 failed messages
	      const trimmed = messages.length > 10 ? messages.slice(-10) : messages;
	      await browser.storage.session.set({ failed_broadcasts: trimmed });

      if (!isExpectedFailure) {
        console.log(`[Background] Critical message stored for polling: ${message.type}`);
      }
    } catch (storageError: any) {
      console.error('[Background] Failed to store critical message for polling:', storageError);
    }
  }

  /**
   * Utility function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Broadcast error message
   */
  private async broadcastError(error: string): Promise<void> {
    await this.broadcastMessage({
      type: 'PROCESSING_ERROR',
      payload: { error, stage: 'background', timestamp: new Date().toISOString() },
    });
  }

  /**
   * Broadcast success message
   */
  private async broadcastSuccess(data: any): Promise<void> {
    await this.broadcastMessage({
      type: 'PROCESSING_COMPLETE',
      payload: data,
    });
  }

  /**
   * Helper to inject content script and send message with retry logic
   */
  private async injectAndSendMessage(tabId: number, message: any): Promise<void> {
    // First try: check if content script is already present
    let pingOk = await this.ensureContentScript(tabId);

    // If not present, inject it
    if (!pingOk) {
      try {
	        await browser.scripting.executeScript({
	          target: { tabId },
	          files: ['/content-scripts/content.js'],
	        });
        await new Promise((r) => setTimeout(r, 150));
        pingOk = await this.ensureContentScript(tabId);
      } catch (injectErr: any) {
        console.warn('[Background] Content script injection failed:', injectErr);
        throw new Error('Failed to inject content script');
      }
    }

    // Send the message
    await browser.tabs.sendMessage(tabId, message);
  }

  /**
   * Ensure content script is present and responsive in the tab
   */
  private async ensureContentScript(tabId: number): Promise<boolean> {
    try {
      console.log('Sending PING to content script in tab:', tabId);
      // Quick ping to check if content script is listening
      const response = await browser.tabs.sendMessage(tabId, { type: 'PING' });
      console.log('PING response received:', response);
      return Boolean(response && response.ok);
    } catch (error: any) {
      console.warn('Content script ping failed (likely not injected yet):', error);
      // Try ping again after a short delay
      try {
        console.log('Retrying PING after delay...');
        await new Promise((r) => setTimeout(r, 500)); // Increased delay
        const retry = await browser.tabs.sendMessage(tabId, { type: 'PING' });
        console.log('PING retry response:', retry);
        return Boolean(retry && retry.ok);
      } catch (retryError: any) {
        console.error('PING retry also failed:', retryError);
        return false;
      }
    }
  }

}
