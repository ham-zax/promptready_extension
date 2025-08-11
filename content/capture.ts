// Content capture module - runs in content script context
// Based on Architecture Section 7 (Core Modules)

import { FileNamingService } from '../lib/fileNaming.js';

export interface CaptureResult {
  html: string;
  url: string;
  title: string;
  selectionHash: string;
  isSelection?: boolean;
}

export class ContentCapture {
  
  /**
   * Capture the current selection and page metadata
   * This is the content script's primary responsibility
   */
  static async captureSelection(): Promise<CaptureResult> {
    try {
      // Prepare DOM (improves base URL resolution, math capture, and hidden-node handling)
      this.ensureBase();
      this.ensureTitle();
      this.addLatexToMathJax3();
      this.markHiddenNodes(document.documentElement);

      const selection = window.getSelection();
      
      if (!selection || selection.rangeCount === 0) {
        // If no selection, try to capture the main content area
        console.log('No selection found, attempting to capture main content...');
        return await this.captureFullPage();
      }
      
      // Build combined HTML of all ranges
      const tempDiv = document.createElement('div');
      for (let i = 0; i < selection.rangeCount; i++) {
        const r = selection.getRangeAt(i);
        if (r.collapsed) continue;
        const frag = r.cloneContents();
        const wrapper = document.createElement('div');
        wrapper.appendChild(frag);
        tempDiv.appendChild(wrapper);
      }
      
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
        isSelection: true,
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
      console.log('captureFullPage: Starting full page capture...');
      // Prepare DOM before capture
      this.ensureBase();
      this.ensureTitle();
      this.addLatexToMathJax3();
      this.markHiddenNodes(document.documentElement);
      // Get the main content area
      const article = document.querySelector('article, main, [role="main"]');
      const content = article || document.body;
      console.log('captureFullPage: Content element found:', !!content, 'Type:', content?.tagName);
      
      if (!content) {
        throw new Error('No content found on the page.');
      }
      
      // Clone the content to avoid modifying the original page
      const clonedContent = content.cloneNode(true) as HTMLElement;
      
      // Fix relative URLs
      this.fixRelativeUrls(clonedContent, window.location.href);
      
      const html = clonedContent.innerHTML;
      console.log('captureFullPage: HTML content length:', html.length);
      console.log('captureFullPage: Generating selection hash...');
      const selectionHash = await FileNamingService.generateSelectionHash(html);
      console.log('captureFullPage: Selection hash generated:', selectionHash.substring(0, 16) + '...');
      
      const result = {
        html,
        url: window.location.href,
        title: this.extractPageTitle(),
        selectionHash,
        isSelection: false,
      };
      
      console.log('captureFullPage: Capture completed successfully');
      console.log('captureFullPage: Title:', result.title);
      console.log('captureFullPage: URL:', result.url);
      
      return result;
      
    } catch (error) {
      console.error('Full page capture failed:', error);
      throw error;
    }
  }
}

// ===================== DOM Prep Helpers (adapted from MarkDownload) =====================
export namespace ContentCapture {
  export function ensureBase(): void {
    try {
      const head = document.head || document.getElementsByTagName('head')[0];
      if (!head) return;
      const existing = head.querySelector('base');
      const baseEl = existing ?? head.appendChild(document.createElement('base'));
      const href = baseEl.getAttribute('href');
      if (!href || !href.startsWith(window.location.origin)) {
        baseEl.setAttribute('href', window.location.href);
      }
    } catch {}
  }

  export function ensureTitle(): void {
    try {
      const head = document.head || document.getElementsByTagName('head')[0];
      if (!head) return;
      if (head.getElementsByTagName('title').length === 0) {
        const titleEl = document.createElement('title');
        titleEl.innerText = document.title || window.location.hostname;
        head.append(titleEl);
      }
    } catch {}
  }

  export function addLatexToMathJax3(): void {
    try {
      // @ts-ignore Optional global
      if (!globalThis.MathJax?.startup?.document?.math) return;
      // @ts-ignore
      for (const math of globalThis.MathJax.startup.document.math) {
        math.typesetRoot?.setAttribute?.('markdownload-latex', math.math);
      }
    } catch {}
  }

  export function markHiddenNodes(root: Element): void {
    try {
      const filter: NodeFilter = {
        acceptNode(node: Node): number {
          if (node.nodeType !== Node.ELEMENT_NODE) return NodeFilter.FILTER_SKIP;
          const el = node as Element;
          const nodeName = el.nodeName.toLowerCase();
          if (nodeName === 'math') return NodeFilter.FILTER_REJECT;
          // @ts-ignore offsetParent may be undefined in some cases
          if ((el as any).offsetParent === void 0) return NodeFilter.FILTER_ACCEPT;
          const cs = window.getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.display === 'none') return NodeFilter.FILTER_ACCEPT;
          return NodeFilter.FILTER_SKIP;
        },
      };
      const iter = document.createNodeIterator(root, NodeFilter.SHOW_ELEMENT, filter);
      let current: Node | null;
      while ((current = iter.nextNode())) {
        (current as Element).setAttribute('markdownload-hidden', 'true');
      }
    } catch {}
  }
}
