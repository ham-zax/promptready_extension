// Content capture module - runs in content script context
// Based on Architecture Section 7 (Core Modules)

import { FileNamingService } from '../lib/fileNaming.js';
import type { CaptureDiagnostics, CapturePolicy } from '../lib/types.js';

export interface CaptureResult {
  html: string;
  url: string;
  title: string;
  selectionHash: string;
  isSelection?: boolean;
  metadataHtml?: string;
  captureDiagnostics?: CaptureDiagnostics;
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
  private static readonly DEFAULT_CAPTURE_POLICY: CapturePolicy = {
    settleTimeoutMs: 600,
    quietWindowMs: 150,
    deepCaptureEnabled: false,
    maxScrollSteps: 5,
    maxScrollDurationMs: 3000,
    scrollStepDelayMs: 180,
    minTextGainRatio: 0.2,
    minHeadingGain: 2,
  };

  /**
   * Capture the current selection and page metadata
   * This is the content script's primary responsibility
   */
  static async captureSelection(capturePolicyInput?: Partial<CapturePolicy>): Promise<CaptureResult> {
    try {
      // Prepare DOM (improves base URL resolution, math capture, and hidden-node handling)
      this.ensureBase();
      this.ensureTitle();
      this.addLatexToMathJax3();
      this.markHiddenNodes(document.documentElement);
      const metadataHtml = this.captureMetadataHtml();

      const selection = window.getSelection();

      if (!selection || selection.rangeCount === 0) {
        // If no selection, try to capture the main content area
        console.log('No selection found, attempting to capture main content...');
        return await this.captureFullPage(capturePolicyInput);
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
        return await this.captureFullPage(capturePolicyInput);
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
        metadataHtml,
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
   * Capture page-level metadata signals (head meta/JSON-LD + time/byline elements) so
   * selection captures can still retain publish/update timestamps.
   *
   * This is not an extraction decision: it is just boundary data passed to the offscreen
   * orchestrator for metadata enrichment when the selection omits those nodes.
   */
  private static captureMetadataHtml(): string {
    try {
      const headParts: string[] = [];
      const bodyParts: string[] = [];

      const head = document.head;
      if (head) {
        const titleEl = head.querySelector('title');
        if (titleEl) headParts.push(titleEl.outerHTML);

        const metas = Array.from(head.querySelectorAll('meta')) as HTMLMetaElement[];
        for (const meta of metas) {
          const name = (meta.getAttribute('name') || '').toLowerCase();
          const property = (meta.getAttribute('property') || '').toLowerCase();
          const itemprop = (meta.getAttribute('itemprop') || '').toLowerCase();
          const key = `${name} ${property} ${itemprop}`.trim();
          if (!key) continue;
          if (/(published|publish|pubdate|date|time|modified|updated|update|author|byline|og:|article:)/.test(key)) {
            headParts.push(meta.outerHTML);
          }
        }

        const jsonLdScripts = Array.from(head.querySelectorAll('script[type="application/ld+json"]')) as HTMLScriptElement[];
        for (const script of jsonLdScripts) {
          const text = script.textContent || '';
          if (!text.trim()) continue;
          // Guard: avoid shipping massive JSON-LD blobs through extension messaging.
          if (text.length > 200_000) continue;
          headParts.push(`<script type="application/ld+json">${text}</script>`);
        }
      }

      const root = document.body || document.documentElement;
      if (root) {
        const selector =
          'time, [datetime], [itemprop="datePublished"], [itemprop="dateModified"], .dateline, .byline, [class*="timestamp"], [class*="publish"], [class*="update"], [class*="date"], [class*="time"], [id*="date"], [id*="time"], [data-time], [data-timestamp], [data-date], [data-published], [data-updated]';
        const nodes = Array.from(root.querySelectorAll(selector)).slice(0, 30);
        const seen = new Set<string>();

        for (const node of nodes) {
          if (!(node instanceof HTMLElement)) continue;
          const datetime = node.getAttribute('datetime') || '';
          const text = (node.textContent || '').trim().slice(0, 80);
          const key = `${node.tagName}:${datetime}:${node.className || ''}:${text}`;
          if (seen.has(key)) continue;
          seen.add(key);
          bodyParts.push(node.outerHTML);
        }
      }

      if (headParts.length === 0 && bodyParts.length === 0) {
        return '';
      }

      return `<!doctype html><html><head>${headParts.join('\\n')}</head><body>${bodyParts.join('\\n')}</body></html>`;
    } catch (error) {
      console.warn('[ContentCapture] Failed to capture metadata HTML signals:', error);
      return '';
    }
  }

  /**
   * Capture full page content (fallback when no selection)
   * Captures a sanitized full-page snapshot. Extraction decisions are centralized
   * in the offscreen pipeline to avoid double-processing loss.
   */
  static async captureFullPage(capturePolicyInput?: Partial<CapturePolicy>): Promise<CaptureResult> {
    try {
      console.log('captureFullPage: Starting full page capture...');
      const policy = this.normalizeCapturePolicy(capturePolicyInput);
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
      const metadataHtml = this.captureMetadataHtml();

      const settle = await this.waitForDomSettle(policy);
      const initialSnapshot = this.createSanitizedSnapshot();
      const initialScrollHeight = this.getDocumentScrollHeight();

      let deepSnapshot = initialSnapshot;
      let deepCandidateSnapshot = initialSnapshot;
      let scrollStepsExecuted = 0;
      let finalScrollHeight = initialScrollHeight;
      let deepUsedReason = 'initial-snapshot-selected';
      let usedDeepSnapshot = false;

      if (policy.deepCaptureEnabled) {
        const deepCapture = await this.captureDeepSnapshot(policy);
        deepCandidateSnapshot = deepCapture.snapshot;
        scrollStepsExecuted = deepCapture.scrollStepsExecuted;
        finalScrollHeight = deepCapture.finalScrollHeight;

        const textGainRatio = initialSnapshot.textLength > 0
          ? (deepCandidateSnapshot.textLength - initialSnapshot.textLength) / initialSnapshot.textLength
          : (deepCandidateSnapshot.textLength > 0 ? 1 : 0);
        const headingGain = deepCandidateSnapshot.headingCount - initialSnapshot.headingCount;
        const shouldUseDeepSnapshot =
          deepCandidateSnapshot.textLength > initialSnapshot.textLength &&
          (
            textGainRatio >= policy.minTextGainRatio ||
            headingGain >= policy.minHeadingGain
          );

        if (shouldUseDeepSnapshot) {
          deepSnapshot = deepCandidateSnapshot;
          usedDeepSnapshot = true;
          deepUsedReason = `deep-snapshot-retained(textGainRatio=${textGainRatio.toFixed(3)},headingGain=${headingGain})`;
        } else {
          deepSnapshot = initialSnapshot;
          deepUsedReason = `deep-snapshot-rejected(textGainRatio=${textGainRatio.toFixed(3)},headingGain=${headingGain})`;
        }
      } else {
        deepUsedReason = 'deep-capture-disabled-by-policy';
      }

      const html = deepSnapshot.html;
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
        metadataHtml,
        captureDiagnostics: {
          strategy: usedDeepSnapshot ? 'deep-body-html' : 'initial-body-html',
          settleWaitMs: settle.waitedMs,
          settleTimedOut: settle.timedOut,
          scrollStepsExecuted,
          initialScrollHeight,
          finalScrollHeight,
          initialTextLength: initialSnapshot.textLength,
          deepTextLength: deepCandidateSnapshot.textLength,
          headingCountDelta: deepCandidateSnapshot.headingCount - initialSnapshot.headingCount,
          deepUsedReason,
        },
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
    } catch {
      // Best-effort DOM normalization for pages with restricted head mutation.
    }
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
    } catch {
      // Best-effort title injection; safe to skip when DOM is locked down.
    }
  }

  private static addLatexToMathJax3(): void {
    try {
      const mathJax = (globalThis as typeof globalThis & { MathJax?: MathJaxGlobal }).MathJax;
      const mathNodes = mathJax?.startup?.document?.math;
      if (!mathNodes) return;
      for (const math of mathNodes) {
        math.typesetRoot?.setAttribute?.('markdownload-latex', math.math ?? '');
      }
    } catch {
      // MathJax may not be available on most pages.
    }
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

  private static normalizeCapturePolicy(policyInput?: Partial<CapturePolicy>): CapturePolicy {
    const policy = policyInput || {};
    const clamp = (value: unknown, min: number, max: number, fallback: number): number => {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fallback;
      }
      return Math.min(max, Math.max(min, value));
    };

    return {
      settleTimeoutMs: clamp(policy.settleTimeoutMs, 0, 10_000, this.DEFAULT_CAPTURE_POLICY.settleTimeoutMs),
      quietWindowMs: clamp(policy.quietWindowMs, 50, 2_000, this.DEFAULT_CAPTURE_POLICY.quietWindowMs),
      deepCaptureEnabled:
        typeof policy.deepCaptureEnabled === 'boolean'
          ? policy.deepCaptureEnabled
          : this.DEFAULT_CAPTURE_POLICY.deepCaptureEnabled,
      maxScrollSteps: Math.floor(clamp(policy.maxScrollSteps, 0, 20, this.DEFAULT_CAPTURE_POLICY.maxScrollSteps)),
      maxScrollDurationMs: clamp(
        policy.maxScrollDurationMs,
        200,
        10_000,
        this.DEFAULT_CAPTURE_POLICY.maxScrollDurationMs
      ),
      scrollStepDelayMs: clamp(policy.scrollStepDelayMs, 0, 1_000, this.DEFAULT_CAPTURE_POLICY.scrollStepDelayMs),
      minTextGainRatio: clamp(policy.minTextGainRatio, 0, 2, this.DEFAULT_CAPTURE_POLICY.minTextGainRatio),
      minHeadingGain: Math.floor(clamp(policy.minHeadingGain, 0, 20, this.DEFAULT_CAPTURE_POLICY.minHeadingGain)),
    };
  }

  private static getDocumentScrollHeight(): number {
    return Math.max(
      document.documentElement?.scrollHeight || 0,
      document.body?.scrollHeight || 0
    );
  }

  private static getScrollY(): number {
    return window.scrollY || window.pageYOffset || document.documentElement?.scrollTop || 0;
  }

  private static async waitForDomSettle(policy: CapturePolicy): Promise<{ waitedMs: number; timedOut: boolean }> {
    const timeoutMs = policy.settleTimeoutMs;
    const quietWindowMs = policy.quietWindowMs;
    if (timeoutMs <= 0) {
      return { waitedMs: 0, timedOut: false };
    }

    const start = Date.now();
    try {
      return await new Promise((resolve) => {
        let settled = false;
        let lastMutationAt = Date.now();
        let observer: MutationObserver | null = null;
        let pollTimer: number | null = null;
        let timeoutTimer: number | null = null;

        const finish = (timedOut: boolean): void => {
          if (settled) {
            return;
          }
          settled = true;
          if (observer) {
            observer.disconnect();
            observer = null;
          }
          if (pollTimer !== null) {
            window.clearInterval(pollTimer);
            pollTimer = null;
          }
          if (timeoutTimer !== null) {
            window.clearTimeout(timeoutTimer);
            timeoutTimer = null;
          }
          resolve({ waitedMs: Date.now() - start, timedOut });
        };

        if (typeof MutationObserver !== 'undefined') {
          observer = new MutationObserver(() => {
            lastMutationAt = Date.now();
          });
          observer.observe(document.documentElement, {
            subtree: true,
            childList: true,
            attributes: true,
            characterData: true,
          });
        }

        pollTimer = window.setInterval(() => {
          if (Date.now() - lastMutationAt >= quietWindowMs) {
            finish(false);
          }
        }, Math.min(quietWindowMs, 120));

        timeoutTimer = window.setTimeout(() => finish(true), timeoutMs);
      });
    } catch (error) {
      console.warn('[ContentCapture] waitForDomSettle failed open:', error);
      return { waitedMs: Date.now() - start, timedOut: true };
    }
  }

  private static createSanitizedSnapshot(): { html: string; textLength: number; headingCount: number } {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = document.body?.innerHTML || document.documentElement?.innerHTML || '';
    this.removeUnwantedTags(tempDiv);
    this.fixRelativeUrls(tempDiv, window.location.href);
    const html = tempDiv.innerHTML;
    const textLength = (tempDiv.textContent || '').replace(/\s+/g, ' ').trim().length;
    const headingCount = tempDiv.querySelectorAll('h1,h2,h3,h4,h5,h6').length;
    return { html, textLength, headingCount };
  }

  private static async captureDeepSnapshot(policy: CapturePolicy): Promise<{
    snapshot: { html: string; textLength: number; headingCount: number };
    scrollStepsExecuted: number;
    finalScrollHeight: number;
  }> {
    const maxSteps = policy.maxScrollSteps;
    if (maxSteps <= 0) {
      return {
        snapshot: this.createSanitizedSnapshot(),
        scrollStepsExecuted: 0,
        finalScrollHeight: this.getDocumentScrollHeight(),
      };
    }

    const originalScrollY = this.getScrollY();
    const originalScrollX = window.scrollX || 0;
    const start = Date.now();
    let steps = 0;
    let scrollSupported = true;

    try {
      while (steps < maxSteps && (Date.now() - start) < policy.maxScrollDurationMs) {
        const scrollHeight = this.getDocumentScrollHeight();
        const maxY = Math.max(0, scrollHeight - window.innerHeight);
        const ratio = (steps + 1) / maxSteps;
        const targetY = Math.floor(maxY * ratio);
        try {
          window.scrollTo(originalScrollX, targetY);
        } catch (error) {
          scrollSupported = false;
          console.warn('[ContentCapture] captureDeepSnapshot: window.scrollTo unavailable, using initial snapshot', error);
          break;
        }
        steps++;
        if (policy.scrollStepDelayMs > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, policy.scrollStepDelayMs));
        }
      }
      if (!scrollSupported) {
        return {
          snapshot: this.createSanitizedSnapshot(),
          scrollStepsExecuted: 0,
          finalScrollHeight: this.getDocumentScrollHeight(),
        };
      }
      await this.waitForDomSettle({ ...policy, settleTimeoutMs: Math.min(policy.settleTimeoutMs, 1200) });
      const snapshot = this.createSanitizedSnapshot();
      return {
        snapshot,
        scrollStepsExecuted: steps,
        finalScrollHeight: this.getDocumentScrollHeight(),
      };
    } finally {
      try {
        window.scrollTo(originalScrollX, originalScrollY);
      } catch {
        // Ignore restore failures in non-windowed test environments.
      }
    }
  }
}
