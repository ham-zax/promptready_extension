export type PageTypeProfile =
  | 'article'
  | 'documentation'
  | 'forum'
  | 'product'
  | 'code-heavy'
  | 'generic';

export interface PageTypeClassification {
  profile: PageTypeProfile;
  confidence: number;
  signals: string[];
}

export class PageTypeProfiler {
  static classify(doc: Document, url?: string): PageTypeClassification {
    const scores = {
      article: 0,
      documentation: 0,
      forum: 0,
      product: 0,
      'code-heavy': 0,
    };
    const signals: string[] = [];
    const normalizedUrl = (url || '').toLowerCase();
    const hostname = this.toHostname(normalizedUrl);

    // URL signals
    if (
      normalizedUrl.includes('/docs') ||
      normalizedUrl.includes('/documentation') ||
      normalizedUrl.includes('/guide') ||
      normalizedUrl.includes('/reference') ||
      normalizedUrl.includes('/api') ||
      hostname.startsWith('docs.') ||
      hostname.startsWith('api.')
    ) {
      scores.documentation += 3;
      signals.push('url:docs');
    }
    if (
      hostname.endsWith('reddit.com') ||
      hostname.endsWith('redd.it') ||
      hostname.endsWith('news.ycombinator.com') ||
      normalizedUrl.includes('/topic/') ||
      normalizedUrl.includes('/thread/') ||
      hostname.includes('forum') ||
      hostname.includes('community') ||
      hostname.includes('discuss')
    ) {
      scores.forum += 3;
      signals.push('url:forum');
    }
    if (
      hostname.startsWith('blog.') ||
      hostname.endsWith('medium.com') ||
      hostname.endsWith('substack.com') ||
      normalizedUrl.includes('/blog/')
    ) {
      scores.article += 2;
      signals.push('url:blog');
    }
    if (
      hostname.endsWith('wikipedia.org') ||
      normalizedUrl.includes('/wiki/')
    ) {
      scores.documentation += 2;
      signals.push('url:wiki');
    }
    if (
      hostname.endsWith('.edu') ||
      normalizedUrl.includes('/abs/') ||
      normalizedUrl.includes('/pdf/')
    ) {
      scores.documentation += 2; // Academic often behaves like technical docs
      signals.push('url:academic');
    }

    // DOM signals
    if (doc.querySelector('article')) {
      scores.article += 2;
      signals.push('dom:article_tag');
    }
    if (
      doc.querySelector('[itemtype*="Article"]') ||
      doc.querySelector('[itemprop="articleBody"]') ||
      doc.querySelector('meta[property="article:published_time"]')
    ) {
      scores.article += 3;
      signals.push('dom:article_metadata');
    }

    const codeBlocks = doc.querySelectorAll('pre, code').length;
    if (codeBlocks >= 3) {
      scores['code-heavy'] += 3;
      scores.documentation += 1;
      signals.push(`dom:codeBlocks>=3`);
    }
    if (codeBlocks >= 10) {
      scores['code-heavy'] += 3; // Increased to fix code-heavy detection
      scores.documentation += 1;
      signals.push(`dom:codeBlocks>=10`);
    }

    const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6').length;
    if (headings >= 5) {
      scores.documentation += 1;
      signals.push(`dom:headings>=5`);
    }

    const comments = doc.querySelectorAll(
      '.comment, .reply, .post, [id^="comment-"], [class*="comment"], [id*="comment"], [class*="thread"], [id*="thread"], [class*="reply"], [id*="reply"], [class*="discussion"], [id*="discussion"]'
    ).length;
    if (comments >= 3) {
      scores.forum += 3;
      signals.push(`dom:comments>=3`);
    }

    if (
      doc.querySelector('[itemtype*="Product"]') ||
      doc.querySelector('.price, [itemprop="price"]') ||
      doc.querySelector('button[class*="cart"], button[id*="cart"], button[class*="checkout"], button[id*="checkout"]')
    ) {
      scores.product += 4;
      signals.push('dom:product_signals');
    }

    // Evaluate paragraphs for article logic
    const paragraphs = doc.querySelectorAll('p');
    let longParagraphs = 0;
    for (const p of Array.from(paragraphs)) {
      if ((p.textContent || '').trim().length > 200) {
        longParagraphs++;
      }
    }
    if (longParagraphs >= 3) {
      scores.article += 2;
      signals.push('dom:long_paragraphs>=3');
    }

    let winnerProfile: PageTypeProfile = 'generic';
    let maxScore = 0;

    for (const [profile, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        winnerProfile = profile as PageTypeProfile;
      }
    }

    if (maxScore < 3) {
      return { profile: 'generic', confidence: 0.3, signals };
    }

    const confidence = Math.min(1, maxScore / 8);
    return { profile: winnerProfile, confidence, signals };
  }

  private static toHostname(normalizedUrl: string): string {
    if (!normalizedUrl) return '';
    try {
      return new URL(normalizedUrl).hostname.toLowerCase();
    } catch {
      return normalizedUrl;
    }
  }
}
