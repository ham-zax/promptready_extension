// Centralized DOM utilities for consistent HTML parsing and manipulation
// Provides safe, reliable DOM operations with proper error handling

/**
 * Safely parse HTML string into a Document object
 * @param html - HTML string to parse
 * @param mimeType - MIME type for parsing (default: 'text/html')
 * @returns Parsed Document or null if parsing fails
 */
export function safeParseHTML(html: string, mimeType: string = 'text/html'): Document | null {
  try {
    if (!html || typeof html !== 'string') {
      console.warn('[DOMUtils] Invalid HTML input provided');
      return null;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, mimeType as DOMParserSupportedType);

    // Check for parsing errors
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      console.error('[DOMUtils] HTML parsing error:', parserError.textContent);
      return null;
    }

    return doc;
  } catch (error) {
    console.error('[DOMUtils] Failed to parse HTML:', error);
    return null;
  }
}

/**
 * Create a temporary DOM element for safe HTML manipulation
 * @param html - HTML content to wrap
 * @param tagName - Container tag name (default: 'div')
 * @returns HTMLElement container with the HTML content
 */
export function createTempElement(html: string, tagName: string = 'div'): HTMLElement {
  try {
    const element = document.createElement(tagName);
    element.innerHTML = html;
    return element;
  } catch (error) {
    console.error('[DOMUtils] Failed to create temp element:', error);
    // Return empty element as fallback
    return document.createElement(tagName);
  }
}

/**
 * Safely extract text content from HTML
 * @param html - HTML string
 * @returns Plain text content or empty string if extraction fails
 */
export function extractTextContent(html: string): string {
  try {
    const doc = safeParseHTML(html);
    if (!doc) {
      // Fallback: strip HTML tags with regex (less reliable but better than nothing)
      return html.replace(/<[^>]*>/g, '').trim();
    }

    return doc.body?.textContent?.trim() || '';
  } catch (error) {
    console.error('[DOMUtils] Failed to extract text content:', error);
    return '';
  }
}

/**
 * Remove unwanted elements from a document or element
 * @param container - Document or Element to clean
 * @param selectors - Array of CSS selectors for elements to remove
 */
export function removeUnwantedElements(
  container: Document | Element, 
  selectors: string[] = []
): void {
  try {
    const defaultSelectors = [
      'script', 'style', 'noscript',
      'nav', 'header', 'footer',
      '.ad', '.advertisement', '.ads',
      '.sidebar', '.menu', '.navigation',
      '.social', '.share', '.comments',
    ];

    const allSelectors = [...defaultSelectors, ...selectors];

    allSelectors.forEach(selector => {
      try {
        container.querySelectorAll(selector).forEach(el => {
          el.remove();
        });
      } catch (selectorError) {
        console.warn(`[DOMUtils] Failed to remove elements with selector "${selector}":`, selectorError);
      }
    });
  } catch (error) {
    console.error('[DOMUtils] Failed to remove unwanted elements:', error);
  }
}

/**
 * Fix relative URLs to absolute URLs in a document or element
 * @param container - Document or Element to process
 * @param baseUrl - Base URL for resolving relative URLs
 */
export function fixRelativeUrls(container: Document | Element, baseUrl: string): void {
  try {
    const base = new URL(baseUrl);

    // Fix href attributes (links)
    container.querySelectorAll('a[href]').forEach(link => {
      try {
        const href = link.getAttribute('href');
        if (href && !href.startsWith('http') && !href.startsWith('//')) {
          const absoluteUrl = new URL(href, base).href;
          link.setAttribute('href', absoluteUrl);
        }
      } catch (urlError) {
        console.warn('[DOMUtils] Failed to fix relative URL:', link.getAttribute('href'), urlError);
      }
    });

    // Fix src attributes (images, scripts, etc.)
    container.querySelectorAll('[src]').forEach(element => {
      try {
        const src = element.getAttribute('src');
        if (src && !src.startsWith('http') && !src.startsWith('//') && !src.startsWith('data:')) {
          const absoluteUrl = new URL(src, base).href;
          element.setAttribute('src', absoluteUrl);
        }
      } catch (urlError) {
        console.warn('[DOMUtils] Failed to fix relative src:', element.getAttribute('src'), urlError);
      }
    });

    // Fix srcset attributes
    container.querySelectorAll('[srcset]').forEach(element => {
      try {
        const srcset = element.getAttribute('srcset');
        if (srcset) {
          const fixedSrcset = srcset.replace(/([^\s,]+)/g, (url) => {
            if (!url.startsWith('http') && !url.startsWith('//') && !url.startsWith('data:')) {
              try {
                return new URL(url, base).href;
              } catch {
                return url;
              }
            }
            return url;
          });
          element.setAttribute('srcset', fixedSrcset);
        }
      } catch (urlError) {
        console.warn('[DOMUtils] Failed to fix srcset:', element.getAttribute('srcset'), urlError);
      }
    });
  } catch (error) {
    console.error('[DOMUtils] Failed to fix relative URLs:', error);
  }
}

