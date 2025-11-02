// Enhanced background script integrating the new offline capabilities system
// This replaces the existing background.ts with improved processing pipeline

import { browser } from 'wxt/browser';
import { Storage } from '../lib/storage.js';

import { ErrorHandler } from '../core/error-handler.js';
import { ContentQualityValidator } from '../core/content-quality-validator.js';

export default defineBackground(() => {
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
class EnhancedContentProcessor {
  private readonly offscreenPath: '/offscreen.html' = '/offscreen.html';
  private readonly EXPORT_DATA_KEY = 'currentExportData';
  private offscreenCreationPromise: Promise<void> | null = null;
  // Simple dedupe cache for COPY_TO_CLIPBOARD forwarding to avoid message storms
  private recentCopyFingerprints: Map<string, number> = new Map(); // fingerprint -> timestamp

  // Map selectionHash -> tabId so we can forward processing results back to the originating tab
  private pendingCaptureMap: Map<string, number> = new Map();

  // Gatekeeper to prevent duplicate long-running processing for the same selectionHash
  private inProgressRequests: Set<string> = new Set();

  /**
   * Store export data in session storage to survive service worker termination
   */
  private async setCurrentExportData(data: {
    markdown: string;
    json: any;
    metadata: any;
    qualityReport?: any;
  } | null): Promise<void> {
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
  private async getCurrentExportData(): Promise<{
    markdown: string;
    json: any;
    metadata: any;
    qualityReport?: any;
  } | null> {
    try {
      const result = await browser.storage.session.get([this.EXPORT_DATA_KEY]);
      return result[this.EXPORT_DATA_KEY] || null;
    } catch (error: any) {
      console.error('Failed to retrieve export data:', error);
      return null;
    }
  }

  /**
   * Handle keyboard shortcut activation
   */
  async handleCaptureCommand(): Promise<void> {
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

      // Ensure content script is responsive before sending capture
      console.log('Checking content script availability for tab:', tab.id);
      const ok = await this.ensureContentScript(tab.id);
      console.log('Content script check result:', ok);
      if (!ok) {
        console.error('Content script ping failed for tab:', tab.id, 'URL:', tab.url);
        this.broadcastError('Content script not available on this page. Please refresh the page and try again.');
        return;
      }

      // Send capture request to content script
      await browser.tabs.sendMessage(tab.id, {
        type: 'CAPTURE_SELECTION',
        payload: { tabId: tab.id },
      });



    } catch (error: any) {
      console.error('Capture command failed:', error);
      this.broadcastError('Failed to capture content. Please try again.').catch(console.error);
    }
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
          this.broadcastMessage(message, 0).catch(error => {
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
      if (!message.payload) {
        throw new Error('No content data provided');
      }

      const { html, url, title } = message.payload;
      // Determine originating tab id from sender (content scripts send messages with sender.tab)
      const originatingTabId = sender?.tab?.id || message.payload?.tabId;
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
          selectionHash,
          mode: settings.mode,
          useReadability: settings.useReadability !== false,
          renderer: settings.renderer || 'turndown',
          customConfig: undefined, // TODO: Add offlineConfig to Settings interface if needed
          settings: settings, // Pass full settings to offscreen document
        },
      });

      // Handle the direct response
      if (!response.success) {
        throw new Error(response.error || 'Processing failed');
      }

      // Process the successful result
      await this.handleProcessingComplete({ payload: response.data });

    } catch (error: any) {
      console.error('Content processing failed:', error);

      // Try error recovery
      const fallbackResult = await ErrorHandler.handleError(error as Error, {
        stage: 'content-extraction',
        operation: 'handleCaptureComplete',
        input: { html: message.payload?.html, url: message.payload?.url },
      });

      if (fallbackResult.success) {
        console.log('Error recovery successful, using fallback result');
        // Process fallback result
        await this.processFallbackResult(fallbackResult.result, message.payload);
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.broadcastError(`Failed to process content: ${errorMessage}`).catch(console.error);
      }
    } finally {
      // Ensure we always clear the gatekeeper entry for this selectionHash so future requests can proceed
      try {
        if (selectionHash && this.inProgressRequests.has(selectionHash)) {
          this.inProgressRequests.delete(selectionHash);
          console.log(`[BMAD_GATE] Cleared in-progress request for hash ${selectionHash}`);
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
      if (!tabId) {
        throw new Error('No tab ID provided');
      }

      console.log(`[Background] Sending CAPTURE_SELECTION to tab ${tabId}`);
      
      try {
        // Send capture request to content script
        await browser.tabs.sendMessage(tabId, {
          type: 'CAPTURE_SELECTION',
          payload: {},
        });
        
        console.log(`[Background] CAPTURE_SELECTION sent successfully to tab ${tabId}`);
      } catch (messageError: any) {
        console.warn('[Background] Content script not responding, attempting to inject:', messageError.message);
        
        // Try to inject content script dynamically
        try {
          await browser.scripting.executeScript({
            target: { tabId },
            files: ['content-scripts/content.js']
          });
          
          console.log('[Background] Content script injected, retrying message...');
          
          // Wait a moment for script to initialize
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Retry the message
          await browser.tabs.sendMessage(tabId, {
            type: 'CAPTURE_SELECTION',
            payload: {},
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
      const { exportMd, exportJson, metadata, stats, warnings, originalHtml } = message.payload;

  // BMAD TRACE: log what we received from offscreen before any insertion
  console.log('[BMAD_TRACE] Background received from offscreen:', (exportMd || '').substring(0, 100));

  // Ensure a canonical citation block exists at the top-level of the final markdown.
      // Some pipeline paths (bypass from offscreen) may return markdown that never had
      // the background's canonical citation inserted. Enforce it here so every final
      // output delivered to tabs/popup contains the standardized cite-first block.
      let finalMd = exportMd;

  // BMAD TRACE: log the finalized markdown after insertion (or unchanged)
  console.log('[BMAD_TRACE] Background after cite block insertion:', (finalMd || '').substring(0, 100));

      // If we have a selectionHash -> tabId mapping, forward the raw markdown to that tab's content script.
      try {
  const selectionHash = message.payload?.metadata?.selectionHash || message.payload?.exportJson?.metadata?.selectionHash;
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
                  files: ['content-scripts/content.js'],
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
                    }).catch(() => {});
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
        metadata,
        qualityReport,
      });

      // Broadcast success with quality information (critical message)
      await this.broadcastMessage({
        type: 'PROCESSING_COMPLETE',
        payload: {
          exportMd: finalMd,
          exportJson,
          metadata,
          stats,
          warnings,
          qualityReport,
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

      console.log('[Background] Handling clipboard copy request, content length:', content.length);

      // Enhanced clipboard copy with better error handling
      await this.copyToClipboardEnhanced(content);

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
      // Create minimal export data from fallback result
      const exportData = {
        markdown: result || 'Content extraction failed',
        json: {
          version: '1.0',
          metadata: {
            title: originalPayload.title || 'Untitled',
            url: originalPayload.url || '',
            timestamp: new Date().toISOString(),
            source: 'fallback-processor',
          },
          content: result || 'Content extraction failed',
        },
        metadata: {
          title: originalPayload.title || 'Untitled',
          url: originalPayload.url || '',
          timestamp: new Date().toISOString(),
          source: 'fallback-processor',
        },
      };

      await this.setCurrentExportData(exportData);

      await this.broadcastMessage({
        type: 'PROCESSING_COMPLETE',
        payload: {
          exportMd: exportData.markdown,
          exportJson: exportData.json,
          metadata: exportData.metadata,
          stats: { fallbackUsed: true },
          warnings: ['Used fallback processing due to errors'],
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
          try { await browser.windows.update(targetTab.windowId, { focused: true } as any); } catch (focusWinErr: any) {}
        }
        try { await browser.tabs.update(targetTabId, { active: true } as any); } catch (focusTabErr: any) {}
        // small delay to allow focus to settle
        await new Promise((r) => setTimeout(r, 200));
      } catch (focusErr: any) {
        console.warn('[Background] Could not focus target tab/window before clipboard:', focusErr);
      }

      try {
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

        // Ensure content script is ready before attempting copy
let pingOk = await this.ensureContentScript(targetTabId);
if (!pingOk) {
  try {
    await browser.scripting.executeScript({
      target: { tabId: targetTabId },
      files: ['content-scripts/content.js'],
    });
    await new Promise((r) => setTimeout(r, 150));
    pingOk = await this.ensureContentScript(targetTabId);
  } catch (preInjectErr: any) {
    console.warn('[Background] Pre-send injection failed:', preInjectErr);
  }
}

await browser.tabs.sendMessage(targetTabId, {
  type: 'COPY_TO_CLIPBOARD',
  payload: { content, waitForPopupClose: true },
});console.log('[Background] ✅ Forwarded copy request to content script for tab', targetTabId);

        // Prune old fingerprints to avoid unbounded growth
        for (const [fp, ts] of Array.from(this.recentCopyFingerprints.entries())) {
          if (now - ts > 60 * 1000) { // keep entries for 1 minute
            this.recentCopyFingerprints.delete(fp);
          }
        }
      } catch (sendErr: any) {
        console.error('[Background] Failed to forward copy request to content script:', sendErr);

        // Attempt dynamic injection and retry once if receiving end does not exist
        try {
          await browser.scripting.executeScript({
            target: { tabId: targetTabId },
            files: ['content-scripts/content.js'],
          });
          // Short delay to allow the content script to initialize
          await new Promise((r) => setTimeout(r, 150));

          // Ensure content script is ready before attempting copy
let pingOk = await this.ensureContentScript(targetTabId);
if (!pingOk) {
  try {
    await browser.scripting.executeScript({
      target: { tabId: targetTabId },
      files: ['content-scripts/content.js'],
    });
    await new Promise((r) => setTimeout(r, 150));
    pingOk = await this.ensureContentScript(targetTabId);
  } catch (preInjectErr: any) {
    console.warn('[Background] Pre-send injection failed:', preInjectErr);
  }
}

await browser.tabs.sendMessage(targetTabId, {
  type: 'COPY_TO_CLIPBOARD',
  payload: { content, waitForPopupClose: true },
});console.log('[Background] ✅ Forwarded copy request after injection to content script for tab', targetTabId);

          // Successful after injection; stop here
          return;
        } catch (injectErr: any) {
          console.warn('[Background] Injection/retry failed; falling back to offscreen copy:', injectErr);
          // Fallback: use offscreen document to perform clipboard write
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
              }).catch(() => {});
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
      }
    } catch (error: any) {
      console.error('[Background] ❌ Enhanced clipboard copy failed:', error);
      throw error;
    }
  }

  /**
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
      // Cache stats not available in service worker context
      const cacheStats = { message: 'Cache stats not available in service worker' };

      // Get error stats from error handler
      const errorStats = ErrorHandler.getErrorStats();

      // Get current export data from session storage
      const currentExportData = await this.getCurrentExportData();

      return {
        cache: {
          ...cacheStats,
          // Add convenience properties for backward compatibility
          keys: [], // IndexedDB doesn't expose keys directly for performance
        },
        errors: errorStats,
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
      // Cache clearing not available in service worker context
      console.log('Cache clearing not available in service worker context');
      ErrorHandler.clearErrorLog();
      await this.setCurrentExportData(null);
      console.log('Processing cache cleared');
    } catch (error: any) {
      console.error('Failed to clear cache:', error);
      throw error;
    }
  }

  /**
   * Broadcast message to all extension contexts with retry mechanism
   */
  private async broadcastMessage(message: any, retries: number = 3): Promise<void> {
    const isCriticalMessage = this.isCriticalMessage(message.type);

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await browser.runtime.sendMessage(message);
        console.log(`[Background] Message broadcast successful: ${message.type}`);
        return; // Success, exit retry loop
      } catch (error: any) {
        const isLastAttempt = attempt === retries;

        if (isLastAttempt) {
          console.error(`[Background] Failed to broadcast message after ${retries} attempts:`, error);

          // For critical messages, try alternative notification methods
          if (isCriticalMessage) {
            await this.handleCriticalMessageFailure(message, error);
          }
        } else {
          console.warn(`[Background] Broadcast attempt ${attempt} failed, retrying...`, error);
          // Wait before retry with exponential backoff
          await this.delay(Math.pow(2, attempt - 1) * 100);
        }
      }
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
   */
  private async handleCriticalMessageFailure(message: any, error: any): Promise<void> {
    console.error(`[Background] Critical message broadcast failed: ${message.type}`, error);

    try {
      // Store the failed message in session storage for UI to poll
      const failedMessages = await browser.storage.session.get(['failed_broadcasts']) || { failed_broadcasts: [] };
      const messages = failedMessages.failed_broadcasts || [];

      messages.push({
        ...message,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Keep only the last 10 failed messages
      if (messages.length > 10) {
        messages.splice(0, messages.length - 10);
      }

      await browser.storage.session.set({ failed_broadcasts: messages });

      console.log(`[Background] Critical message stored for polling: ${message.type}`);
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
