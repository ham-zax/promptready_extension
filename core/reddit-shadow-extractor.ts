/**
 * Reddit Shadow DOM Content Extractor
 * 
 * Architectural Strategy: Stability-First with Shadow DOM Traversal
 * Integrates with Graceful Degradation Pipeline as a site-specific Stage 0
 * 
 * This handles Reddit's hostile DOM by:
 * 1. Traversing Shadow DOM boundaries directly (Chrome extension capability)
 * 2. Using stable semantic element names (web components)
 * 3. Aggressive post-processing to remove UI junk
 * 4. Falls back to standard pipeline if specialized extraction fails
 */

interface RedditExtractionResult {
  content: string;
  metadata: {
    strategy: string;
    shadowDomDepth: number;
    noiseFiltered: boolean;
    qualityScore: number;
  };
}

export class RedditShadowExtractor {
  
  /**
   * Main entry point for Reddit content extraction
   * Returns null if Reddit-specific extraction should not be used
   */
  static extractContent(document: Document): RedditExtractionResult | null {
    // Only apply to Reddit URLs
    if (!this.isRedditPage(document)) {
      return null;
    }

    console.log('[RedditExtractor] ✅ Detected Reddit page, using specialized extraction');
    console.log('[RedditExtractor] URL:', document.location?.href || 'unknown');

    const strategies = [
      this.strategyShadowDOMTraversal,
      this.strategySemanticElements,
    ];

    for (const strategy of strategies) {
      try {
        const result = strategy.call(this, document);
        if (result && this.validateQuality(result)) {
          console.log(`[RedditExtractor] ✅ Strategy '${result.metadata.strategy}' succeeded with score ${result.metadata.qualityScore}`);
          console.log(`[RedditExtractor] Content length: ${result.content.length} characters`);
          console.log(`[RedditExtractor] Shadow depth: ${result.metadata.shadowDomDepth}`);
          return result;
        } else if (result) {
          console.log(`[RedditExtractor] ⚠️  Strategy '${result.metadata.strategy}' failed quality check: score ${result.metadata.qualityScore}, length ${result.content.length}`);
        }
      } catch (error) {
        console.error(`[RedditExtractor] ❌ Strategy failed with error:`, error);
      }
    }

    // Return null to let standard pipeline handle it
    console.log('[RedditExtractor] ❌ All strategies failed, falling back to standard pipeline');
    return null;
  }

  /**
   * Check if this is a Reddit page
   */
  private static isRedditPage(document: Document): boolean {
    const url = document.location?.href || '';
    return url.includes('reddit.com') || url.includes('redd.it');
  }

