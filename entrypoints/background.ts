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
  PromptReadyExport
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
      if (typeof DOMParser === 'undefined') {
        console.warn('DOMParser not available in Service Worker. Delegating to offscreen for processing.');
        await this.ensureOffscreenDocument();
        await browser.runtime.sendMessage({
          type: 'OFFSCREEN_PROCESS',
          payload: { html, url, title, selectionHash, mode: settings.mode },
        });
        return;
      }
      
      const { ContentCleaner } = await import('../core/cleaner.js');
      const cleanResult = await ContentCleaner.clean(html, url, cleanerOptions);
      
      // Step 2: Structure the content
      const metadata: ExportMetadata = {
        title,
        url,
        capturedAt: new Date().toISOString(),
        selectionHash,
      };
      
      const structurerOptions = {
        mode: settings.mode,
        preserveCodeLanguages: settings.mode === 'code_docs',
        maxHeadingLevel: 3,
        includeTableHeaders: true,
      };
      
      const { ContentStructurer } = await import('../core/structurer.js');
      const exportData = await ContentStructurer.structure(
        cleanResult.cleanedHtml,
        metadata,
        structurerOptions
      );
      
      // Step 3: Generate Markdown (reuse the imported ContentStructurer)
      const exportMd = ContentStructurer.blocksToMarkdown(exportData.blocks);
      const citationFooter = ContentStructurer.generateCitationFooter(metadata);
      const fullMarkdown = `${exportMd}\n\n${citationFooter}`;
      
      // Step 4: Store export data and broadcast results to popup
      this.currentExportData = {
        markdown: fullMarkdown,
        json: exportData,
        metadata,
      };
      
      console.log('Export data stored. Markdown length:', fullMarkdown.length);
      console.log('Markdown content preview (first 200 chars):', fullMarkdown.substring(0, 200));

      const response: ProcessingCompleteMessage = {
        type: 'PROCESSING_COMPLETE',
        payload: {
          exportMd: fullMarkdown,
          exportJson: exportData,
        },
      };
      
      await this.broadcastToPopup(response);
      
      // Record telemetry
      await Storage.recordTelemetry({
        event: 'clean',
        data: {
          mode: settings.mode,
          durationMs: Date.now() - new Date(metadata.capturedAt).getTime(),
        },
        timestamp: new Date().toISOString(),
      });
      
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
    // @ts-expect-error MV3 API
    const contexts = await browser.runtime.getContexts?.({
      // @ts-expect-error MV3 API
      contextTypes: [browser.runtime.ContextType?.OFFSCREEN_DOCUMENT ?? 'OFFSCREEN_DOCUMENT'],
      documentUrls: [offscreenUrl],
    });

    if (Array.isArray(contexts) && contexts.length > 0) {
      return;
    }

    // @ts-expect-error MV3 API
    await browser.offscreen.createDocument({
      url: this.offscreenPath,
      // @ts-expect-error MV3 API
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