// Core cleaner module - orchestrates the cleaning pipeline
// Based on Architecture Section 7 (Core Modules)

import { BoilerplateFilter } from './filters/boilerplate-filters.js';

export interface CleanerOptions {
  mode: 'general' | 'code_docs';
  preserveCodeBlocks: boolean;
  preserveTables: boolean;
  removeHiddenElements: boolean;
}

export interface CleanerResult {
  cleanedHtml: string;
  metadata: {
    originalLength: number;
    cleanedLength: number;
    elementsRemoved: number;
  };
}

export class ContentCleaner {
  
  /**
   * Main cleaning pipeline
   * 1. Apply boilerplate filters
   * 2. Process with Readability (if available)
   * 3. Sanitize with DOMPurify-like logic
   */
  static async clean(html: string, url: string, options: CleanerOptions): Promise<CleanerResult> {
    try {
      const startTime = performance.now();
      const originalLength = html.length;
      
      // Parse HTML into DOM
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      if (!doc.body) {
        throw new Error('Invalid HTML content');
      }
      
      // Track elements for metrics
      const originalElementCount = doc.body.querySelectorAll('*').length;
      
      // Step 1: Apply boilerplate filters
      this.applyBoilerplateFilters(doc.body, options);
      
      // Step 2: Remove hidden elements if requested
      if (options.removeHiddenElements) {
        BoilerplateFilter.removeHiddenElements(doc.body);
      }
      
      // Step 3: Apply Readability-style cleaning
      const cleanedContent = this.applyReadabilityLikeCleaning(doc.body, options);
      
      // Step 4: Sanitize content
      const sanitizedContent = this.sanitizeContent(cleanedContent, options);
      
      // Step 5: Final cleanup
      BoilerplateFilter.cleanupEmptyElements(sanitizedContent);
      
      const finalElementCount = sanitizedContent.querySelectorAll('*').length;
      const cleanedHtml = sanitizedContent.innerHTML;
      
      const processingTime = performance.now() - startTime;
      console.log(`Content cleaning completed in ${processingTime.toFixed(2)}ms`);
      
      return {
        cleanedHtml,
        metadata: {
          originalLength,
          cleanedLength: cleanedHtml.length,
          elementsRemoved: originalElementCount - finalElementCount,
        },
      };
      
    } catch (error) {
      console.error('Content cleaning failed:', error);
      throw error;
    }
  }
  
  /**
   * Apply boilerplate filtering rules
   */
  private static applyBoilerplateFilters(element: HTMLElement, options: CleanerOptions): void {
    BoilerplateFilter.applyRules(element, options.mode);
  }
  
  /**
   * Apply Readability-style content extraction
   * This is a simplified version focusing on the main content
   */
  private static applyReadabilityLikeCleaning(element: HTMLElement, options: CleanerOptions): HTMLElement {
    const container = element.cloneNode(true) as HTMLElement;
    
    // Remove script and style elements
    const scriptsAndStyles = Array.from(container.querySelectorAll('script, style, noscript'));
    scriptsAndStyles.forEach(el => el.remove());
    
    // Remove elements with very low content density (likely ads or UI)
    this.removeLowContentDensityElements(container, options);
    
    // Promote content-rich elements
    this.promoteContentElements(container, options);
    
    return container;
  }
  
  /**
   * Remove elements with low content density
   */
  private static removeLowContentDensityElements(element: HTMLElement, options: CleanerOptions): void {
    const allElements = Array.from(element.querySelectorAll('div, section, article, aside'));
    
    for (const el of allElements) {
      // Skip if it contains preserved elements
      if (options.preserveCodeBlocks && el.querySelector('pre, code')) {
        continue;
      }
      if (options.preserveTables && el.querySelector('table')) {
        continue;
      }
      
      const textContent = el.textContent || '';
      const linkContent = Array.from(el.querySelectorAll('a')).reduce((acc, link) => acc + (link.textContent || ''), '');
      const textLength = textContent.length;
      const linkLength = linkContent.length;
      
      // Remove elements where links dominate the content (likely navigation)
      if (textLength > 0 && linkLength / textLength > 0.8) {
        el.remove();
        continue;
      }
      
      // Remove elements with very little text content
      if (textLength < 25 && !el.querySelector('img, video, audio, iframe')) {
        el.remove();
      }
    }
  }
  