  /**
   * PRIMARY STRATEGY: Shadow DOM Traversal
   * 
   * Chrome extensions can pierce Shadow DOM using .shadowRoot
   * This is your architectural advantage over generic scrapers
   */
  private static strategyShadowDOMTraversal(document: Document): RedditExtractionResult | null {
    console.log('[RedditExtractor] 🔍 Trying Shadow DOM traversal strategy');
    const content: string[] = [];
    let shadowDepth = 0;

    // Target stable web component names
    const postElements = document.querySelectorAll('shreddit-post');
    console.log(`[RedditExtractor] Found ${postElements.length} shreddit-post elements`);
    
    if (postElements.length === 0) {
      console.log('[RedditExtractor] ❌ No shreddit-post elements found');
      return null; // No Reddit posts found
    }

    postElements.forEach((post, index) => {
      // Traverse into shadow DOM
      const extracted = this.traverseShadowDOM(post, 0);
      if (extracted.text) {
        console.log(`[RedditExtractor] ✅ Extracted ${extracted.text.length} chars from post ${index + 1}, depth: ${extracted.depth}`);
        content.push(extracted.text);
        shadowDepth = Math.max(shadowDepth, extracted.depth);
      } else {
        console.log(`[RedditExtractor] ⚠️  Post ${index + 1} had no extractable text`);
      }
    });

    // Extract comment tree if present
    const commentTree = document.querySelector('shreddit-comment-tree');
    if (commentTree) {
      console.log('[RedditExtractor] 💬 Found shreddit-comment-tree, extracting comments');
      const comments = this.traverseShadowDOM(commentTree, 0);
      if (comments.text) {
        console.log(`[RedditExtractor] ✅ Extracted ${comments.text.length} chars from comments`);
        content.push('\n\n## Comments\n\n');
        content.push(comments.text);
      }
    } else {
      console.log('[RedditExtractor] ℹ️  No shreddit-comment-tree found (post-only page)');
    }

    if (content.length === 0) {
      console.log('[RedditExtractor] ❌ No content extracted from shadow DOM');
      return null;
    }

    const rawContent = content.join('\n\n');
    console.log(`[RedditExtractor] 📊 Raw content: ${rawContent.length} characters`);
    const cleaned = this.aggressiveNoiseFilter(rawContent);
    console.log(`[RedditExtractor] 🧹 Cleaned content: ${cleaned.length} characters (${Math.round((1 - cleaned.length/rawContent.length) * 100)}% reduction)`);

    const qualityScore = this.calculateQualityScore(cleaned, rawContent);
    console.log(`[RedditExtractor] 📈 Quality score: ${qualityScore}/100`);

    return {
      content: cleaned,
      metadata: {
        strategy: 'shadow-dom-traversal',
        shadowDomDepth: shadowDepth,
        noiseFiltered: true,
        qualityScore,
      }
    };
  }

