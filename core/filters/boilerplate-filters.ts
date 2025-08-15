// Boilerplate filtering rules engine
// Based on Architecture Section 7 (Core Modules) and common web patterns

import { FilterRule, FilterAction } from '../../lib/types.js';

/**
 * Rules for removing common boilerplate content
 * These rules are applied before Readability processing
 */
export const BOILERPLATE_FILTER_RULES: FilterRule[] = [
  // Navigation elements
  {
    description: 'Remove navigation bars and menus',
    selector: 'nav, [role="navigation"], .navigation, .nav, .navbar, .menu, .main-menu',
    // Make conservative: unwrap navigation containers rather than removing inner content
    action: FilterAction.UNWRAP,
  },
  
  // Headers and footers
  {
    description: 'Remove page headers',
    selector: 'header, [role="banner"], .header, .page-header, .site-header',
    action: FilterAction.UNWRAP,
  },
  {
    description: 'Remove page footers',
    selector: 'footer, [role="contentinfo"], .footer, .page-footer, .site-footer',
    action: FilterAction.UNWRAP,
  },
  
  // Sidebars and secondary content
  {
    description: 'Remove sidebars',
    selector: 'aside, [role="complementary"], .sidebar, .side-bar, .secondary',
    action: FilterAction.UNWRAP,
  },
  
  // Advertisements
  {
    description: 'Remove advertisement containers',
    selector: '.ad, .ads, .advertisement, .advert, [class*="ad-"], [id*="ad-"], .sponsored, .promo',
    action: FilterAction.REMOVE,
  },
  {
    description: 'Remove Google AdSense containers',
    selector: '.adsbygoogle, ins.adsbygoogle',
    action: FilterAction.REMOVE,
  },
  
  // Social media widgets
  {
    description: 'Remove social media widgets and share buttons',
    selector: '.social, .share, .sharing, .social-share, .social-media, .follow-us',
    action: FilterAction.UNWRAP,
  },
  {
    description: 'Remove embedded social media posts',
    selector: '.twitter-tweet, .fb-post, .instagram-embed, iframe[src*="twitter.com"], iframe[src*="facebook.com"]',
    action: FilterAction.REMOVE,
  },
  
  // Cookie banners and privacy notices
  {
    description: 'Remove cookie consent banners',
    selector: '.cookie, .consent, .privacy-notice, [id*="cookie"], [class*="cookie"], .gdpr',
    action: FilterAction.REMOVE,
  },
  
  // Comment sections
  {
    description: 'Remove comment sections',
    selector: '.comments, .comment-section, #comments, .disqus, .livefyre',
    action: FilterAction.REMOVE,
  },
  
  // Related articles and suggestions
  {
    description: 'Remove related articles sections',
    selector: '.related, .suggestions, .recommended, .more-articles, .you-might-like',
    action: FilterAction.UNWRAP,
  },
  
  // Newsletter signups and CTAs
  {
    description: 'Remove newsletter signup forms',
    selector: '.newsletter, .signup, .subscribe, .email-signup, .cta, .call-to-action',
    action: FilterAction.UNWRAP,
  },
  
  // Search and filter forms
  {
    description: 'Remove search forms and filters',
    selector: '.search, .filter, .search-form, .search-box, [role="search"]',
    action: FilterAction.UNWRAP,
  },
  
  // Popup and modal triggers
  {
    description: 'Remove popup and modal content',
    selector: '.popup, .modal, .overlay, .lightbox, [aria-hidden="true"]',
    action: FilterAction.REMOVE,
  },
  
  // Breadcrumbs (usually not needed in clean content)
  {
    description: 'Remove breadcrumb navigation',
    selector: '.breadcrumb, .breadcrumbs, [aria-label="breadcrumb"]',
    action: FilterAction.UNWRAP,
  },
  
  // Skip links and accessibility helpers
  {
    description: 'Remove skip navigation links',
    selector: '.skip-link, .skip-nav, .screen-reader-text, .sr-only, .visually-hidden',
    action: FilterAction.UNWRAP,
  },
  
  // Site-specific patterns
  {
    description: 'Remove Medium specific clutter',
    selector: '.u-marginTop30, .js-postMetaLockup, .u-paddingBottom10',
    action: FilterAction.REMOVE,
  },
  {
    description: 'Remove GitHub specific UI elements',
    selector: '.gh-header, .js-navigation-container, .repository-lang-stats, .Header, .pagehead, .UnderlineNav, .flash, .file-navigation, .Box-header, .js-sticky, .Layout-sidebar, .hx_pagehead, .application-main aside, .gisthead, .BorderGrid, .header-search, .footer, .height-full [data-testid="stale-indicator"], .js-pinned-items-reorder-container',
    action: FilterAction.REMOVE,
  },
  {
    description: 'Promote GitHub README content',
    selector: '#readme .markdown-body',
    action: FilterAction.UNWRAP,
  },
  {
    description: 'Remove Reddit UI, sidebars, promotions, and comments',
    selector: 'shreddit-comments-page > aside, shreddit-ad, [data-testid="post-sidebar"], faceplate-tracker, [slot="sidebar"], faceplate-iframe, shreddit-comment-tree, shreddit-comment, [data-adclicklocation], [promoted], [data-testid="content-gate"], [data-testid="left-sidebar"]',
    action: FilterAction.REMOVE,
  },
  {
    description: 'Keep only Reddit main post content wrapper by unwrapping inner content',
    selector: '[data-test-id="post-content"], shreddit-post, [data-testid="post-container"]',
    action: FilterAction.UNWRAP,
  },
  {
    description: 'Remove Wikipedia navigation and info boxes',
    selector: '.navbox, .infobox, .metadata, .navigation-not-searchable',
    action: FilterAction.UNWRAP,
  },
  
  // Code & Docs mode specific preservation rules
  // These will be handled separately in the cleaner logic
];

