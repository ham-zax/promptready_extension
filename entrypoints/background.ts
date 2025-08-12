export default defineBackground(() => {
  console.log('PromptReady background service worker initialized');
  
  // Initialize the processing pipeline
  const processor = new ContentProcessor();
  
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
    console.log('Message sender:', sender);
    return processor.handleMessage(message, sender, sendResponse);
  });
  
  // Handle installation
  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      console.log('PromptReady extension installed');
      // Could show welcome page or setup instructions
    }
  });
});

// Import browser API from WXT
import { browser } from 'wxt/browser';

// Import processing modules
// Dynamic imports for DOM-dependent modules to avoid build-time issues
import { Storage } from '../lib/storage.js';
import { fileNaming } from '../lib/fileNaming.js';
import { BYOKClient } from '../pro/byok-client.js';
import type { 
  MessageType, 
  Message, 
  CaptureCompleteMessage, 
  ExportRequestMessage,
  ExportCompleteMessage,
  ProcessingCompleteMessage,
  ErrorMessage,
  Settings,
  ExportMetadata,
  PromptReadyExport,
  ByokRequestMessage,
  ByokResultMessage,
  FetchModelsMessage,
  ModelsResultMessage
} from '../lib/types.js';

/**
 * Main content processing pipeline
 * Runs in service worker context
 */
class ContentProcessor {
  private readonly offscreenPath: '/offscreen.html' = '/offscreen.html';

  private currentExportData: {
    markdown: string;
    json: PromptReadyExport;
    metadata: ExportMetadata;
  } | null = null;
  
  /**
   * Handle keyboard shortcut activation
   */
  async handleCaptureCommand(): Promise<void> {
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.id) {
        throw new Error('No active tab found');
      }
      
