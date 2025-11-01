// functions/ai-proxy/index.ts (Corrected with a Router)
/// <reference types="@cloudflare/workers-types" />
import { Queue } from '@cloudflare/workers-types';

export interface Env {
  CREDITS_KV: KVNamespace;
  BUDGET_KV: KVNamespace;
  AI_API_KEY: string;
  SERVICE_SECRET: string;
  costTrackingQueue: Queue;
  CREDIT_SERVICE: Fetcher;
}

interface AIProxyRequest {
  userId: string;
  content: string;
}

// ... other interfaces from your original file

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    // --- SIMPLE ROUTER LOGIC ---
    if (url.pathname === '/user/status') {
      // This is a request for credit status. Proxy it directly to the credit-service.
      console.log('[ai-proxy] Routing request to /user/status on credit-service');
      return env.CREDIT_SERVICE.fetch(request);
    }
    
    // Default behavior: assume it's an AI processing request
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      const { userId, content } = await request.json() as AIProxyRequest;
      if (!userId || !content) {
        return new Response('User ID and content are required', { status: 400 });
      }

      // 1. Check user credits by calling the credit-service binding
      const creditsResponse = await env.CREDIT_SERVICE.fetch('http://localhost/user/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!creditsResponse.ok) {
        return new Response('Failed to verify credits', { status: creditsResponse.status });
      }

      const creditsData = await creditsResponse.json() as { creditsRemaining: number };
      if (creditsData.creditsRemaining <= 0) {
        return new Response('Insufficient credits', { status: 402 });
      }

      // 2. Call the external AI API (existing logic)
      const aiResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.AI_API_KEY || 'not-set'}`, // Use env secret
        },
        body: JSON.stringify({
          model: 'llama3-70b-8192', // GPT OSS 20B equivalent on Groq
          messages: [{ role: 'user', content: `Clean this content: ${content}` }],
        }),
      });

      if (!aiResponse.ok) {
        return new Response('AI service request failed', { status: aiResponse.status, statusText: await aiResponse.text() });
      }

      const aiData = await aiResponse.json() as any;
      const processedContent = aiData.choices[0].message.content;

      // 3. Decrement user credits
      ctx.waitUntil(env.CREDIT_SERVICE.fetch('http://localhost/credits/decrement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.SERVICE_SECRET}`
        },
        body: JSON.stringify({ userId }),
      }));

      // 4. Return the processed content
      return new Response(
        JSON.stringify({
          status: 'SUCCESS',
          processed_content: processedContent,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );

    } catch (error) {
      console.error('Error in AI proxy:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};