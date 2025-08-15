
/// <reference types="@cloudflare/workers-types" />

export interface Env {
  CREDITS_KV: KVNamespace;
  SERVICE_SECRET: string; // Added for inter-service authentication
}

interface UserRequest {
  userId: string;
}

// A simple router to handle different paths
const router = {
  '/user/status': handleUserStatus,
  '/credits/decrement': handleDecrement,
};

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const handler = router[url.pathname as keyof typeof router];

    if (handler) {
      return handler(request, env);
    }

    return new Response('Not Found', { status: 404 });
  },
};

async function handleUserStatus(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { userId } = await request.json() as UserRequest;
    if (!userId) {
      return new Response('User ID is required', { status: 400 });
    }

    let userCredits = await env.CREDITS_KV.get(userId);

    if (userCredits === null) {
      // User doesn't exist, create them with initial credits
      await env.CREDITS_KV.put(userId, '150');
      userCredits = '150';
    }

    return new Response(
      JSON.stringify({
        userId,
        creditsRemaining: parseInt(userCredits, 10),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in handleUserStatus:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

async function handleDecrement(request: Request, env: Env): Promise<Response> {
    // --- THIS IS THE FIX ---
    const expectedToken = env.SERVICE_SECRET; // You must set this secret in your worker's settings
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      return new Response('Unauthorized', { status: 401 });
    }
    // ---------------------
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { userId } = await request.json() as UserRequest;
        if (!userId) {
            return new Response('User ID is required', { status: 400 });
        }

        const currentCreditsStr = await env.CREDITS_KV.get(userId);
        if (currentCreditsStr === null) {
            return new Response('User not found', { status: 404 });
        }

        const currentCredits = parseInt(currentCreditsStr, 10);
        if (currentCredits <= 0) {
            return new Response('Insufficient credits', { status: 402 });
        }

        const newCredits = currentCredits - 1;
        await env.CREDITS_KV.put(userId, newCredits.toString());

        return new Response(
            JSON.stringify({
                userId,
                creditsRemaining: newCredits,
            }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    } catch (error) {
        console.error('Error in handleDecrement:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}
