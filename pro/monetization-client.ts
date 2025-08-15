// pro/monetization-client.ts (Corrected and Type-Safe)

import { browser } from 'wxt/browser';
import { Storage } from '@/lib/storage';

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

// --- MonetizationClient Class ---

export class MonetizationClient {

  private static getApiBase(): string {
    // For local dev, change this to your wrangler dev URL (e.g., http://127.0.0.1:8788)
    return 'http://127.0.0.1:8788'; 
  }

  /**
   * Checks a user's credit balance by calling the backend endpoint.
   */
  static async checkCredits(userId: string): Promise<CheckCreditsResponse> {
    const url = `${this.getApiBase()}/user/status`; // Corrected endpoint from your functions/credit-service

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!resp.ok) {
        console.warn(`[MonetizationClient] checkCredits returned ${resp.status}`);
        return { balance: 0, weeklyCap: 0 };
      }

      // Use the type assertion here
      const data = await resp.json() as CheckCreditsApiResponse;
      
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
   */
  static async processWithAI(userId: string, prompt: string): Promise<ProcessAIResponse> {
    const url = `${this.getApiBase()}/`; // The ai-proxy is the root of the service

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, content: prompt }), // Match ai-proxy expected body
      });

      if (!resp.ok) {
        if (resp.status === 402) return { success: false, error: 'INSUFFICIENT_CREDITS' };
        if (resp.status === 503) return { success: false, error: 'WEEKLY_CAP_EXCEEDED' };
        console.warn(`[MonetizationClient] processWithAI non-ok status ${resp.status}`);
        return { success: false, error: 'UNKNOWN_ERROR' };
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
        return { success: false, error: data.error, remaining: data.remaining };
      }

      return { success: false, error: 'UNKNOWN_ERROR' };
    } catch (err) {
      console.error('[MonetizationClient] processWithAI error:', err);
      return { success: false, error: 'UNKNOWN_ERROR' };
    }
  }
}