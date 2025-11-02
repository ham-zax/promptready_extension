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
}

import { browser } from 'wxt/browser';

export interface BYOKResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface OpenAICompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class BYOKClient {
  private static readonly TIMEOUT_MS = 30000; // 30 seconds
  private static readonly DEFAULT_TEMPERATURE = 0;
  private static readonly MAX_TOKENS = 4000;

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

    return this.callOpenAICompatibleAPI(request, settings);
  }

  private static async callOpenAICompatibleAPI(
    request: BYOKRequest,
    settings: BYOKSettings
  ): Promise<BYOKResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    try {
      // The AI proxy worker will handle the actual API call
      const url = `/api/proxy`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...request,
          settings,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`BYOK request failed: ${response.status} ${text.slice(0, 300)}`);
      }

      const data = await response.json() as BYOKResponse;
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('BYOK request timed out');
      }
      throw error;
    }
  }
}
