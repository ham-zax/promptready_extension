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
    action: FilterAction.REMOVE,
  },
  
  // Headers and footers
  {
    description: 'Remove page headers',
    selector: 'header, [role="banner"], .header, .page-header, .site-header',
    action: FilterAction.REMOVE,
  },
  {
    description: 'Remove page footers',
    selector: 'footer, [role="contentinfo"], .footer, .page-footer, .site-footer',
    action: FilterAction.REMOVE,
  },
  
  // Sidebars and secondary content
  {
    description: 'Remove sidebars',
    selector: 'aside, [role="complementary"], .sidebar, .side-bar, .secondary',
    action: FilterAction.REMOVE,
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
    action: FilterAction.REMOVE,
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
    action: FilterAction.REMOVE,
  },
  
  // Newsletter signups and CTAs
  {
    description: 'Remove newsletter signup forms',
    selector: '.newsletter, .signup, .subscribe, .email-signup, .cta, .call-to-action',
    action: FilterAction.REMOVE,
  },
  
  // Search and filter forms
  {
    description: 'Remove search forms and filters',
    selector: '.search, .filter, .search-form, .search-box, [role="search"]',
    action: FilterAction.REMOVE,
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
    action: FilterAction.REMOVE,
  },
  
  // Skip links and accessibility helpers
  {
    description: 'Remove skip navigation links',
    selector: '.skip-link, .skip-nav, .screen-reader-text, .sr-only, .visually-hidden',
    action: FilterAction.REMOVE,
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
    action: FilterAction.REMOVE,
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

/**
 * Apply filter rules to a DOM element
 */
export class BoilerplateFilter {
  
  static applyRules(element: HTMLElement, mode: 'offline' | 'ai' = 'offline'): void {
    // Always use the same rules - no mode-specific filtering needed
    const rules = BOILERPLATE_FILTER_RULES;
    
    for (const rule of rules) {
      try {
        const elementsToProcess = Array.from(element.querySelectorAll(rule.selector));
        
        for (const el of elementsToProcess) {
          switch (rule.action) {
            case FilterAction.REMOVE:
              el.remove();
              break;
              
            case FilterAction.UNWRAP:
              // Replace the element with its children
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
