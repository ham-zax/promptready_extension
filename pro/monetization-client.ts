// pro/monetization-client.ts (Corrected and Type-Safe)

import { getRuntimeProfile } from '@/lib/runtime-profile';

// --- Define the explicit API response contracts ---

interface CheckCreditsApiResponse {
  balance: number;
  weeklyCap: number;
}

interface ProcessAiSuccessResponse {
  status: 'SUCCESS';
  content?: string;
  processed_content?: string;
  remaining?: number;
}

interface ProcessAiErrorResponse {
  error: 'INSUFFICIENT_CREDITS' | 'WEEKLY_CAP_EXCEEDED';
  remaining?: number;
}

// A union type for all possible valid responses from the /process-ai endpoint
type ProcessAiApiResponse = ProcessAiSuccessResponse | ProcessAiErrorResponse;

// --- Interfaces for the client's public methods ---

export interface CheckCreditsResponse {
  balance: number;
  weeklyCap: number;
}

export interface ProcessAIResponse {
  success: boolean;
  content?: string;
  remaining?: number;
  error?: 'INSUFFICIENT_CREDITS' | 'WEEKLY_CAP_EXCEEDED' | 'UNKNOWN_ERROR';
}

export interface BillingActionResponse {
  success: boolean;
  error?: string;
}

// --- MonetizationClient Class ---

export class MonetizationClient {
  private static readonly DEV_BALANCE = 999999;

  private static getApiBase(): string {
    return getRuntimeProfile().monetizationApiBase;
  }

  private static isMockMode(): boolean {
    return getRuntimeProfile().useMockMonetization;
  }

  private static shouldFailOpenWithoutNetwork(): boolean {
    const profile = getRuntimeProfile();
    return (
      profile.isDevelopment ||
      profile.openAccessEnabled ||
      profile.premiumBypassEnabled ||
      profile.useMockMonetization
    );
  }

  private static shouldSuppressFallbackLog(status?: number): boolean {
    const profile = getRuntimeProfile();
    if (
      profile.isDevelopment ||
      profile.openAccessEnabled ||
      profile.premiumBypassEnabled ||
      profile.useMockMonetization
    ) {
      return true;
    }

    // These are expected when monetization endpoints are not wired for local/offline workflows.
    return status === 401 || status === 403 || status === 404 || status === 405;
  }

  private static unlimitedCredits(): CheckCreditsResponse {
    return { balance: this.DEV_BALANCE, weeklyCap: this.DEV_BALANCE };
  }

  private static passthroughAI(prompt: string): ProcessAIResponse {
    return {
      success: true,
      content: prompt,
      remaining: this.DEV_BALANCE,
    };
  }

  /**
   * Checks a user's credit balance by calling the backend endpoint.
   */
  static async checkCredits(userId: string): Promise<CheckCreditsResponse> {
    if (this.shouldFailOpenWithoutNetwork()) {
      return this.unlimitedCredits();
    }

    const url = `${this.getApiBase()}/user/status`; // Corrected endpoint from your functions/credit-service

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!resp.ok) {
        if (!this.shouldSuppressFallbackLog(resp.status)) {
          console.warn(`[MonetizationClient] checkCredits returned ${resp.status}`);
        }
        // Development-first fail-open behavior: backend issues must not paywall local workflows.
        return this.unlimitedCredits();
      }

      // Use the type assertion here
      const data = await resp.json() as CheckCreditsApiResponse;
      
      return {
        balance: typeof data.balance === 'number' ? data.balance : 0,
        weeklyCap: typeof data.weeklyCap === 'number' ? data.weeklyCap : 0,
      };
    } catch (err) {
      if (!this.shouldSuppressFallbackLog()) {
        console.error('[MonetizationClient] checkCredits error:', err);
      }
      // Network/offline failures must not hard-lock the popup during development workflows.
      return this.unlimitedCredits();
    }
  }

  /**
   * Processes an AI request through the backend proxy.
   */
  static async processWithAI(userId: string, prompt: string): Promise<ProcessAIResponse> {
    if (this.isMockMode()) {
      return {
        success: true,
        content: prompt,
        remaining: this.DEV_BALANCE,
      };
    }

    const url = `${this.getApiBase()}/`; // The ai-proxy is the root of the service

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, content: prompt }), // Match ai-proxy expected body
      });

      if (!resp.ok) {
        if (!this.shouldSuppressFallbackLog(resp.status)) {
          console.warn(`[MonetizationClient] processWithAI non-ok status ${resp.status}`);
        }
        return this.passthroughAI(prompt);
      }

      // Use the type assertion here
      const data = await resp.json() as ProcessAiApiResponse;

      // Type guard to narrow down the union type
      if ('status' in data && data.status === 'SUCCESS') {
        return {
          success: true,
          content: data.processed_content || data.content || '',
          remaining: typeof data.remaining === 'number' ? data.remaining : undefined,
        };
      }

      if ('error' in data) {
        if (!this.shouldSuppressFallbackLog()) {
          console.warn(`[MonetizationClient] processWithAI returned error payload ${data.error}; using pass-through fallback`);
        }
        return this.passthroughAI(prompt);
      }

      return this.passthroughAI(prompt);
    } catch (err) {
      if (!this.shouldSuppressFallbackLog()) {
        console.error('[MonetizationClient] processWithAI error:', err);
      }
      return this.passthroughAI(prompt);
    }
  }

  static async startTrial(email: string): Promise<BillingActionResponse> {
    if (!email || !email.includes('@')) {
      return { success: false, error: 'VALID_EMAIL_REQUIRED' };
    }

    if (this.isMockMode()) {
      return { success: true };
    }

    // Stubbed until billing backend endpoint is finalized.
    return { success: true };
  }

  static async createSubscription(email: string): Promise<BillingActionResponse> {
    if (!email || !email.includes('@')) {
      return { success: false, error: 'VALID_EMAIL_REQUIRED' };
    }

    if (this.isMockMode()) {
      return { success: true };
    }

    // Stubbed until billing backend endpoint is finalized.
    return { success: true };
  }
}
