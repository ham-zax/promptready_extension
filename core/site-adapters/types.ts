export interface SiteAdapterMatch {
  matched: boolean;
  reason?: string;
}

export interface SiteAdapterCandidate {
  source: string;
  html: string;
  confidence?: number;
  diagnostics?: {
    adapter: string;
    strategy?: string;
    warnings?: string[];
    qualityScore?: number;
  };
}

export interface SiteContentAdapter {
  id: string;

  matches(doc: Document, url?: string): SiteAdapterMatch;

  extract(doc: Document, url?: string): SiteAdapterCandidate | null;
}

export interface SiteAdapterEvent {
  adapter: string;
  status: 'null' | 'error';
}

export interface SiteAdapterCollection {
  candidates: SiteAdapterCandidate[];
  events: SiteAdapterEvent[];
  matchedAdapterIds: string[];
}
