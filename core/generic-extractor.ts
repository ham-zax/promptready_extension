import { extractTextContent } from '../lib/dom-utils.js';

export interface BodyCandidate {
  strategy: string;
  content: string;
  charCount: number;
  paragraphCount: number;
  codeCharCount: number;
  linkDensity: number;
  confidence: number;
  warnings: string[];
  element?: HTMLElement;
}

export class GenericExtractor {
  private static readonly GENERIC_SELECTORS = [
    'article',
    'main',
    '[role="main"]',
    '[role="article"]',
    '[itemprop="articleBody"]',
    '.post-body',
    '.article-body',
    '.content-body',
    '.entry-content',
    '#content',
    '#main',
    '.main',
    '.post',
    '.article',
    '.content'
  ];

  private static readonly NOISE_SELECTORS = [
    'nav',
    'header',
    'footer',
    'aside',
    'dialog',
    'menu',
    '.cookie',
    '.sidebar',
    '.related',
    '.ad',
    '.promo',
    '.newsletter',
    '.social',
    '.comments',
    '#comments'
  ];

  public static extractCandidates(doc: Document): BodyCandidate[] {
    const candidates: BodyCandidate[] = [];
    const seenElements = new Set<HTMLElement>();

    for (const selector of this.GENERIC_SELECTORS) {
      const elements = Array.from(doc.querySelectorAll(selector)) as HTMLElement[];
      for (const el of elements) {
        // Skip if this element is already a candidate or is a child of one
        let current: HTMLElement | null = el;
        let alreadyCaptured = false;
        while (current) {
          if (seenElements.has(current)) {
            alreadyCaptured = true;
            break;
          }
          current = current.parentElement;
        }
        if (alreadyCaptured) continue;
        
        const candidate = this.analyzeElement(el, `generic:${selector}`);
        if (candidate) {
          candidates.push(candidate);
          seenElements.add(el);
        }
      }
    }

    return candidates;
  }

  public static analyzeElement(el: HTMLElement, strategy: string): BodyCandidate | null {
    if (!el || !el.isConnected) return null;

    // Clone to avoid modifying original during analysis
    const clone = el.cloneNode(true) as HTMLElement;
    
    // Exclude noise from analysis
    for (const selector of this.NOISE_SELECTORS) {
      const noise = clone.querySelectorAll(selector);
      noise.forEach(n => n.remove());
    }

    const textContent = extractTextContent(clone.innerHTML);
    const charCount = textContent.length;
    if (charCount < 50) return null;

    const paragraphs = Array.from(clone.querySelectorAll('p, div')).filter(p => {
      const pText = extractTextContent(p.innerHTML).trim();
      return pText.length > 20;
    });
    const paragraphCount = paragraphs.length;

    const codeBlocks = Array.from(clone.querySelectorAll('pre, code'));
    const codeCharCount = codeBlocks.reduce((acc, cb) => acc + extractTextContent(cb.innerHTML).length, 0);

    const links = Array.from(clone.querySelectorAll('a'));
    const linkTextLength = links.reduce((acc, a) => acc + extractTextContent(a.innerHTML).length, 0);
    const linkDensity = charCount > 0 ? linkTextLength / charCount : 0;

    const warnings: string[] = [];
    if (linkDensity > 0.5) warnings.push('High link density');
    if (paragraphCount < 2 && charCount < 200) warnings.push('Low paragraph count');

    // Simple confidence score (Deterministic scoring as per TASK #12)
    let confidence = 0.5;
    if (charCount > 500) confidence += 0.1;
    if (charCount > 2000) confidence += 0.1;
    if (paragraphCount > 3) confidence += 0.1;
    if (paragraphCount > 10) confidence += 0.1;
    if (codeCharCount > 100) confidence += 0.1;
    if (linkDensity < 0.2) confidence += 0.1;
    if (linkDensity > 0.6) confidence -= 0.2;
    if (strategy.includes('article') || strategy.includes('main')) confidence += 0.2;

    return {
      strategy,
      content: clone.innerHTML,
      charCount,
      paragraphCount,
      codeCharCount,
      linkDensity,
      confidence: Math.max(0, Math.min(1, confidence)),
      warnings,
      element: el
    };
  }
}