  /**
   * Recursive Shadow DOM Traversal
   * 
   * This is the killer feature Chrome extensions have that generic scrapers don't
   */
  private static traverseShadowDOM(
    element: Element, 
    depth: number, 
    maxDepth: number = 5
  ): { text: string; depth: number } {
    if (depth > maxDepth) return { text: '', depth };

    let text = '';
    let maxChildDepth = depth;

    // Check if element has shadow root
    const shadowRoot = (element as any).shadowRoot;
    
    if (shadowRoot) {
      // Traverse shadow DOM
      const walker = document.createTreeWalker(
        shadowRoot,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            // Filter out noise elements
            if (node.nodeType === Node.ELEMENT_NODE) {
              const el = node as Element;
              const tagName = el.tagName.toLowerCase();
              
              // Skip UI noise
              if (this.isNoiseElement(tagName, el)) {
                return NodeFilter.FILTER_REJECT;
              }
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      let node;
      while (node = walker.nextNode()) {
        if (node.nodeType === Node.TEXT_NODE) {
          const textContent = node.textContent?.trim();
          if (textContent && textContent.length > 3) {
            text += textContent + ' ';
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as Element;
          
          // Recursively traverse nested shadow DOMs
          if ((el as any).shadowRoot) {
            const nested = this.traverseShadowDOM(el, depth + 1, maxDepth);
            text += nested.text + '\n';
            maxChildDepth = Math.max(maxChildDepth, nested.depth);
          }
          
          // Extract semantic meaning from slots
          if (el.hasAttribute('slot')) {
            const slotName = el.getAttribute('slot');
            if (slotName === 'text-body' || slotName === 'title') {
              text += el.textContent?.trim() + '\n\n';
            }
          }
        }
      }
    } else {
      // No shadow DOM, use standard extraction
      text = this.extractFromElement(element);
    }

    return { 
      text: text.trim(), 
      depth: maxChildDepth 
    };
  }

  /**
   * SECONDARY STRATEGY: Semantic Elements
   * 
   * Fallback if shadow DOM traversal fails
   * Targets Reddit's actual DOM structure based on new Reddit design
   */
  private static strategySemanticElements(document: Document): RedditExtractionResult | null {
    console.log('[RedditExtractor] 🔍 Trying semantic elements strategy');
    const content: string[] = [];

    // Extract subreddit and post metadata
    const subreddit = this.extractSubreddit(document);
    const postAuthor = this.extractPostAuthor(document);
    const postScore = this.extractPostScore(document);
    const postTime = this.extractPostTime(document);

    console.log('[RedditExtractor] 📋 Post metadata:', { subreddit, postAuthor, postScore, postTime });

    // Strategy 1: Extract post title
    const titleElement = document.querySelector('shreddit-title h1');
    let postTitle = '';
    if (titleElement) {
      postTitle = titleElement.textContent?.trim() || '';
      if (postTitle) {
        content.push(`# ${postTitle}\n`);
        console.log('[RedditExtractor] ✅ Found title:', postTitle.substring(0, 50) + '...');
      }
    } else {
      console.log('[RedditExtractor] ⚠️  No title element found');
    }

    // Add post metadata with OP identification
    const metadata: string[] = [];
    if (subreddit) metadata.push(`**r/${subreddit}**`);
    if (postAuthor) metadata.push(`Posted by **u/${postAuthor}** (OP)`);
    if (postTime) metadata.push(postTime);
    if (postScore) metadata.push(`⬆️ ${postScore}`);
    
    if (metadata.length > 0) {
      content.push(`*${metadata.join(' • ')}*\n`);
    }

    // Strategy 2: Extract post body
    const postBodyDiv = document.querySelector('shreddit-post-text-body div[id*="-post-rtjson-content"]');
    if (postBodyDiv) {
      console.log('[RedditExtractor] ✅ Found post body div');
      const bodyText = this.extractFromElement(postBodyDiv);
      if (bodyText && bodyText.length > 20) {
        content.push(`\n${bodyText}\n`);
        console.log(`[RedditExtractor] Post body: ${bodyText.length} chars`);
      }
    } else {
      // Fallback: try the slot="text-body" element directly
      console.log('[RedditExtractor] ⚠️  No post-rtjson-content div, trying text-body slot');
      const textBodySlot = document.querySelector('shreddit-post-text-body [slot="text-body"]');
      if (textBodySlot) {
        const bodyText = this.extractFromElement(textBodySlot);
        if (bodyText && bodyText.length > 20) {
          content.push(`\n${bodyText}\n`);
          console.log(`[RedditExtractor] Post body (from slot): ${bodyText.length} chars`);
        }
      }
    }

    // Strategy 3: Extract comments with full metadata
    const commentElements = document.querySelectorAll('shreddit-comment');
    if (commentElements.length > 0) {
      console.log(`[RedditExtractor] 💬 Found ${commentElements.length} comment elements`);
      const comments: string[] = [];
      
      commentElements.forEach((commentContainer, index) => {
        const commentSlot = commentContainer.querySelector('[slot="comment"]');
        if (!commentSlot) return;
        
        const commentText = this.extractFromElement(commentSlot);
        if (!commentText || commentText.length < 10) return;
        
        // Extract comment metadata
        const author = this.extractCommentAuthor(commentContainer);
        const score = this.extractCommentScore(commentContainer);
        const time = this.extractCommentTime(commentContainer);
        const depth = parseInt(commentContainer.getAttribute('depth') || '0');
        
        // Check if this comment is by the OP
        const isOP = postAuthor && author === postAuthor;
        
        console.log(`[RedditExtractor] Comment ${index + 1} metadata:`, { author, score, time, depth, isOP });
        
        // Build comment with proper indentation
        const indent = '  '.repeat(depth);
        const authorDisplay = isOP ? `**u/${author}** (OP)` : `**u/${author}**`;
        const metaParts = [authorDisplay];
        if (time) metaParts.push(time);
        if (score) metaParts.push(`⬆️ ${score}`);
        
        const commentHeader = `${indent}${metaParts.join(' • ')}`;
        const commentBody = commentText
          .split('\n')
          .map(line => `${indent}${line}`)
          .join('\n');
        
        comments.push(`${commentHeader}\n${commentBody}\n`);
        console.log(`[RedditExtractor] Comment ${index + 1} by ${author} (depth ${depth}): ${commentText.substring(0, 50)}...`);
      });

      if (comments.length > 0) {
        content.push(`\n---\n\n## ${comments.length} Comment${comments.length > 1 ? 's' : ''}\n\n${comments.join('\n')}`);
        console.log(`[RedditExtractor] ✅ Extracted ${comments.length} comments`);
      }
    } else {
      console.log('[RedditExtractor] ⚠️  No comment elements found');
    }

    // Strategy 4: If we still have very little content, try the full post element
    if (content.join('').length < 100) {
      console.log('[RedditExtractor] ⚠️  Content too short, trying full shreddit-post extraction');
      const postElement = document.querySelector('shreddit-post');
      if (postElement) {
        const postText = this.extractFromElement(postElement);
        if (postText && postText.length > 50) {
          console.log(`[RedditExtractor] Full post extraction: ${postText.length} chars`);
          content.push(postText);
        }
      }
    }

    if (content.length === 0) {
      console.log('[RedditExtractor] ❌ No content extracted from semantic elements');
      return null;
    }

    const rawContent = content.join('\n');
    console.log(`[RedditExtractor] 📊 Total raw content: ${rawContent.length} characters`);
    const cleaned = this.aggressiveNoiseFilter(rawContent);
    console.log(`[RedditExtractor] 🧹 After cleaning: ${cleaned.length} characters`);

    const qualityScore = this.calculateQualityScore(cleaned, rawContent);
    console.log(`[RedditExtractor] 📈 Quality score: ${qualityScore}/100`);

    return {
      content: cleaned,
      metadata: {
        strategy: 'semantic-elements',
        shadowDomDepth: 0,
        noiseFiltered: true,
        qualityScore,
      }
    };
  }

  /**
   * Extract subreddit name
   */
  private static extractSubreddit(document: Document): string | null {
    // Try multiple selectors for subreddit
    const selectors = [
      'a[href^="/r/"]',
      'faceplate-hovercard a[href^="/r/"]',
      'shreddit-subreddit-header'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const href = element.getAttribute('href');
        const match = href?.match(/\/r\/([^\/]+)/);
        if (match) return match[1];
        
        const text = element.textContent?.trim();
        if (text?.startsWith('r/')) return text.substring(2);
      }
    }
    
    return null;
  }

  /**
   * Extract post author
   */
  private static extractPostAuthor(document: Document): string | null {
    // Try multiple selectors for post author
    const selectors = [
      'shreddit-post [slot="authorName"] a',
      'shreddit-post a[href^="/user/"]',
      'shreddit-post a[href^="/u/"]',
      'div[slot="credit-bar"] a[href*="/user/"]'
    ];
    
    for (const selector of selectors) {
      const authorElement = document.querySelector(selector);
      if (authorElement) {
        const text = authorElement.textContent?.trim();
        if (text) {
          // Remove u/ prefix if present
          return text.startsWith('u/') ? text.substring(2) : text;
        }
      }
    }
    
    return null;
  }

  /**
   * Extract post score/points
   */
  private static extractPostScore(document: Document): string | null {
    // Try multiple selectors for score
    const selectors = [
      'shreddit-post shreddit-score',
      'shreddit-post [slot="score"]',
      'shreddit-post [id*="vote-count"]'
    ];
    
    for (const selector of selectors) {
      const scoreElement = document.querySelector(selector);
      if (scoreElement) {
        const text = scoreElement.textContent?.trim();
        if (text) {
          // Remove "Vote" text and clean up
          const cleaned = text.replace(/vote/gi, '').trim();
          // Check if it's a valid number or has k/m suffix
          if (cleaned && (cleaned.match(/^\d+/) || cleaned.includes('k') || cleaned.includes('m'))) {
            return cleaned;
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Extract post time
   */
  private static extractPostTime(document: Document): string | null {
    const timeElement = document.querySelector('shreddit-post faceplate-timeago, shreddit-post time');
    return timeElement?.textContent?.trim() || null;
  }

  /**
   * Extract comment author
   */
  private static extractCommentAuthor(commentContainer: Element): string {
    // Try multiple selectors
    const selectors = [
      '[slot="commentMeta"] a[href^="/user/"]',
      '[slot="commentMeta"] a[href^="/u/"]',
      'a[href^="/user/"]',
      'a[href^="/u/"]'
    ];
    
    for (const selector of selectors) {
      const authorElement = commentContainer.querySelector(selector);
      if (authorElement) {
        const text = authorElement.textContent?.trim() || '';
        if (text && text.length > 0) {
          return text.startsWith('u/') ? text.substring(2) : text;
        }
      }
    }
    
    return 'Unknown';
  }

  /**
   * Extract comment score
   */
  private static extractCommentScore(commentContainer: Element): string | null {
    const selectors = [
      'shreddit-comment-action-row [slot="score"]',
      'shreddit-comment-action-row shreddit-score',
      '[slot="actionRow"] shreddit-score'
    ];
    
    for (const selector of selectors) {
      const scoreElement = commentContainer.querySelector(selector);
      if (scoreElement) {
        const text = scoreElement.textContent?.trim();
        if (text) {
          const cleaned = text.replace(/vote/gi, '').trim();
          if (cleaned && cleaned.match(/^\d+/)) {
            return cleaned;
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Extract comment time
   */
  private static extractCommentTime(commentContainer: Element): string | null {
    const selectors = [
      '[slot="commentMeta"] faceplate-timeago',
      '[slot="commentMeta"] time',
      'faceplate-timeago',
      'time'
    ];
    
    for (const selector of selectors) {
      const timeElement = commentContainer.querySelector(selector);
      if (timeElement) {
        const text = timeElement.textContent?.trim();
        if (text) return text;
      }
    }
    
    return null;
  }

  /**
   * Aggressive Noise Filter
   * 
   * Stage 2: Remove UI junk that leaked through broad selectors
   */
  private static aggressiveNoiseFilter(content: string): string {
    let cleaned = content;

    // Remove common UI patterns (but preserve actual content)
    const noisePatterns = [
      /\b\d+\s*upvotes?\b/gi,
      /\b\d+\s*downvotes?\b/gi,
      /\b\d+\s*comments?\b/gi,
      /\bshare\s*$/gmi,  // Share at end of line
      /\breport\s*$/gmi,
      /\bsave\s*$/gmi,
      /\b\d+\s*points?\b/gi,
      /\b\d+\s*karma\b/gi,
      /posted by u\/\w+/gi,
      /\b\d+\s*hours?\s*ago\b/gi,
      /\b\d+\s*days?\s*ago\b/gi,
      /\b\d+\s*months?\s*ago\b/gi,
      /\b\d+\s*years?\s*ago\b/gi,
      /\bawards?\s*$/gmi,
      /\breply\s*$/gmi,
      /\bpermalink\s*$/gmi,
      /\bedit\s*$/gmi,
      /\bdelete\s*$/gmi,
      /\bgive\s+award\b/gi,
      /\bhide\s*$/gmi,
      /\bcollapse\s*$/gmi,
      /\bsort by:?\s*\w+/gi,
      /\bvote\s*$/gmi,
    ];

    noisePatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });

    // Remove excessive whitespace while preserving paragraph breaks
    const lines = cleaned.split('\n');
    const processedLines: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      // Keep lines that have actual content (more than just a few chars)
      if (trimmed.length > 5 || trimmed.match(/^#+\s/)) {  // Keep markdown headers even if short
        processedLines.push(trimmed);
      }
    }

    cleaned = processedLines.join('\n\n');

    // Remove duplicate consecutive lines (but allow intentional repetition with different context)
    const deduped: string[] = [];
    let lastLine = '';
    
    for (const line of cleaned.split('\n')) {
      const trimmed = line.trim();
      if (trimmed !== lastLine || trimmed.length > 50) {  // Allow long lines to repeat
        deduped.push(line);
        lastLine = trimmed;
      }
    }
    
    cleaned = deduped.join('\n');

    return cleaned.trim();
  }

  /**
   * Element Type Noise Detection
   */
  private static isNoiseElement(tagName: string, element: Element): boolean {
    // Skip obvious UI elements
    const noiseTags = ['button', 'nav', 'header', 'footer', 'aside', 'form', 'input', 'svg'];
    if (noiseTags.includes(tagName)) return true;

    // Skip elements with specific noise-indicating attributes (but NOT data-testid - Reddit uses it for content!)
    const noiseAttributes = ['data-click', 'data-adunit'];
    for (const attr of noiseAttributes) {
      if (element.hasAttribute(attr)) return true;
    }

    // Skip elements that are explicitly hidden
    if (element.hasAttribute('hidden') || element.hasAttribute('aria-hidden')) {
      return true;
    }
    
    // Check computed style for display: none (but only if in browser context)
    try {
      const style = (element as HTMLElement).style;
      if (style && style.display === 'none') {
        return true;
      }
    } catch (e) {
      // Ignore style check errors
    }

    // Skip elements with single-word text that are likely buttons
    // BUT: only if the element itself is a button-like element
    if (['a', 'button', 'span'].includes(tagName)) {
      const text = element.textContent?.trim() || '';
      if (text.length > 0 && text.length < 20 && !text.includes(' ')) {
        // Check if it's a common Reddit UI button text
        const buttonTexts = ['share', 'save', 'hide', 'report', 'reply', 'edit', 'delete', 'award'];
        if (buttonTexts.includes(text.toLowerCase())) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Extract text from regular DOM element
   */
  private static extractFromElement(element: Element): string {
    console.log(`[RedditExtractor] 🔍 extractFromElement called on:`, element.tagName);
    console.log(`[RedditExtractor] Element text length:`, element.textContent?.length || 0);
    
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (parent && this.isNoiseElement(parent.tagName.toLowerCase(), parent)) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let text = '';
    let node;
    let nodesProcessed = 0;
    let nodesRejected = 0;
    
    while (node = walker.nextNode()) {
      nodesProcessed++;
      const content = node.textContent?.trim();
      if (content && content.length > 3) {
        text += content + ' ';
      } else if (content) {
        nodesRejected++;
      }
    }
    
    console.log(`[RedditExtractor] Processed ${nodesProcessed} text nodes, rejected ${nodesRejected} short ones`);
    console.log(`[RedditExtractor] Extracted text length: ${text.length}`);

    return text.trim();
  }

  /**
   * Quality Score Calculator
   */
  private static calculateQualityScore(cleaned: string, raw: string): number {
    // Score based on noise reduction ratio
    const noiseReductionRatio = 1 - (cleaned.length / raw.length);
    
    // Score based on content density
    const wordCount = cleaned.split(/\s+/).length;
    const avgWordLength = cleaned.length / (wordCount || 1);
    
    // Higher score if we removed lots of noise but kept substantial content
    let score = 100;
    
    if (noiseReductionRatio > 0.8) score -= 20; // Too aggressive
    if (noiseReductionRatio < 0.3) score -= 20; // Not enough filtering
    if (wordCount < 50) score -= 30; // Too little content
    if (avgWordLength < 4) score -= 10; // Fragmented text
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Quality Validation
   */
  private static validateQuality(result: RedditExtractionResult): boolean {
    return result.metadata.qualityScore >= 60 && 
           result.content.length >= 100;
  }
}