  /**
   * Promote elements that likely contain main content
   */
  private static promoteContentElements(element: HTMLElement, options: CleanerOptions): void {
    // Look for article, main, or content containers
    const contentContainers = Array.from(element.querySelectorAll('article, main, [role="main"], .content, .post, .entry'));
    
    if (contentContainers.length === 1) {
      // If there's a single clear content container, promote its content
      const container = contentContainers[0];
      const parent = container.parentNode;
      if (parent && parent !== element) {
        // Move content up in the hierarchy
        while (container.firstChild) {
          parent.insertBefore(container.firstChild, container);
        }
        container.remove();
      }
    }
  }
  
  /**
   * Sanitize content for security and cleanliness
   */
  private static sanitizeContent(element: HTMLElement, options: CleanerOptions): HTMLElement {
    const container = element.cloneNode(true) as HTMLElement;
    
    // Remove potentially dangerous elements and attributes
    this.removeDangerousElements(container);
    this.cleanAttributes(container, options);
    
    return container;
  }
  
  /**
   * Remove elements that could be security risks or cause issues
   */
  private static removeDangerousElements(element: HTMLElement): void {
    const dangerousElements = Array.from(element.querySelectorAll(
      'script, object, embed, applet, meta, link[rel="stylesheet"], style'
    ));
    
    dangerousElements.forEach(el => el.remove());
  }
  
  /**
   * Clean and preserve only useful attributes
   */
  private static cleanAttributes(element: HTMLElement, options: CleanerOptions): void {
    // Define allowed attributes per element type
    const allowedAttributes: Record<string, string[]> = {
      'a': ['href', 'title'],
      'img': ['src', 'alt', 'title', 'width', 'height'],
      'video': ['src', 'controls', 'width', 'height'],
      'audio': ['src', 'controls'],
      'table': ['border', 'cellpadding', 'cellspacing'],
      'th': ['colspan', 'rowspan'],
      'td': ['colspan', 'rowspan'],
      'pre': ['class'], // Preserve class for code highlighting
      'code': ['class'], // Preserve class for language identification
    };
    
    // For Code & Docs mode, preserve more attributes on code elements
    if (options.mode === 'code_docs') {
      allowedAttributes['pre'].push('data-language', 'data-filename');
      allowedAttributes['code'].push('data-language');
    }
    
    const allElements = Array.from(element.querySelectorAll('*'));
    
    for (const el of allElements) {
      const tagName = el.tagName.toLowerCase();
      const allowed = allowedAttributes[tagName] || [];
      
      // Remove all attributes except allowed ones
      const attributesToRemove: string[] = [];
      for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes[i];
        if (!allowed.includes(attr.name)) {
          attributesToRemove.push(attr.name);
        }
      }
      
      attributesToRemove.forEach(attrName => {
        el.removeAttribute(attrName);
      });
    }
  }
  
  /**
   * Quick validation of cleaned content
   */
  static validateCleanedContent(html: string): boolean {
    try {
      // Check if HTML is parseable
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Check if there's meaningful content
      const textContent = doc.body?.textContent?.trim() || '';
      if (textContent.length < 10) {
        return false;
      }
      
      // Check for common issues
      const hasScript = doc.querySelector('script') !== null;
      const hasStyle = doc.querySelector('style') !== null;
      
      return !hasScript && !hasStyle;
      
    } catch (error) {
      console.error('Content validation failed:', error);
      return false;
    }
  }
}
