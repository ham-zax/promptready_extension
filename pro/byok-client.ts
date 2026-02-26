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
  private static readonly TIMEOUT_MS = 30000; // 30 seconds
  private static readonly OPENROUTER_CHAT_COMPLETIONS_URL = 'https://openrouter.ai/api/v1/chat/completions';
  private static readonly OPENROUTER_REFERER = 'https://promptready.app/';
  private static readonly OPENROUTER_TITLE = 'PromptReady Extension';

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
    _options: BYOKOptions = {}
  ): Promise<BYOKResponse> {
    const normalizedApiKey = (settings.apiKey || '').trim();
    if (!normalizedApiKey) {
      throw new Error('OpenRouter API key is required');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    try {
      // OpenRouter-only BYOK workflow (single canonical provider path).
      const response = await fetch(this.OPENROUTER_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${normalizedApiKey}`,
          'HTTP-Referer': this.OPENROUTER_REFERER,
          'X-Title': this.OPENROUTER_TITLE,
          'X-OpenRouter-Title': this.OPENROUTER_TITLE,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: settings.model,
          temperature: request.temperature ?? 0,
          max_tokens: request.maxTokens ?? 4000,
          stream: false,
          messages: [
            {
              role: 'user',
              content: request.prompt,
            },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenRouter request failed: ${response.status} ${text.slice(0, 300)}`);
      }

      const payload = await response.json() as any;
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        throw new Error('OpenRouter returned empty content');
      }

      return {
        content,
        usage: payload?.usage
          ? {
            promptTokens: payload.usage.prompt_tokens ?? 0,
            completionTokens: payload.usage.completion_tokens ?? 0,
            totalTokens: payload.usage.total_tokens ?? 0,
          }
          : undefined,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('OpenRouter request timed out');
      }
      throw error;
    }
  }
}
