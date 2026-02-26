export interface CanonicalCapturePayload {
  html: string;
  url: string;
  title: string;
  selectionHash: string;
  isSelection?: boolean;
  tabId?: number;
  metadataHtml?: string;
}

function readRequiredString(payload: unknown, field: keyof CanonicalCapturePayload): string {
  const value = (payload as Record<string, unknown> | null)?.[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid capture payload: missing or empty ${field}`);
  }
  return value;
}

/**
 * Enforce the capture->background contract as a normalized DOM snapshot.
 * Any extraction hints/decisions from content-side code are intentionally ignored.
 */
export function sanitizeCapturePayload(payload: unknown): CanonicalCapturePayload {
  const html = readRequiredString(payload, 'html');
  const url = readRequiredString(payload, 'url');
  const title = readRequiredString(payload, 'title');
  const selectionHash = readRequiredString(payload, 'selectionHash');

  const normalized: CanonicalCapturePayload = {
    html,
    url,
    title,
    selectionHash,
  };

  const source = payload as Record<string, unknown> | null;
  if (typeof source?.isSelection === 'boolean') {
    normalized.isSelection = source.isSelection;
  }
  if (typeof source?.tabId === 'number' && Number.isFinite(source.tabId)) {
    normalized.tabId = source.tabId;
  }
  if (typeof source?.metadataHtml === 'string') {
    const trimmed = source.metadataHtml.trim();
    if (trimmed) {
      // Guard against pathological payload sizes; this is only for metadata signal extraction.
      normalized.metadataHtml = trimmed.slice(0, 200_000);
    }
  }

  return normalized;
}
