import type {
  ExecutionContext,
  Fetcher,
  KVNamespace,
  Queue,
} from '@cloudflare/workers-types';

export interface Env {
  CREDITS_KV: KVNamespace;
  BUDGET_KV: KVNamespace;
  AI_API_KEY: string;
  SERVICE_SECRET: string;
  ALLOWED_ORIGINS?: string;
  OPENROUTER_HTTP_REFERER?: string;
  OPENROUTER_TITLE?: string;
  OPENROUTER_API_KEY?: string;
  costTrackingQueue: Queue;
  CREDIT_SERVICE: Fetcher;
}

interface AIProxyRequest {
  userId: string;
  content: string;
}

interface BYOKProxyRequest {
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  settings?: {
    apiBase?: string;
    apiKey?: string;
    model?: string;
  };
}

const DEFAULT_ALLOWED_ORIGIN_PATTERNS = [
  /^chrome-extension:\/\/[a-p]{32}$/i,
  /^moz-extension:\/\/[a-z0-9-]+$/i,
  /^http:\/\/localhost(?::\d+)?$/i,
  /^http:\/\/127\.0\.0\.1(?::\d+)?$/i,
  /^https:\/\/promptready\.app$/i,
];

function parseAllowedOrigins(env: Env): string[] {
  const raw = env.ALLOWED_ORIGINS?.trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isOriginAllowed(origin: string | null, env: Env): boolean {
  if (!origin) return true;
  const configured = parseAllowedOrigins(env);
  if (configured.length > 0) {
    if (configured.includes('*')) return true;
    return configured.includes(origin);
  }
  return DEFAULT_ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin));
}

function buildCorsHeaders(origin: string | null): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function jsonResponse(payload: unknown, status = 200, corsHeaders: HeadersInit = buildCorsHeaders(null)): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function errorResponse(message: string, status = 400, corsHeaders: HeadersInit = buildCorsHeaders(null)): Response {
  return jsonResponse({ error: message }, status, corsHeaders);
}