/**
 * Additional rules for Code & Docs mode
 * These rules are more conservative to preserve technical content
 */
export const CODE_DOCS_FILTER_RULES: FilterRule[] = [
  // Only remove the most obvious non-content elements in code/docs mode
  {
    description: 'Remove obvious advertisements in code docs',
    selector: '.ad, .ads, .advertisement, .adsbygoogle',
    action: FilterAction.REMOVE,
  },
  {
    description: 'Remove cookie banners in code docs',
    selector: '.cookie, .consent, .privacy-notice, .gdpr',
    action: FilterAction.REMOVE,
  },
  {
    description: 'Remove social media widgets in code docs',
    selector: '.social-share, .twitter-tweet, .fb-post',
    action: FilterAction.REMOVE,
  },
];

export const AGGRESSIVE_FILTER_RULES: FilterRule[] = [
  {
    description: 'Aggressively remove common site navigation bars.',
    selector: 'nav, [role="navigation"], .navigation, .nav, .navbar, .menu, .main-menu',
    action: FilterAction.REMOVE,
  },
  {
    description: 'Aggressively remove common site footers.',
    selector: 'footer, [role="contentinfo"], .footer, .page-footer, .site-footer',
    action: FilterAction.REMOVE,
  },
  {
    description: 'Aggressively remove social widgets and sidebars.',
    selector: '.social, .share, .sharing, .sidebar, .side-bar, .secondary, .follow-us',
    action: FilterAction.REMOVE,
  },
];

/**
 * Apply filter rules to a DOM element
 */
export class BoilerplateFilter {
  