/**
 * Extract content using semantic selectors
 * @param doc - Document to extract from
 * @param minLength - Minimum content length to consider valid (default: 500)
 * @returns HTML content or null if no suitable content found
 */
export function extractSemanticContent(doc: Document, minLength: number = 500): string | null {
  try {
    const semanticSelectors = [
      'article',
      'main',
      '[role="main"]',
      '.content',
      '.post-content',
      '.entry-content',
      '.article-content',
      '.story-content',
    ];

    for (const selector of semanticSelectors) {
      try {
        const element = doc.querySelector(selector);
        if (element && element.textContent && element.textContent.length >= minLength) {
          return element.innerHTML;
        }
      } catch (selectorError) {
        console.warn(`[DOMUtils] Failed to query selector "${selector}":`, selectorError);
      }
    }

    return null;
  } catch (error) {
    console.error('[DOMUtils] Failed to extract semantic content:', error);
    return null;
  }
}

/**
 * Ensure base element exists in document head
 * @param doc - Document to modify
 * @param baseUrl - Base URL to set
 */
export function ensureBaseElement(doc: Document, baseUrl: string): void {
  try {
    const head = doc.head || doc.getElementsByTagName('head')[0];
    if (!head) {
      console.warn('[DOMUtils] No head element found in document');
      return;
    }

    let baseElement = head.querySelector('base');
    if (!baseElement) {
      baseElement = doc.createElement('base');
      head.appendChild(baseElement);
    }

    const currentHref = baseElement.getAttribute('href');
    if (!currentHref || !currentHref.startsWith('http')) {
      baseElement.setAttribute('href', baseUrl);
    }
  } catch (error) {
    console.error('[DOMUtils] Failed to ensure base element:', error);
  }
}

/**
 * Clone a document safely
 * @param doc - Document to clone
 * @returns Cloned document or null if cloning fails
 */
export function cloneDocument(doc: Document): Document | null {
  try {
    return doc.cloneNode(true) as Document;
  } catch (error) {
    console.error('[DOMUtils] Failed to clone document:', error);
    return null;
  }
}

/**
 * Get document title with fallbacks
 * @param doc - Document to extract title from
 * @param fallbackUrl - Fallback URL to derive title from
 * @returns Document title or fallback
 */
export function getDocumentTitle(doc: Document, fallbackUrl?: string): string {
  try {
    // Try document title first
    if (doc.title && doc.title.trim()) {
      return doc.title.trim();
    }

    // Try title element
    const titleElement = doc.querySelector('title');
    if (titleElement && titleElement.textContent && titleElement.textContent.trim()) {
      return titleElement.textContent.trim();
    }

    // Try meta title
    const metaTitle = doc.querySelector('meta[property="og:title"], meta[name="title"]');
    if (metaTitle) {
      const content = metaTitle.getAttribute('content');
      if (content && content.trim()) {
        return content.trim();
      }
    }

    // Try h1 as last resort
    const h1 = doc.querySelector('h1');
    if (h1 && h1.textContent && h1.textContent.trim()) {
      return h1.textContent.trim();
    }

    // Fallback to URL hostname
    if (fallbackUrl) {
      try {
        return new URL(fallbackUrl).hostname;
      } catch {
        return 'Untitled Document';
      }
    }

    return 'Untitled Document';
  } catch (error) {
    console.error('[DOMUtils] Failed to get document title:', error);
    return 'Untitled Document';
  }
}

/**
 * Check if HTML content is valid and non-empty
 * @param html - HTML string to validate
 * @returns true if HTML is valid and contains meaningful content
 */
export function isValidHTML(html: string): boolean {
  try {
    if (!html || typeof html !== 'string' || html.trim().length === 0) {
      return false;
    }

    const doc = safeParseHTML(html);
    if (!doc) {
      return false;
    }

    // Check if there's meaningful text content
    const textContent = extractTextContent(html);
    return textContent.length > 10; // Arbitrary minimum length
  } catch (error) {
    console.error('[DOMUtils] Failed to validate HTML:', error);
    return false;
  }
}