function withCors(response: Response, corsHeaders: HeadersInit): Response {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    if (value) headers.set(key, String(value));
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function handleBYOKProxy(request: Request, env: Env, corsHeaders: HeadersInit): Promise<Response> {
  if (request.method !== 'POST') {
    return errorResponse('Method Not Allowed', 405, corsHeaders);
  }

  let body: BYOKProxyRequest;
  try {
    body = await request.json() as BYOKProxyRequest;
  } catch {
    return errorResponse('Invalid JSON payload', 400, corsHeaders);
  }

  const prompt = body?.prompt?.trim();
  const apiBaseRaw = body?.settings?.apiBase?.trim();
  const isOpenRouterBase = Boolean(apiBaseRaw?.includes('openrouter.ai'));
  const apiKey =
    body?.settings?.apiKey?.trim() ||
    (isOpenRouterBase ? (env.OPENROUTER_API_KEY?.trim() || '') : '');
  const model = body?.settings?.model?.trim();
  const temperature = typeof body?.temperature === 'number' ? body.temperature : 0;
  const maxTokens = typeof body?.maxTokens === 'number' ? body.maxTokens : 4000;

  if (!prompt) return errorResponse('Prompt is required', 400, corsHeaders);
  if (!apiBaseRaw) return errorResponse('settings.apiBase is required', 400, corsHeaders);
  if (!apiKey) {
    return errorResponse(
      isOpenRouterBase
        ? 'OpenRouter API key is required (settings.apiKey or OPENROUTER_API_KEY)'
        : 'settings.apiKey is required',
      400,
      corsHeaders
    );
  }
  if (!model) return errorResponse('settings.model is required', 400, corsHeaders);

  let chatCompletionsUrl = '';
  try {
    const parsed = new URL(apiBaseRaw);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return errorResponse('Only http/https API bases are supported', 400, corsHeaders);
    }
    chatCompletionsUrl = `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}/chat/completions`;
  } catch {
    return errorResponse('Invalid settings.apiBase URL', 400, corsHeaders);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  // OpenRouter quickstart/app attribution headers (optional in docs, helpful in practice).
  if (isOpenRouterBase) {
    headers['HTTP-Referer'] = env.OPENROUTER_HTTP_REFERER || 'https://promptready.app';
    headers['X-Title'] = env.OPENROUTER_TITLE || 'PromptReady Extension';
    headers['X-OpenRouter-Title'] = env.OPENROUTER_TITLE || 'PromptReady Extension';
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(chatCompletionsUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch (error) {
    return errorResponse(`Failed to reach upstream provider: ${error instanceof Error ? error.message : String(error)}`, 502, corsHeaders);
  }

  if (!upstreamResponse.ok) {
    const text = await upstreamResponse.text();
    return errorResponse(`Upstream provider error (${upstreamResponse.status}): ${text.slice(0, 500)}`, upstreamResponse.status, corsHeaders);
  }

  const payload = await upstreamResponse.json() as any;
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    return errorResponse('Upstream provider returned empty content', 502, corsHeaders);
  }

  return jsonResponse({
    content,
    usage: payload?.usage
      ? {
        promptTokens: payload.usage.prompt_tokens ?? 0,
        completionTokens: payload.usage.completion_tokens ?? 0,
        totalTokens: payload.usage.total_tokens ?? 0,
      }
      : undefined,
  }, 200, corsHeaders);
}

async function handleMeteredAIRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  corsHeaders: HeadersInit
): Promise<Response> {
  if (request.method !== 'POST') {
    return errorResponse('Method Not Allowed', 405, corsHeaders);
  }

  try {
    const { userId, content } = await request.json() as AIProxyRequest;
    if (!userId || !content) {
      return errorResponse('User ID and content are required', 400, corsHeaders);
    }

    // 1. Check user credits via credit-service.
    const creditsResponse = await env.CREDIT_SERVICE.fetch('http://localhost/user/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });

    if (!creditsResponse.ok) {
      return errorResponse('Failed to verify credits', creditsResponse.status, corsHeaders);
    }

    const creditsData = await creditsResponse.json() as { creditsRemaining?: number; balance?: number };
    const remaining = typeof creditsData.creditsRemaining === 'number'
      ? creditsData.creditsRemaining
      : (creditsData.balance ?? 0);
    if (remaining <= 0) {
      return errorResponse('Insufficient credits', 402, corsHeaders);
    }

    // 2. Call external AI API for metered mode.
    const aiResponse = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.AI_API_KEY || 'not-set'}`,
      },
      body: JSON.stringify({
        model: 'glm-4.6',
        messages: [{ role: 'user', content: `Clean and structure this content for better readability: ${content}` }],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      return errorResponse(`AI service request failed: ${await aiResponse.text()}`, aiResponse.status, corsHeaders);
    }

    const aiData = await aiResponse.json() as any;
    const processedContent = aiData?.choices?.[0]?.message?.content || '';

    // 3. Decrement user credits asynchronously.
    ctx.waitUntil(env.CREDIT_SERVICE.fetch('http://localhost/credits/decrement', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.SERVICE_SECRET}`,
      },
      body: JSON.stringify({ userId }),
    }));

    // 4. Return processed content.
    return jsonResponse({
      status: 'SUCCESS',
      processed_content: processedContent,
    }, 200, corsHeaders);
  } catch (error) {
    return errorResponse(`Internal Server Error: ${error instanceof Error ? error.message : String(error)}`, 500, corsHeaders);
  }
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const origin = request.headers.get('Origin');
    const corsHeaders = buildCorsHeaders(origin);
    if (!isOriginAllowed(origin, env)) {
      return errorResponse('Origin not allowed', 403, corsHeaders);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return jsonResponse({ ok: true, service: 'ai-proxy' }, 200, corsHeaders);
    }

    // BYOK proxy endpoint used by extension popup/offscreen.
    if (url.pathname === '/api/proxy' || url.pathname === '/byok/proxy') {
      return handleBYOKProxy(request, env, corsHeaders);
    }

    // Credit status passthrough endpoint.
    if (url.pathname === '/user/status') {
      const response = await env.CREDIT_SERVICE.fetch(request as any);
      return withCors(response as any, corsHeaders);
    }

    // Legacy metered AI endpoint remains available at `/`.
    return handleMeteredAIRequest(request, env, ctx, corsHeaders);
  },
};