  static applyRules(element: HTMLElement, rulesParam?: FilterRule[], mode: 'offline' | 'ai' = 'offline'): void {
    // Use provided rules if given; otherwise default to BOILERPLATE_FILTER_RULES
    const rules = (rulesParam && rulesParam.length) ? rulesParam : BOILERPLATE_FILTER_RULES;
    // Diagnostics collections to help identify which rules remove/unwrap important content
    const removedList: Element[] = [];
    const unwrappedList: Element[] = [];
    
    for (const rule of rules) {
      try {
        const elementsToProcess = Array.from(element.querySelectorAll(rule.selector));
        
        for (const el of elementsToProcess) {
          // Preserve elements that look like technical content sections
          if (this.shouldPreserveElement(el as HTMLElement)) {
            // Skip removal/unwrapping for these elements
            // (We log for diagnostics; in production this can be toned down)
            console.log(`[BoilerplateFilter] Preserving element for selector "${rule.selector}" due to heading match.`);
            continue;
          }
 
          switch (rule.action) {
            case FilterAction.REMOVE:
              // Conservative behavior: for broad structural selectors, prefer unwrapping to avoid losing nested valuable content.
              if (this.isBroadSelector(rule.selector)) {
                if (el.parentNode) {
                  while (el.firstChild) {
                    el.parentNode.insertBefore(el.firstChild, el);
                  }
                  // record unwrapped element for diagnostics before removal
                  unwrappedList.push(el);
                  el.remove();
                }
              } else {
                // record removed element for diagnostics
                removedList.push(el);
                 el.remove();
              }
               break;
              
            case FilterAction.UNWRAP:
              // Replace the element with its children
              unwrappedList.push(el);
              if (el.parentNode) {
                while (el.firstChild) {
                  el.parentNode.insertBefore(el.firstChild, el);
                }
                el.remove();
              }
              break;
          }
        }
      } catch (error) {
        console.warn(`Failed to apply filter rule "${rule.description}":`, error);
        // Continue with other rules even if one fails
      }
    }
    // After applying all rules, log a concise diagnostic summary
    try {
      const sampleRemoved = removedList.slice(0, 10).map(e => ({
        tag: e.tagName,
        id: e.id,
        class: e.className,
        text: (e.textContent || '').trim().slice(0, 120),
      }));
      const sampleUnwrapped = unwrappedList.slice(0, 10).map(e => ({
        tag: e.tagName,
        id: e.id,
        class: e.className,
        text: (e.textContent || '').trim().slice(0, 120),
      }));
      console.log(`[BoilerplateFilter] Applied ${rules.length} rules. Removed: ${removedList.length}, Unwrapped: ${unwrappedList.length}. Sample removed:`, sampleRemoved, 'Sample unwrapped:', sampleUnwrapped);
    } catch (e) {
      console.log('[BoilerplateFilter] Diagnostic logging failed:', e);
    }
  }
  
  /**
   * Add custom filter rule at runtime
   */
  static addCustomRule(rule: FilterRule, mode: 'general' | 'code_docs' = 'general'): void {
    const targetRules = mode === 'code_docs' ? CODE_DOCS_FILTER_RULES : BOILERPLATE_FILTER_RULES;
    targetRules.push(rule);
  }
  
  /**
   * Remove elements that are commonly hidden or invisible
   */
  static removeHiddenElements(element: HTMLElement): void {
    const hiddenElements = Array.from(element.querySelectorAll('[style*="display: none"], [style*="display:none"], [hidden], [aria-hidden="true"]'));
    
    for (const el of hiddenElements) {
      // Don't remove if it's a code block or pre element (might be intentionally hidden for formatting)
      if (!el.closest('pre, code, .highlight')) {
        el.remove();
      }
    }
  }
  
