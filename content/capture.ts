// Content capture module - runs in content script context
// Based on Architecture Section 7 (Core Modules)

import { FileNamingService } from '../lib/fileNaming.js';
import type { PipelineResult } from '../core/graceful-degradation-pipeline.js';

export interface CaptureResult {
  html: string;
  url: string;
  title: string;
  selectionHash: string;
  isSelection?: boolean;
  pipelineMetadata?: PipelineResult;
}

type MathJaxNode = {
  math?: string;
  typesetRoot?: {
    setAttribute?: (name: string, value: string) => void;
  };
};

type MathJaxGlobal = {
  startup?: {
    document?: {
      math?: MathJaxNode[];
    };
  };
};

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

        // Remove unwanted tags from selection (scripts, styles, etc.)
        this.removeUnwantedTags(wrapper);

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

      // Generate selection hash for citation integrity (USE PROCESSED HTML)
      const selectionHash = await FileNamingService.generateSelectionHash(processedHtml);

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

  private static removeUnwantedTags(element: HTMLElement): void {
    const selectors = 'script, style, noscript, template, link[rel="stylesheet"]';
    try {
      element.querySelectorAll(selectors).forEach(el => (el as HTMLElement).remove());
    } catch (e) {
      console.warn('[ContentCapture] Failed to remove some unwanted tags:', e);
    }
  }

  /**
   * Capture full page content (fallback when no selection)
   * Captures a sanitized full-page snapshot. Extraction decisions are centralized
   * in the offscreen pipeline to avoid double-processing loss.
   */
  static async captureFullPage(): Promise<CaptureResult> {
    try {
      console.log('captureFullPage: Starting full page capture...');
      // Prepare DOM before capture
      this.ensureBase();
      this.ensureTitle();
      this.addLatexToMathJax3();
      // Mark hidden nodes (global behavior; no domain-specific exceptions)
      try {
        this.markHiddenNodes(document.documentElement);
      } catch (e) {
        console.warn('[ContentCapture] markHiddenNodes failed during captureFullPage:', e);
      }

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = document.body?.innerHTML || document.documentElement?.innerHTML || '';
      this.removeUnwantedTags(tempDiv);
      this.fixRelativeUrls(tempDiv, window.location.href);

      const html = tempDiv.innerHTML;
      if (!html.trim()) {
        throw new Error('No capturable full-page HTML content found');
      }
      console.log('captureFullPage: HTML content length:', html.length);
      console.log('captureFullPage: Generating selection hash...');
      const selectionHash = await FileNamingService.generateSelectionHash(html);
      console.log(
        'captureFullPage: Selection hash generated:',
        selectionHash.substring(0, 16) + '...'
      );

      const result: CaptureResult = {
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

  // ===================== DOM Prep Helpers (adapted from MarkDownload) =====================
  private static ensureBase(): void {
    try {
      const head = document.head || document.getElementsByTagName('head')[0];
      if (!head) return;
      const existing = head.querySelector('base');
      const baseEl = existing ?? head.appendChild(document.createElement('base'));
      const href = baseEl.getAttribute('href');
      if (!href || !href.startsWith(window.location.origin)) {
        baseEl.setAttribute('href', window.location.href);
      }
    } catch { }
  }

  private static ensureTitle(): void {
    try {
      const head = document.head || document.getElementsByTagName('head')[0];
      if (!head) return;
      if (head.getElementsByTagName('title').length === 0) {
        const titleEl = document.createElement('title');
        titleEl.innerText = document.title || window.location.hostname;
        head.appendChild(titleEl);
      }
    } catch { }
  }

  private static addLatexToMathJax3(): void {
    try {
      const mathJax = (globalThis as typeof globalThis & { MathJax?: MathJaxGlobal }).MathJax;
      const mathNodes = mathJax?.startup?.document?.math;
      if (!mathNodes) return;
      for (const math of mathNodes) {
        math.typesetRoot?.setAttribute?.('markdownload-latex', math.math ?? '');
      }
    } catch { }
  }

  private static markHiddenNodes(root: Element): void {
    try {
      const hiddenList: Element[] = [];
      const filter: NodeFilter = {
        acceptNode(node: Node): number {
          if (node.nodeType !== Node.ELEMENT_NODE) return NodeFilter.FILTER_SKIP;
          const el = node as Element;
          const nodeName = el.nodeName.toLowerCase();
          if (nodeName === 'math') return NodeFilter.FILTER_REJECT;
          const maybeOffsetParent = (el as Element & { offsetParent?: Element | null }).offsetParent;
          if (typeof maybeOffsetParent === 'undefined') return NodeFilter.FILTER_ACCEPT;
          const cs = window.getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.display === 'none') return NodeFilter.FILTER_ACCEPT;
          return NodeFilter.FILTER_SKIP;
        },
      };
      const iter = document.createNodeIterator(root, NodeFilter.SHOW_ELEMENT, filter);
      let current: Node | null;
      while ((current = iter.nextNode())) {
        const el = current as Element;
        el.setAttribute('markdownload-hidden', 'true');
        hiddenList.push(el);
      }
      // Log count and a small sample to help debugging why visible content might be marked hidden
      try {
        const sample = hiddenList.slice(0, 10).map(e => ({
          tag: e.tagName,
          id: e.id,
          class: e.className,
          text: (e.textContent || '').trim().slice(0, 120),
        }));
        console.log(`[ContentCapture] markHiddenNodes marked ${hiddenList.length} elements. Sample:`, sample);
      } catch {
        console.log('[ContentCapture] markHiddenNodes marked elements count:', hiddenList.length);
      }
    } catch (e) {
      console.warn('[ContentCapture] markHiddenNodes failed:', e);
    }
  }
}
