// Client for interacting with the backend monetization services

import { browser } from 'wxt/browser';
import { Storage } from '@/lib/storage';

// --- Interfaces based on backend-monetization-mvp-architecture.md ---

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

// --- MonetizationClient Class ---

export class MonetizationClient {

  private static getApiBase(): string {
    // In the future, this could be dynamically configured
    return 'https://api.promptready.dev';
  }

  /**
   * Checks a user's credit balance by calling the backend endpoint.
   */
  static async checkCredits(userId: string): Promise<CheckCreditsResponse> {
    const url = `${this.getApiBase()}/check-credits`;

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!resp.ok) {
        // Surface a default response on failure so callers can still render safely
        console.warn(`[MonetizationClient] checkCredits returned ${resp.status}`);
        return { balance: 0, weeklyCap: 0 };
      }

      const data = await resp.json();
      // Expecting { balance: number, weeklyCap: number }
      return {
        balance: typeof data.balance === 'number' ? data.balance : 0,
        weeklyCap: typeof data.weeklyCap === 'number' ? data.weeklyCap : 0,
      };
    } catch (err) {
      console.error('[MonetizationClient] checkCredits error:', err);
      return { balance: 0, weeklyCap: 0 };
    }
  }

  /**
   * Processes an AI request through the backend proxy.
   * Maps backend responses and common HTTP status codes to ProcessAIResponse.
   */
  static async processWithAI(userId: string, prompt: string): Promise<ProcessAIResponse> {
    const url = `${this.getApiBase()}/process-ai`;

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, prompt }),
      });

      if (!resp.ok) {
        // Map known statuses to domain errors
        if (resp.status === 402) {
          return { success: false, error: 'INSUFFICIENT_CREDITS' };
        }
        if (resp.status === 429 || resp.status === 403) {
          // 429 (rate/limit) or 403 (forbidden / cap) -> weekly cap exceeded in many deployments
          return { success: false, error: 'WEEKLY_CAP_EXCEEDED' };
        }

        console.warn(`[MonetizationClient] processWithAI non-ok status ${resp.status}`);
        return { success: false, error: 'UNKNOWN_ERROR' };
      }

      const data = await resp.json();
      // Expecting at least { status: 'SUCCESS', processed_content: string, remaining?: number }
      if (data && data.status === 'SUCCESS') {
        return {
          success: true,
          content: data.processed_content || data.content || '',
          remaining: typeof data.remaining === 'number' ? data.remaining : undefined,
        };
      }

      // Backend may return structured error info
      if (data && data.error === 'INSUFFICIENT_CREDITS') {
        return { success: false, error: 'INSUFFICIENT_CREDITS', remaining: data.remaining };
      }
      if (data && data.error === 'WEEKLY_CAP_EXCEEDED') {
        return { success: false, error: 'WEEKLY_CAP_EXCEEDED', remaining: data.remaining };
      }

      // Fallback
      return { success: false, error: 'UNKNOWN_ERROR' };
    } catch (err) {
      console.error('[MonetizationClient] processWithAI error:', err);
      return { success: false, error: 'UNKNOWN_ERROR' };
    }
  }
}