      // Send capture message to content script (it should already be injected)
      try {
        await browser.tabs.sendMessage(tab.id, { type: 'CAPTURE_SELECTION' });
      } catch (contentError) {
        console.warn('Content script not ready, trying to inject...');
        // Content script might not be injected yet, try to inject it
        await browser.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content-scripts/content.js']
        });
        
        // Wait a bit for the script to load
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Try again
        await browser.tabs.sendMessage(tab.id, { type: 'CAPTURE_SELECTION' });
      }
      
    } catch (error) {
      console.error('Failed to handle capture command:', error);
      this.broadcastError('Failed to capture content. Please select some text and try again.');
    }
  }
  
  /**
   * Handle messages from content script and popup
   */
  async handleMessage(
    message: Message<MessageType>, 
    sender: any, 
    sendResponse: (response?: any) => void
  ): Promise<boolean> {
    console.log('Background received message:', message.type);
    console.log('Message payload:', message.payload);
    
    try {
      switch (message.type) {
        case 'TRIGGER_CAPTURE':
          console.log('Handling TRIGGER_CAPTURE from popup');
          await this.handleCaptureCommand();
          break;

        case 'CAPTURE_COMPLETE':
          console.log('Handling CAPTURE_COMPLETE');
          await this.handleCaptureComplete(message as CaptureCompleteMessage);
          break;

        case 'EXPORT_REQUEST':
          console.log('Handling EXPORT_REQUEST');
          await this.handleExportRequest(message as ExportRequestMessage);
          break;
        case 'OFFSCREEN_READY':
          console.log('Offscreen document reported ready');
          break;
        case 'OFFSCREEN_PROCESSED': {
          const payload = (message as any).payload;
          console.log('Received OFFSCREEN_PROCESSED');
          this.currentExportData = {
            markdown: payload.exportMd,
            json: payload.exportJson,
            metadata: payload.metadata,
          };
          const response: ProcessingCompleteMessage = {
            type: 'PROCESSING_COMPLETE',
            payload: {
              exportMd: payload.exportMd,
              exportJson: payload.exportJson,
            },
          };
          await this.broadcastToPopup(response);

          // Auto-copy Markdown immediately after processing completes
          /* try {
            await this.handleCopy('md');
            const completeMessage: ExportCompleteMessage = {
              type: 'EXPORT_COMPLETE',
              payload: { format: 'md', action: 'copy' },
            };
            await this.broadcastToPopup(completeMessage);
          } catch (copyError) {
            console.warn('Auto-copy after processing failed:', copyError);
          }` */
          break;
        }
        case 'BYOK_REQUEST': {
          const m = message as ByokRequestMessage;
          console.log('[BYOK] Handling BYOK_REQUEST from', sender?.id || 'popup', {
            hasBundle: Boolean(m.payload?.bundleContent),
            model: m.payload?.model,
          });
          await this.handleByokRequest(m);
          break;
        }
        case 'FETCH_MODELS':
          await this.handleFetchModels(message as FetchModelsMessage);
          break;
          
        default:
          console.warn('Unknown message type:', message.type);
      }
      
      return true; // Keep message channel open for async responses
      
    } catch (error) {
      console.error('Message handling failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.broadcastError(`Processing failed: ${errorMessage}`);
      return false;
    }
  }
  
  /**
   * Process captured content through the cleaning and structuring pipeline
   */
  async handleCaptureComplete(message: CaptureCompleteMessage): Promise<void> {
    try {
      if (!message.payload) {
        throw new Error('No content data provided');
      }
      
      const { html, url, title, selectionHash } = message.payload;
      const settings = await Storage.getSettings();
      
      // Step 1: Clean the content
      const cleanerOptions = {
        mode: settings.mode,
        preserveCodeBlocks: true,
        preserveTables: true,
        removeHiddenElements: true,
      };
      
      // If DOMParser isn't available in SW, delegate to offscreen document for processing
      // Always process in offscreen for consistency and Readability support
      await this.ensureOffscreenDocument();
      await browser.runtime.sendMessage({
        type: 'OFFSCREEN_PROCESS',
        payload: { html, url, title, selectionHash, mode: settings.mode, renderer: settings.renderer || 'structurer', useReadability: settings.useReadability !== false },
      });
      return;
      
    } catch (error) {
      console.error('Content processing failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.broadcastError(`Failed to process content: ${errorMessage}`);
    }
  }
  
    /**
   * Handle export requests (copy/download)
   */
  async handleExportRequest(message: ExportRequestMessage): Promise<void> {
    try {
      if (!message.payload) {
        throw new Error('No export data provided');
      }

      if (!this.currentExportData) {
        throw new Error('No content available to export');
      }

      const { format, action } = message.payload;
      
      if (action === 'download') {
        await this.handleDownload(format);
      } else if (action === 'copy') {
        await this.handleCopy(format);
      }
      
      // Send completion message to popup
      const completeMessage: ExportCompleteMessage = {
        type: 'EXPORT_COMPLETE',
        payload: { format, action },
      };
      await this.broadcastToPopup(completeMessage);
      
      // Record telemetry
      await Storage.recordTelemetry({
        event: 'export',
        data: {
          type: format,
          fileName: action === 'download' ? this.generateFileName(format) : undefined,
        },
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      console.error('Export failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.broadcastError(`Export failed: ${errorMessage}`);
    }
  }
  /**
   * Handle BYOK validation/formatting request
   */
  private async handleByokRequest(message: ByokRequestMessage): Promise<void> {
    try {
      console.log('[BYOK] handleByokRequest start');
      const settings = await Storage.getSettings();
      const apiKey = await Storage.getApiKey();
      console.log('[BYOK] apiKey present?', Boolean(apiKey), 'len=', apiKey?.length || 0);
      if (!apiKey) throw new Error('No API key available. Save key in Settings > BYOK.');

      const apiBase = (settings.byok.apiBase || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
      const model = message.payload?.model || settings.byok.model || 'openrouter/auto';
      console.log('[BYOK] Using', { apiBase, model });

      const response = await BYOKClient.makeRequest(
        { prompt: message.payload?.bundleContent || '', temperature: 0 },
        { apiBase, apiKey, model },
        { showModal: true, requireExplicitConsent: true }
      );

      const content: string = response.content || '';
      console.log('[BYOK] Response content length:', content.length);

      // Prepare export data so popup can trigger copy/download of BYOK result
      const byokMetadata: ExportMetadata = {
        title: 'BYOK Result',
        url: '',
        capturedAt: new Date().toISOString(),
        selectionHash: 'byok',
      };
      const byokExportJson: PromptReadyExport = {
        version: '1.0',
        metadata: byokMetadata,
        blocks: [
          { type: 'paragraph', text: content },
        ],
      };
      this.currentExportData = {
        markdown: content,
        json: byokExportJson,
        metadata: byokMetadata,
      };
      console.log('[BYOK] currentExportData updated for export/copy. mdLength=', content.length);

      const result: ByokResultMessage = {
        type: 'BYOK_RESULT',
        payload: { content },
      };
      console.log('[BYOK] Broadcasting BYOK_RESULT to popup');
      await this.broadcastToPopup(result);

      await Storage.recordTelemetry({
        event: 'bundle_use',
        data: { action: 'validate', model },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('BYOK handling failed:', error);
      const msg = error instanceof Error ? error.message : 'BYOK request failed';
      console.log('[BYOK] Broadcasting ERROR to popup:', msg);
      this.broadcastError(msg);
    }
  }

  /**
   * Fetch model list from OpenRouter
   */
  private async handleFetchModels(message: FetchModelsMessage): Promise<void> {
    try {
      const settings = await Storage.getSettings();
      const apiKey = await Storage.getApiKey();
      const apiBase = (message.payload?.apiBase || settings.byok.apiBase || 'https://openrouter.ai/api/v1').replace(/\/$/, '');

      console.log('[BYOK] Fetching models from', `${apiBase}/models`, 'apiKey?', Boolean(apiKey));
      const resp = await fetch(`${apiBase}/models`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          ...(!apiKey ? { 'X-Title': 'PromptReady Extension' } : {}),
        },
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Fetch models failed: ${resp.status} ${text}`);
      }
      const text = await resp.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Invalid JSON from models endpoint: ${text.slice(0, 200)}`);
      }
      let models: Array<{ id: string; name: string }> = [];
      if (Array.isArray(data?.data)) {
        models = data.data
          .map((m: any) => ({ id: m?.id ?? m?.name ?? '', name: m?.name ?? m?.id ?? '' }))
          .filter((m: any) => m.id);
      } else if (data?.data && typeof data.data === 'object') {
        const m = data.data;
        models = [{ id: m?.id ?? m?.name ?? '', name: m?.name ?? m?.id ?? '' }].filter((x) => x.id);
      }

      const result: ModelsResultMessage = {
        type: 'MODELS_RESULT',
        payload: { models },
      };
      await this.broadcastToPopup(result);
      try {
        await browser.storage.session.set({ openrouter_models: models, openrouter_models_ts: Date.now() });
      } catch {}
      console.log('[BYOK] Models loaded:', models.length);
    } catch (error) {
      console.error('Fetch models failed:', error);
      const msg = error instanceof Error ? error.message : 'Failed to fetch models';
      this.broadcastError(msg);
    }
  }
  
  /**
   * Handle file downloads
   */
  async handleDownload(format: 'md' | 'json'): Promise<void> {
    if (!this.currentExportData) {
      throw new Error('No content to download');
    }

    const content = format === 'md' 
      ? this.currentExportData.markdown 
      : JSON.stringify(this.currentExportData.json, null, 2);
    
    const filename = this.generateFileName(format);
    const mimeType = format === 'md' ? 'text/markdown' : 'application/json';
    
    // Create blob and download
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    await browser.downloads.download({
      url,
      filename,
      saveAs: false, // Auto-save to downloads folder
    });
    
    // Clean up the blob URL
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  
  /**
   * Handle clipboard copy
   */
  async handleCopy(format: 'md' | 'json'): Promise<void> {
    console.log('handleCopy called with format:', format);
    
    if (!this.currentExportData) {
      throw new Error('No content to copy');
    }

    const content = format === 'md' 
      ? this.currentExportData.markdown 
      : JSON.stringify(this.currentExportData.json, null, 2);
    
    console.log('Content to copy (first 100 chars):', content.substring(0, 100));
    console.log('Full content length:', content.length);
    
    // Ensure offscreen document exists
    await this.ensureOffscreenDocument();

    // Send clipboard request to offscreen document
    console.log('Sending OFFSCREEN_COPY message...');
    try {
      const result = await browser.runtime.sendMessage({ type: 'OFFSCREEN_COPY', payload: { content } });
      console.log('OFFSCREEN_COPY response:', result);
    } catch (e) {
      console.warn('OFFSCREEN_COPY sendMessage returned error:', e);
    }
    console.log('OFFSCREEN_COPY sent');
  }

  private async ensureOffscreenDocument(): Promise<void> {
    const offscreenUrl = browser.runtime.getURL(this.offscreenPath);
    const contexts = await browser.runtime.getContexts?.({
      contextTypes: [browser.runtime.ContextType?.OFFSCREEN_DOCUMENT ?? 'OFFSCREEN_DOCUMENT'],
      documentUrls: [offscreenUrl],
    });

    if (Array.isArray(contexts) && contexts.length > 0) {
      return;
    }

    await browser.offscreen.createDocument({
      url: this.offscreenPath,
      reasons: [
        browser.offscreen.Reason?.CLIPBOARD ?? 'CLIPBOARD',
        browser.offscreen.Reason?.DOM_PARSER ?? 'DOM_PARSER',
      ],
      justification: 'Clipboard writes and DOM parsing of captured HTML',
    });
  }
  
  /**
   * Generate filename for downloads
   */
  private generateFileName(format: 'md' | 'json'): string {
    if (!this.currentExportData) {
      return `promptready-export.${format}`;
    }

    return fileNaming.generateFileName(
      this.currentExportData.metadata.title,
      format,
      this.currentExportData.metadata.selectionHash
    );
  }
  
  /**
   * Broadcast message to popup
   */
  async broadcastToPopup(message: Message<MessageType>): Promise<void> {
    try {
      await browser.runtime.sendMessage(message);
    } catch (error) {
      console.warn('Failed to broadcast to popup:', error);
      // Popup might not be open, which is fine
    }
  }
  
  /**
   * Broadcast error message
   */
  async broadcastError(errorMessage: string): Promise<void> {
    const message: ErrorMessage = {
      type: 'ERROR',
      payload: {
        message: errorMessage,
      },
    };
    
    await this.broadcastToPopup(message);
  }

  /**
   * Fallback processing when DOMParser is not available
   */
  async processFallbackContent(
    cleanResult: any,
    title: string,
    url: string,
    selectionHash: string,
    settings: any
  ): Promise<void> {
    try {
      // Create basic metadata
      const metadata: ExportMetadata = {
        title,
        url,
        capturedAt: new Date().toISOString(),
        selectionHash,
      };

      // Create basic export structure without DOM processing
      const exportData: PromptReadyExport = {
        version: '1.0',
        metadata,
        blocks: [
          {
            type: 'paragraph',
            text: 'Content processing unavailable. Raw HTML content preserved.',
          },
        ],
      };

      // Generate basic markdown
      const exportMd = `# ${title}\n\nContent processing unavailable. Please refresh the page and try again.\n\n---\n\n**Source:** ${url}\n**Captured:** ${new Date().toLocaleDateString()}\n**Selection Hash:** ${selectionHash}`;

      // Store export data
      this.currentExportData = {
        markdown: exportMd,
        json: exportData,
        metadata,
      };

      const response: ProcessingCompleteMessage = {
        type: 'PROCESSING_COMPLETE',
        payload: {
          exportMd,
          exportJson: exportData,
        },
      };

      await this.broadcastToPopup(response);

      // Record telemetry
      await Storage.recordTelemetry({
        event: 'clean',
        data: {
          mode: settings.mode,
          durationMs: 100, // Fallback processing is quick
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Fallback processing failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.broadcastError(`Fallback processing failed: ${errorMessage}`);
    }
  }
}