  /**
   * Heuristic: decide whether an element contains headings that indicate technical/spec content
   */
  static shouldPreserveElement(el: HTMLElement): boolean {
    try {
      // 1) explicit selectors / data-attrs whitelist
      const TECHNICAL_WHITELIST_SELECTORS = [
        '.technical-spec',
        '.product-spec',
        '[data-spec]',
        '[data-specs]',
        '[data-product-spec]',
        '.panel-title',
        '.accordion-header',
        '.spec-table',
        '.datasheet',
        '.product-details',
      ];

      // If element itself or any descendant/ancestor matches a whitelist selector, preserve it.
      for (const sel of TECHNICAL_WHITELIST_SELECTORS) {
        try {
          if (el.matches && el.matches(sel)) {
            console.warn('[BMAD_PRESERVE] Whitelist selector matched on element — preserving.', sel, el);
            return true;
          }
          if (el.querySelector && el.querySelector(sel)) {
            console.warn('[BMAD_PRESERVE] Whitelist selector matched within element — preserving.', sel, el);
            return true;
          }
          if (el.closest && el.closest(sel)) {
            console.warn('[BMAD_PRESERVE] Whitelist selector matched on ancestor — preserving.', sel, el);
            return true;
          }
        } catch {
          // Silently ignore invalid selector matches
        }
      }

      // 2) explicit data-* attribute checks commonly used for specs
      if (el.hasAttribute && (el.hasAttribute('data-spec') || el.hasAttribute('data-specs') || el.hasAttribute('data-product-spec'))) {
        console.warn('[BMAD_PRESERVE] data-* attribute found — preserving element.', el);
        return true;
      }

      // 3) internal heading checks (existing behavior)
      const headingSelector = 'h1,h2,h3,h4,h5,h6, [role="heading"], [class*="title"], [class*="heading"]';
      const pattern = /technical|specification|specifications|cad|compatible|compatible products|technical specification|datasheet|more information|overview|error|status|troubleshooting|report/i;

      // The ONLY check: Do any title-like elements INSIDE this element match our pattern?
      const internalHeadings = Array.from(el.querySelectorAll(headingSelector));
      for (const h of internalHeadings) {
        const text = (h.textContent || '').trim();
        if (pattern.test(text)) {
          console.warn('[BMAD_PRESERVE] Match found for text "' + text + '". Preserving container.', el);
          return true;
        }
      }

      // 4) nearby sibling heading heuristic: preserve if a heading immediately precedes this element
      const prev = el.previousElementSibling as HTMLElement | null;
      if (prev && /^H[1-6]$/.test(prev.tagName)) {
        const prevText = (prev.textContent || '').trim();
        if (pattern.test(prevText)) {
          console.warn('[BMAD_PRESERVE] Preserving because previous sibling heading matches pattern.', el);
          return true;
        }
      }

      // 5) ancestor heading heuristic: preserve if an ancestor heading matches the pattern
      let ancestor: HTMLElement | null = el.parentElement;
      while (ancestor) {
        if (/^H[1-6]$/.test(ancestor.tagName)) {
          const ancText = (ancestor.textContent || '').trim();
          if (pattern.test(ancText)) {
            console.warn('[BMAD_PRESERVE] Preserving because ancestor heading matches pattern.', el);
            return true;
          }
        }
        ancestor = ancestor.parentElement;
      }

      // If no whitelist, data-attr, or heading matches, this element is considered safe to filter.
      return false;

    } catch (e) {
      console.error('[BMAD_PRESERVE] Error during shouldPreserveElement:', e);
      return false; // Fail safe
    }
  }
  
  /**
   * Decide whether to bypass Readability and convert cleaned DOM directly to Markdown.
   * Reuses the existing preservation heuristic so behavior is consistent.
   */
  static shouldBypassReadability(el: HTMLElement): boolean {
    try {
      return this.shouldPreserveElement(el);
    } catch (e) {
      console.error('[BMAD_BYPASS] Error during shouldBypassReadability:', e);
      return false;
    }
  }
  
  /**
   * Heuristic to detect broad structural selectors where unwrapping is safer than full removal.
   */
  static isBroadSelector(selector: string): boolean {
    return /nav|header|footer|aside|sidebar|related|suggestions|recommended|more-articles|you-might-like|newsletter|signup|subscribe|search|filter|breadcrumb|skip-link|main-menu|menu/i.test(selector);
  }
  
  /**
   * Clean up empty elements after filtering
   */
  static cleanupEmptyElements(element: HTMLElement): void {
    // Remove empty paragraphs, divs, and spans
    const emptyElements = Array.from(element.querySelectorAll('p:empty, div:empty, span:empty, section:empty, article:empty'));
    
    for (const el of emptyElements) {
      el.remove();
    }
    
    // Remove elements that only contain whitespace
    const whitespaceOnlyElements = Array.from(element.querySelectorAll('p, div, span, section, article')).filter(el => {
      return el.textContent?.trim() === '' && el.children.length === 0;
    });
    
    for (const el of whitespaceOnlyElements) {
      el.remove();
    }
  }
}
