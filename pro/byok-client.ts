/**
 * BYOK (Bring Your Own Key) Client
 * Handles secure communication with OpenAI-compatible endpoints with consent and safeguards.
 */

export interface BYOKRequest {
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface BYOKSettings {
  apiBase: string;
  apiKey: string;
  model: string;
}

export interface BYOKOptions {
  showModal?: boolean;
  requireExplicitConsent?: boolean;
  proxyUrl?: string;
}

export interface BYOKResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class BYOKClient {
  private static readonly TIMEOUT_MS = 90000; // OpenRouter/provider paths can exceed 30s on long captures.

  /**
   * Make a BYOK request with consent and safeguards
   */
  static async makeRequest(
    request: BYOKRequest,
    settings: BYOKSettings,
    options: BYOKOptions = {}
  ): Promise<BYOKResponse> {
    // Consent check (simplified for now - in full implementation would show modal)
    if (options.requireExplicitConsent) {
      console.log('[BYOK] Explicit consent required - proceeding with request');
    }

    return this.callOpenAICompatibleAPI(request, settings, options);
  }

  private static async callOpenAICompatibleAPI(
    request: BYOKRequest,
    settings: BYOKSettings,
    options: BYOKOptions = {}
  ): Promise<BYOKResponse> {
    const normalizedApiKey = (settings.apiKey || '').trim();
    if (!normalizedApiKey) {
      throw new Error('BYOK API key is required');
    }

    if (!options.proxyUrl) {
      throw new Error('proxyUrl is required for BYOK requests');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    try {
      // Proxy path only: POST directly to proxy URL with proxy payload shape.
      // The worker normalizes the response to { content, usage }.
      const response = await fetch(options.proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: request.prompt,
          temperature: request.temperature ?? 0,
          maxTokens: request.maxTokens ?? 4000,
          settings: {
            apiBase: settings.apiBase,
            apiKey: normalizedApiKey,
            model: settings.model,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text();
        let message = `${response.status} ${text.slice(0, 300)}`;
        try {
          const payload = JSON.parse(text) as { error?: unknown };
          if (typeof payload?.error === 'string' && payload.error.trim()) {
            message = payload.error.trim();
          }
        } catch {
          // Keep the status + text fallback for non-JSON proxy errors.
        }
        throw new Error(`BYOK request failed: ${message}`);
      }

      const payload = await response.json() as any;

      // Proxy returns normalized { content, usage }.
      const content = payload?.content;
      if (typeof content !== 'string' || !content.trim()) {
        throw new Error('BYOK returned empty content');
      }

      const usage = payload?.usage
        ? {
            promptTokens: payload.usage.promptTokens ?? 0,
            completionTokens: payload.usage.completionTokens ?? 0,
            totalTokens: payload.usage.totalTokens ?? 0,
          }
        : undefined;

      return { content, usage };
    } catch (error) {
      clearTimeout(timeoutId);
      if (
        error instanceof Error && error.name === 'AbortError' ||
        Boolean(error && typeof error === 'object' && (error as { name?: unknown }).name === 'AbortError')
      ) {
        throw new Error('BYOK request timed out');
      }
      if (
        error instanceof TypeError &&
        /failed to fetch/i.test(error.message)
      ) {
        throw new Error(
          `BYOK proxy network request failed for ${options.proxyUrl}. ` +
            'If this is a development extension build, run the local proxy on 127.0.0.1:8788 or set WXT_BYOK_PROXY_URL=https://promptready.app/api/proxy.',
        );
      }
      throw error;
    }
  }
}
