// Content capture module - runs in content script context
// Based on Architecture Section 7 (Core Modules)

import { FileNamingService } from '../lib/fileNaming.js';

export interface CaptureResult {
  html: string;
  url: string;
  title: string;
  selectionHash: string;
}

export class ContentCapture {
  
  /**
   * Capture the current selection and page metadata
   * This is the content script's primary responsibility
   */
  static async captureSelection(): Promise<CaptureResult> {
    try {
      const selection = window.getSelection();
      
      if (!selection || selection.rangeCount === 0) {
        // If no selection, try to capture the main content area
        console.log('No selection found, attempting to capture main content...');
        return await this.captureFullPage();
      }
      
      // Get the selected range
      const range = selection.getRangeAt(0);
      
      // Check if the selection is collapsed (just a cursor, no actual selection)
      if (range.collapsed) {
        console.log('Selection is collapsed, attempting to capture main content...');
        return await this.captureFullPage();
      }
      
      // Create a document fragment with the selection
      const fragment = range.cloneContents();
      
      // Create a temporary container to get the HTML
      const tempDiv = document.createElement('div');
      tempDiv.appendChild(fragment);
      
      // Get the HTML content
      const html = tempDiv.innerHTML;
      
      if (!html.trim()) {
        console.log('Selected content is empty, attempting to capture main content...');
        return await this.captureFullPage();
      }
      
      // Fix relative URLs to absolute URLs before sending to service worker
      this.fixRelativeUrls(tempDiv, window.location.href);
      const processedHtml = tempDiv.innerHTML;
      
      // Generate selection hash for citation integrity
      const selectionHash = await FileNamingService.generateSelectionHash(html);
      
      // Get page metadata
      const title = this.extractPageTitle();
      const url = window.location.href;
      
      return {
        html: processedHtml,
        url,
        title,
        selectionHash,
      };
      
    } catch (error) {
      console.error('Content capture failed:', error);
      throw error;
    }
  }
  
  /**
   * Extract page title with fallbacks
   */
  private static extractPageTitle(): string {
    // Try document title first
    let title = document.title?.trim();
    
    if (!title) {
      // Fallback to h1
      const h1 = document.querySelector('h1');
      title = h1?.textContent?.trim() || '';
    }
    
    if (!title) {
      // Fallback to meta title
      const metaTitle = document.querySelector('meta[property="og:title"]');
      title = metaTitle?.getAttribute('content')?.trim() || '';
    }
    
    // Final fallback
    return title || 'Untitled Page';
  }
  
  /**
   * Fix relative URLs to absolute URLs
   * This ensures links and images work correctly in exports
   */
  private static fixRelativeUrls(element: HTMLElement, baseUrl: string): void {
    try {
      // Fix anchor links
      element.querySelectorAll('a[href]').forEach((anchor) => {
        const href = anchor.getAttribute('href');
        if (href && !this.isAbsoluteUrl(href)) {
          anchor.setAttribute('href', new URL(href, baseUrl).href);
        }
      });
      
      // Fix image sources
      element.querySelectorAll('img[src]').forEach((img) => {
        const src = img.getAttribute('src');
        if (src && !this.isAbsoluteUrl(src)) {
          img.setAttribute('src', new URL(src, baseUrl).href);
        }
      });
      
      // Fix video sources
      element.querySelectorAll('video[src]').forEach((video) => {
        const src = video.getAttribute('src');
        if (src && !this.isAbsoluteUrl(src)) {
          video.setAttribute('src', new URL(src, baseUrl).href);
        }
      });
      
      // Fix source elements (inside video/audio)
      element.querySelectorAll('source[src]').forEach((source) => {
        const src = source.getAttribute('src');
        if (src && !this.isAbsoluteUrl(src)) {
          source.setAttribute('src', new URL(src, baseUrl).href);
        }
      });
      
    } catch (error) {
      console.warn('Failed to fix some relative URLs:', error);
      // Don't throw - URL fixing is nice-to-have, not critical
    }
  }
  
  /**
   * Check if URL is absolute
   */
  private static isAbsoluteUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Capture full page content (fallback when no selection)
   * Uses similar logic to MarkDownload implementation
   */
  static async captureFullPage(): Promise<CaptureResult> {
    try {
      // Get the main content area
      const article = document.querySelector('article, main, [role="main"]');
      const content = article || document.body;
      
      if (!content) {
        throw new Error('No content found on the page.');
      }
      
      // Clone the content to avoid modifying the original page
      const clonedContent = content.cloneNode(true) as HTMLElement;
      
      // Fix relative URLs
      this.fixRelativeUrls(clonedContent, window.location.href);
      
      const html = clonedContent.innerHTML;
      const selectionHash = await FileNamingService.generateSelectionHash(html);
      
      return {
        html,
        url: window.location.href,
        title: this.extractPageTitle(),
        selectionHash,
      };
      
    } catch (error) {
      console.error('Full page capture failed:', error);
      throw error;
    }
  }
}
