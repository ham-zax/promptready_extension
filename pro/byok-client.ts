/**
 * BYOK (Bring Your Own Key) Client
 * Handles direct OpenRouter communication with consent and safeguards.
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

export interface BYOKResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

type OpenRouterChoice = {
  message?: { content?: unknown };
  text?: unknown;
  finish_reason?: unknown;
  native_finish_reason?: unknown;
  error?: {
    code?: unknown;
    message?: unknown;
  };
};

function capProviderMessage(message: string): string {
  return message.trim().slice(0, 500);
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error && error.name === 'AbortError' ||
    Boolean(error && typeof error === 'object' && (error as { name?: unknown }).name === 'AbortError')
  );
}

function isNetworkFetchError(error: unknown): boolean {
  return error instanceof TypeError && /failed to fetch/i.test(error.message);
}

function getChoices(payload: unknown): OpenRouterChoice[] {
  const choices = (payload as { choices?: unknown } | null)?.choices;
  return Array.isArray(choices) ? choices as OpenRouterChoice[] : [];
}

function getFirstChoiceContent(payload: unknown): string | null {
  for (const choice of getChoices(payload)) {
    const messageContent = choice?.message?.content;
    if (typeof messageContent === 'string' && messageContent.trim()) {
      return messageContent;
    }

    if (typeof choice?.text === 'string' && choice.text.trim()) {
      return choice.text;
    }
  }

  return null;
}

function getEmbeddedChoiceError(payload: unknown): string | null {
  for (const choice of getChoices(payload)) {
    const rawMessage = choice?.error?.message;
    if (typeof rawMessage === 'string' && rawMessage.trim()) {
      return capProviderMessage(rawMessage);
    }
  }

  return null;
}

function getChoiceReasons(payload: unknown): string {
  const reasons = getChoices(payload)
    .map((choice) => {
      const finishReason = typeof choice?.finish_reason === 'string' ? choice.finish_reason : 'unknown';
      const nativeReason = typeof choice?.native_finish_reason === 'string' ? choice.native_finish_reason : '';
      return nativeReason && nativeReason !== finishReason
        ? `${finishReason}/${nativeReason}`
        : finishReason;
    })
    .filter(Boolean);

  return reasons.length > 0 ? reasons.join(', ') : 'none';
}

function buildChatCompletionsUrl(apiBase: string): string {
  const normalizedApiBase = apiBase.trim();
  if (!normalizedApiBase) {
    throw new Error('BYOK apiBase is required');
  }

  const parsed = new URL(normalizedApiBase);
  const path = parsed.pathname.replace(/\/$/, '');
  if (path.endsWith('/chat/completions')) {
    return `${parsed.origin}${path}`;
  }

  return `${parsed.origin}${path}/chat/completions`;
}

function isOpenRouterBase(apiBase: string): boolean {
  try {
    const parsed = new URL(apiBase);
    const hostname = parsed.hostname.toLowerCase();
    return hostname === 'openrouter.ai' || hostname.endsWith('.openrouter.ai');
  } catch {
    return false;
  }
}

async function readResponseError(response: Response): Promise<string> {
  const text = await response.text();
  let message = `${response.status} ${text.slice(0, 300)}`;
  try {
    const payload = JSON.parse(text) as { error?: unknown };
    if (typeof payload?.error === 'string' && payload.error.trim()) {
      message = capProviderMessage(payload.error);
    } else if (
      payload?.error &&
      typeof payload.error === 'object' &&
      typeof (payload.error as { message?: unknown }).message === 'string' &&
      (payload.error as { message: string }).message.trim()
    ) {
      const errorObject = payload.error as {
        message: string;
        metadata?: { raw?: unknown };
      };
      const raw = typeof errorObject.metadata?.raw === 'string'
        ? errorObject.metadata.raw.trim()
        : '';
      message = capProviderMessage(
        raw && raw !== errorObject.message.trim()
          ? `${errorObject.message}: ${raw}`
          : errorObject.message,
      );
    }
  } catch {
    // Keep the status + text fallback for non-JSON errors.
  }
  return message;
}

async function readJsonPayload(response: Response, label: string): Promise<any> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`BYOK ${label} returned empty response body`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`BYOK ${label} returned invalid JSON: ${text.trim().slice(0, 300)}`);
  }
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

    return this.callOpenAICompatibleAPI(request, settings);
  }

  private static async callOpenAICompatibleAPI(
    request: BYOKRequest,
    settings: BYOKSettings
  ): Promise<BYOKResponse> {
    const normalizedApiKey = (settings.apiKey || '').trim();
    if (!normalizedApiKey) {
      throw new Error('BYOK API key is required');
    }

    return this.callDirectOpenRouterAPI(request, settings, normalizedApiKey);
  }

  private static async callDirectOpenRouterAPI(
    request: BYOKRequest,
    settings: BYOKSettings,
    normalizedApiKey: string,
  ): Promise<BYOKResponse> {
    const chatCompletionsUrl = buildChatCompletionsUrl(settings.apiBase);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${normalizedApiKey}`,
    };

    if (isOpenRouterBase(settings.apiBase)) {
      headers['HTTP-Referer'] = 'https://promptready.app';
      headers['X-Title'] = 'PromptReady Extension';
      headers['X-OpenRouter-Title'] = 'PromptReady Extension';
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    try {
      const response = await fetch(chatCompletionsUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: settings.model,
          temperature: request.temperature ?? 0,
          max_completion_tokens: request.maxTokens ?? 4000,
          messages: [{ role: 'user', content: request.prompt }],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const message = await readResponseError(response);
        throw new Error(`BYOK request failed: ${message}`);
      }

      const payload = await readJsonPayload(response, 'direct OpenRouter request');
      const content = getFirstChoiceContent(payload);
      if (!content) {
        const embeddedError = getEmbeddedChoiceError(payload);
        if (embeddedError) {
          throw new Error(`BYOK request failed: ${embeddedError}`);
        }

        throw new Error(
          `BYOK returned empty content for model=${settings.model || 'unknown'} ` +
            `(finish reasons: ${getChoiceReasons(payload)}). Try another OpenRouter model.`,
        );
      }

      const usage = payload?.usage
        ? {
            promptTokens: payload.usage.prompt_tokens ?? 0,
            completionTokens: payload.usage.completion_tokens ?? 0,
            totalTokens: payload.usage.total_tokens ?? 0,
          }
        : undefined;

      return { content, usage };
    } catch (error) {
      clearTimeout(timeoutId);
      if (isAbortError(error)) {
        throw new Error('BYOK request timed out');
      }
      if (isNetworkFetchError(error)) {
        throw new Error(
          `BYOK direct network request failed for ${chatCompletionsUrl}. Check extension host permissions or network connectivity.`,
        );
      }
      throw error;
    }
  }
}
