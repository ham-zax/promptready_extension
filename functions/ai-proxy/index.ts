
/// <reference types="@cloudflare/workers-types" />
import { Queue } from '@cloudflare/workers-types'; // Assuming Queue is from here

export interface Env {
  CREDITS_KV: KVNamespace;
  BUDGET_KV: KVNamespace;
  // Secrets for the AI provider
  AI_API_KEY: string;
  SERVICE_SECRET: string; // Added for inter-service authentication
  costTrackingQueue: Queue; // Added for resilient budget updates
}

interface AIProxyRequest {
  userId: string;
  content: string;
}

interface CreditsResponse {
  userId: string;
  creditsRemaining: number;
}

interface AIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage: {
    total_tokens: number;
  };
}

const AI_API_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'; // Placeholder
const AI_MODEL = 'gpt-oss-20b'; // Placeholder
const CENTS_PER_TOKEN = 0.0001; // Placeholder cost

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      const { userId, content } = await request.json() as AIProxyRequest;
      if (!userId || !content) {
        return new Response('User ID and content are required', { status: 400 });
      }

      // 1. Check user credits by calling the credit-service
      const creditsResponse = await fetch(`https://credit-service.your-worker-domain.workers.dev/user/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
      });

      if (!creditsResponse.ok) {
          return new Response('Failed to verify credits', { status: creditsResponse.status });
      }

      const { creditsRemaining } = await creditsResponse.json() as CreditsResponse;

      if (creditsRemaining <= 0) {
          return new Response('Insufficient credits', { status: 402 });
      }


      // 2. Call the external AI API
      const aiResponse = await fetch(AI_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.AI_API_KEY}`,
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [{ role: 'user', content: `Clean this content: ${content}` }],
        }),
      });

      if (!aiResponse.ok) {
        return new Response('AI service request failed', { status: aiResponse.status });
      }

      const aiData = await aiResponse.json() as AIResponse;
      const processedContent = aiData.choices[0].message.content;
      const tokensUsed = aiData.usage.total_tokens;

      // 3. Decrement user credits
      ctx.waitUntil(fetch(`https://credit-service.your-worker-domain.workers.dev/credits/decrement`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // --- THIS IS THE FIX ---
            'Authorization': `Bearer ${env.SERVICE_SECRET}` // Use the same secret
          },
          body: JSON.stringify({ userId }),
      }));


      // 4. Update the weekly spend
      // 4. Update the weekly spend
      const cost = (tokensUsed * CENTS_PER_TOKEN) / 100; // Cost in dollars
      // Env interface now needs: costTrackingQueue: Queue;
      const costData = { cost: cost, timestamp: Date.now() };
      ctx.waitUntil(env.costTrackingQueue.send(costData));


      // 5. Return the processed content
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
