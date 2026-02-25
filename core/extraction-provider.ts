import type { ExportMetadata } from '../lib/types.js';
import { getRuntimeProfile } from '../lib/runtime-profile.js';
import {
  OfflineModeManager,
  type OfflineModeConfig,
  type OfflineProcessingResult,
} from './offline-mode-manager.js';

interface TrafilaturaResponse {
  success?: boolean;
  markdown?: string;
  text?: string;
  metadata?: Record<string, any>;
  warnings?: string[];
  diagnostics?: Record<string, any>;
}

export type ExtractionProviderName = 'local-offline' | 'trafilatura';

export interface ExtractionProviderDecision {
  provider: ExtractionProviderName;
  fallbackReason?: string;
  diagnostics?: Record<string, any>;
}

export interface ProviderChainResult {
  result: OfflineProcessingResult;
  decision: ExtractionProviderDecision;
}

function ensureCitationBlock(markdown: string, metadata: ExportMetadata): string {
  return OfflineModeManager.canonicalizeDeliveredMarkdown(markdown, metadata);
}

async function fetchTrafilaturaFallback(
  serviceUrl: string,
  html: string,
  url: string,
  title: string,
): Promise<TrafilaturaResponse | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const endpoint = `${serviceUrl.replace(/\/$/, '')}/extract`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        html,
        output: 'markdown',
        includeMetadata: true,
        title,
      }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.json() as TrafilaturaResponse;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function processWithProviderChain(
  html: string,
  url: string,
  title: string,
  config: OfflineModeConfig,
): Promise<ProviderChainResult> {
  const runtimeProfile = getRuntimeProfile();
  const minQualityScore = 65;
  const localResult = await OfflineModeManager.processContent(html, url, title, config);
  const localQuality = localResult.processingStats?.qualityScore ?? 0;

  if (
    localResult.success &&
    (localQuality >= minQualityScore || !runtimeProfile.trafilaturaServiceUrl)
  ) {
    return {
      result: localResult,
      decision: { provider: 'local-offline' },
    };
  }

  if (!runtimeProfile.trafilaturaServiceUrl) {
    return {
      result: localResult,
      decision: {
        provider: 'local-offline',
        fallbackReason: 'trafilatura-unconfigured',
      },
    };
  }

  const trafilatura = await fetchTrafilaturaFallback(
    runtimeProfile.trafilaturaServiceUrl,
    html,
    url,
    title,
  );

  const trafilaturaMarkdown = trafilatura?.markdown || trafilatura?.text || '';
  if (!trafilatura || !trafilaturaMarkdown.trim()) {
    return {
      result: localResult,
      decision: {
        provider: 'local-offline',
        fallbackReason: localResult.success ? 'local-quality-low-trafilatura-empty' : 'local-failed-trafilatura-empty',
      },
    };
  }

  const metadata = localResult.metadata;
  const normalizedMarkdown = ensureCitationBlock(trafilaturaMarkdown.trim(), metadata);
  const combinedWarnings = [
    ...(localResult.warnings || []),
    ...(trafilatura.warnings || []),
    'Trafilatura fallback provider used',
  ];
  const mergedFallbacks = Array.from(new Set([
    ...(localResult.processingStats?.fallbacksUsed || []),
    'trafilatura-fallback',
  ]));

  return {
    result: {
      ...localResult,
      success: true,
      markdown: normalizedMarkdown,
      warnings: combinedWarnings,
      processingStats: {
        ...localResult.processingStats,
        totalTime: localResult.processingStats.totalTime,
        qualityScore: Math.max(localQuality, minQualityScore),
        fallbacksUsed: mergedFallbacks,
      },
    },
    decision: {
      provider: 'trafilatura',
      fallbackReason: localResult.success ? `local-quality-${localQuality}` : 'local-processing-failed',
      diagnostics: trafilatura.diagnostics,
    },
  };
}
