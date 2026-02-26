export interface CanonicalCapturePayload {
  html: string;
  url: string;
  title: string;
  selectionHash: string;
  isSelection?: boolean;
  tabId?: number;
  metadataHtml?: string;
  captureDiagnostics?: {
    strategy: 'initial-body-html' | 'deep-body-html';
    settleWaitMs: number;
    settleTimedOut?: boolean;
    scrollStepsExecuted: number;
    initialScrollHeight: number;
    finalScrollHeight: number;
    initialTextLength?: number;
    deepTextLength?: number;
    headingCountDelta?: number;
    deepUsedReason?: string;
  };
}

function readOptionalFiniteNumber(source: Record<string, unknown>, key: string): number | undefined {
  const value = source[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
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

  if (source?.captureDiagnostics && typeof source.captureDiagnostics === 'object') {
    const diagnostics = source.captureDiagnostics as Record<string, unknown>;
    const strategy = diagnostics.strategy;
    if (strategy !== 'initial-body-html' && strategy !== 'deep-body-html') {
      throw new Error('Invalid capture payload: malformed captureDiagnostics.strategy');
    }

    const settleWaitMs = readOptionalFiniteNumber(diagnostics, 'settleWaitMs');
    const scrollStepsExecuted = readOptionalFiniteNumber(diagnostics, 'scrollStepsExecuted');
    const initialScrollHeight = readOptionalFiniteNumber(diagnostics, 'initialScrollHeight');
    const finalScrollHeight = readOptionalFiniteNumber(diagnostics, 'finalScrollHeight');
    if (
      settleWaitMs === undefined ||
      scrollStepsExecuted === undefined ||
      initialScrollHeight === undefined ||
      finalScrollHeight === undefined
    ) {
      throw new Error('Invalid capture payload: malformed captureDiagnostics numeric fields');
    }

    normalized.captureDiagnostics = {
      strategy,
      settleWaitMs,
      scrollStepsExecuted,
      initialScrollHeight,
      finalScrollHeight,
    };

    if (typeof diagnostics.settleTimedOut === 'boolean') {
      normalized.captureDiagnostics.settleTimedOut = diagnostics.settleTimedOut;
    }
    const initialTextLength = readOptionalFiniteNumber(diagnostics, 'initialTextLength');
    if (initialTextLength !== undefined) {
      normalized.captureDiagnostics.initialTextLength = initialTextLength;
    }
    const deepTextLength = readOptionalFiniteNumber(diagnostics, 'deepTextLength');
    if (deepTextLength !== undefined) {
      normalized.captureDiagnostics.deepTextLength = deepTextLength;
    }
    const headingCountDelta = readOptionalFiniteNumber(diagnostics, 'headingCountDelta');
    if (headingCountDelta !== undefined) {
      normalized.captureDiagnostics.headingCountDelta = headingCountDelta;
    }
    if (typeof diagnostics.deepUsedReason === 'string' && diagnostics.deepUsedReason.trim()) {
      normalized.captureDiagnostics.deepUsedReason = diagnostics.deepUsedReason.trim().slice(0, 200);
    }
  }

  return normalized;
}
