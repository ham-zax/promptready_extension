export default defineBackground(() => {
  console.log('PromptReady background service worker initialized');
  
  // Initialize the processing pipeline
  const processor = new ContentProcessor();
  
  // Handle keyboard shortcut
  browser.commands?.onCommand.addListener(async (command) => {
    if (command === 'capture-selection') {
      await processor.handleCaptureCommand();
    }
  });
  
  // Handle messages from content script and popup
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
import { ContentCleaner } from '../core/cleaner.js';
import { ContentStructurer } from '../core/structurer.js';
import { Storage } from '../lib/storage.js';
import { fileNaming } from '../lib/fileNaming.js';
import type { 
  MessageType, 
  Message, 
  CaptureCompleteMessage, 
  ExportRequestMessage,
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
    sender: chrome.runtime.MessageSender, 
    sendResponse: (response?: any) => void
  ): Promise<boolean> {
    try {
      switch (message.type) {
        case 'CAPTURE_COMPLETE':
          await this.handleCaptureComplete(message as CaptureCompleteMessage);
          break;
          
        case 'EXPORT_REQUEST':
          await this.handleExportRequest(message as ExportRequestMessage);
          break;
          
        default:
          console.warn('Unknown message type:', message.type);
      }
      
      return true; // Keep message channel open for async responses
      
    } catch (error) {
      console.error('Message handling failed:', error);
      this.broadcastError(`Processing failed: ${error.message}`);
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
      
      const exportData = await ContentStructurer.structure(
        cleanResult.cleanedHtml,
        metadata,
        structurerOptions
      );
      
      // Step 3: Generate Markdown
      const exportMd = ContentStructurer.blocksToMarkdown(exportData.blocks);
      const citationFooter = ContentStructurer.generateCitationFooter(metadata);
      const fullMarkdown = `${exportMd}\n\n${citationFooter}`;
      
      // Step 4: Store export data and broadcast results to popup
      this.currentExportData = {
        markdown: fullMarkdown,
        json: exportData,
        metadata,
      };

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
      this.broadcastError(`Failed to process content: ${error.message}`);
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
      this.broadcastError(`Export failed: ${error.message}`);
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
    if (!this.currentExportData) {
      throw new Error('No content to copy');
    }

    const content = format === 'md' 
      ? this.currentExportData.markdown 
      : JSON.stringify(this.currentExportData.json, null, 2);
    
    // Copy to clipboard using the Chrome extension API
    // Note: This requires the clipboardWrite permission
    try {
      await navigator.clipboard.writeText(content);
    } catch (error) {
      // Fallback method for older browsers or missing permissions
      console.warn('Clipboard API failed, using fallback method:', error);
      
      // Send message to content script to handle clipboard
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab.id) {
        await browser.tabs.sendMessage(tab.id, {
          type: 'COPY_TO_CLIPBOARD',
          payload: { content },
        });
      }
    }
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
}
