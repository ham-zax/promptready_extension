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
      await browser.tabs.sendMessage(tab.id, { type: 'CAPTURE_SELECTION' });
      
    } catch (error) {
      console.error('Failed to handle capture command:', error);
      this.broadcastError('Failed to capture content. Please try again.');
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
      
      // Step 4: Broadcast results to popup
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
      
      const { format, action } = message.payload;
      
      // Get the current processed data (would be stored in service worker state)
      // For now, we'll need to get this from the popup or re-process
      // This is a simplified implementation
      
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
          action,
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
    // This would need access to the current export data
    // Implementation will be completed when we have the popup state management
    console.log(`Download ${format} requested`);
  }
  
  /**
   * Handle clipboard copy
   */
  async handleCopy(format: 'md' | 'json'): Promise<void> {
    // This would need access to the current export data  
    // Implementation will be completed when we have the popup state management
    console.log(`Copy ${format} requested`);
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
