import { RedditContentAdapter } from './reddit-adapter.js';
import type { SiteAdapterCollection, SiteAdapterEvent, SiteContentAdapter } from './types.js';

const ADAPTERS: SiteContentAdapter[] = [
  new RedditContentAdapter(),
];

export class SiteAdapterRegistry {
  static collectCandidates(doc: Document, url?: string): SiteAdapterCollection {
    const candidates: SiteAdapterCollection['candidates'] = [];
    const events: SiteAdapterEvent[] = [];
    const matchedAdapterIds: string[] = [];

    for (const adapter of ADAPTERS) {
      const match = adapter.matches(doc, url);
      if (!match.matched) {
        continue;
      }

      matchedAdapterIds.push(adapter.id);

      try {
        const candidate = adapter.extract(doc, url);
        if (candidate) {
          candidates.push(candidate);
        } else {
          events.push({ adapter: adapter.id, status: 'null' });
        }
      } catch {
        events.push({ adapter: adapter.id, status: 'error' });
      }
    }

    return { candidates, events, matchedAdapterIds };
  }
}
