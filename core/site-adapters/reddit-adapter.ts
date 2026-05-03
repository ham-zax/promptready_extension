import { RedditShadowExtractor } from '../reddit-shadow-extractor.js';
import type { SiteAdapterCandidate, SiteAdapterMatch, SiteContentAdapter } from './types.js';

function safeHostname(url?: string): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export class RedditContentAdapter implements SiteContentAdapter {
  id = 'reddit';

  matches(doc: Document, url?: string): SiteAdapterMatch {
    const hostname = safeHostname(url);
    const isRedditHost =
      hostname === 'reddit.com' ||
      hostname.endsWith('.reddit.com') ||
      hostname === 'redd.it' ||
      hostname.endsWith('.redd.it');
    const hasRedditDom = Boolean(doc.querySelector('shreddit-post, shreddit-comment-tree'));

    if (isRedditHost) {
      return { matched: true, reason: 'url:reddit' };
    }
    if (hasRedditDom) {
      return { matched: true, reason: 'dom:shreddit' };
    }
    return { matched: false };
  }

  extract(doc: Document, url?: string): SiteAdapterCandidate | null {
    const result = RedditShadowExtractor.extractContent(doc, url);
    if (!result) {
      return null;
    }

    return {
      source: `adapter:reddit:${result.metadata.strategy}`,
      html: result.content,
      confidence: result.metadata.qualityScore / 100,
      diagnostics: {
        adapter: this.id,
        strategy: result.metadata.strategy,
        qualityScore: result.metadata.qualityScore,
      },
    };
  }
}
