import type {
  ExecutionContext,
  Fetcher,
  KVNamespace,
  Queue,
} from "@cloudflare/workers-types";

export interface Env {
  CREDITS_KV: KVNamespace;
  BUDGET_KV: KVNamespace;
  AI_API_KEY: string;
  SERVICE_SECRET: string;
  ALLOWED_ORIGINS?: string;
  OPENROUTER_HTTP_REFERER?: string;
  OPENROUTER_TITLE?: string;
  OPENROUTER_API_KEY?: string;
  /**
   * Comma-separated allowlist for BYOK upstream hostnames.
   *
   * If unset, defaults to `openrouter.ai` (and subdomains).
   * Example: "openrouter.ai,api.openai.com".
   */
  BYOK_ALLOWED_HOSTNAMES?: string;
  costTrackingQueue: Queue;
  CREDIT_SERVICE: Fetcher;
}

interface AIProxyRequest {
  userId: string;
  content: string;
}

function isValidUserId(userId: string): boolean {
  // Best-effort abuse control: restrict userId to a small set of known-safe shapes.
  // - UUID v4 (default extension-generated id)
  // - Chrome identity obfuscated ID (typically digits)
  // - Legacy `pr_` prefixed token
  const trimmed = userId.trim();
  const uuidV4 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const chromeIdentity = /^[0-9]{6,32}$/;
  const prefixed = /^pr_[a-z0-9_-]{16,128}$/i;
  return uuidV4.test(trimmed) || chromeIdentity.test(trimmed) || prefixed.test(trimmed);
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

type RateLimitScope = "user" | "origin" | "ip";

const RATE_LIMIT_PREFIX = "ai-proxy:rl";

function getClientIp(request: Request): string | null {
  // Cloudflare standard headers
  const cfConnectingIp = request.headers.get("CF-Connecting-IP");
  if (cfConnectingIp) return cfConnectingIp;

  const xff = request.headers.get("X-Forwarded-For");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  return null;
}

function msUntilNextWindow(nowMs: number, windowMs: number): number {
  const next = Math.ceil(nowMs / windowMs) * windowMs;
  return Math.max(0, next - nowMs);
}

async function enforceRateLimit(
  request: Request,
  env: Env,
  params: {
    scope: RateLimitScope;
    key: string;
    limit: number;
    windowMs: number;
  },
): Promise<{ ok: true; remaining: number } | { ok: false; retryAfterSec: number }> {
  // Lightweight fixed-window counter in KV.
  // We intentionally keep this simple; it's a best-effort abuse throttle, not a billing primitive.
  const now = Date.now();
  const windowId = Math.floor(now / params.windowMs);
  const kvKey = `${RATE_LIMIT_PREFIX}:${params.scope}:${params.key}:${windowId}`;

  const currentRaw = await env.BUDGET_KV.get(kvKey);
  const current = currentRaw ? Number(currentRaw) : 0;
  const next = current + 1;

  // KV TTL should cover at least the window length plus a small buffer.
  const ttlSeconds = Math.ceil(params.windowMs / 1000) + 5;
  // If multiple requests race, we may undercount. That's acceptable for throttling.
  await env.BUDGET_KV.put(kvKey, String(next), { expirationTtl: ttlSeconds });

  if (next > params.limit) {
    const retryAfterSec = Math.max(1, Math.ceil(msUntilNextWindow(now, params.windowMs) / 1000));
    return { ok: false, retryAfterSec };
  }

  return { ok: true, remaining: Math.max(0, params.limit - next) };
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
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isOriginAllowed(origin: string | null, env: Env): boolean {
  // Missing Origin (aka "null origin") should not be treated as trusted.
  // Browser extension + webapp calls will always include an Origin header.
  //
  // Exception: allow explicit service-authenticated server-to-server calls
  // (cron/queues/health checks) that include Authorization: Bearer SERVICE_SECRET.
  if (!origin) return false;

  const configured = parseAllowedOrigins(env);
  if (configured.length > 0) {
    if (configured.includes("*")) return true;
    return configured.includes(origin);
  }
  return DEFAULT_ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin));
}

function buildCorsHeaders(origin: string | null): HeadersInit {
  // For this worker we never intentionally return wildcard CORS, because all endpoints
  // are used by the extension / app and are not meant to be public cross-origin APIs.
  // If Origin is missing, omit ACAO header entirely.
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function jsonResponse(
  payload: unknown,
  status = 200,
  corsHeaders: HeadersInit = buildCorsHeaders(null),
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function errorResponse(
  message: string,
  status = 400,
  corsHeaders: HeadersInit = buildCorsHeaders(null),
): Response {
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

const DEFAULT_BYOK_ALLOWED_HOSTNAMES = ["openrouter.ai"];

function isPrivateOrLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();

  if (host === "localhost") return true;
  if (host.endsWith(".localhost")) return true;

  // IPv6 loopback / unique-local / link-local (very conservative)
  if (host === "::1") return true;
  if (host.startsWith("fc") || host.startsWith("fd")) return true;
  if (host.startsWith("fe80:")) return true;

  // IPv4 checks
  const ipv4Match = host.match(/^\d{1,3}(?:\.\d{1,3}){3}$/);
  if (ipv4Match) {
    const parts = host.split(".").map((p) => Number(p));
    if (parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;

    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }

  return false;
}

function parseAllowedByokHostnames(env: Env): string[] {
  const raw = env.BYOK_ALLOWED_HOSTNAMES?.trim();
  if (!raw) return DEFAULT_BYOK_ALLOWED_HOSTNAMES;
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isByokHostnameAllowed(hostname: string, env: Env): boolean {
  const allowed = parseAllowedByokHostnames(env);
  const host = hostname.toLowerCase();
  return allowed.some((a) => host === a || host.endsWith(`.${a}`));
}

function validateByokApiBase(
  apiBaseRaw: string,
  env: Env,
): { ok: true; url: URL } | { ok: false; error: string } {
  let parsed: URL;
  try {
    parsed = new URL(apiBaseRaw);
  } catch {
    return { ok: false, error: "Invalid settings.apiBase URL" };
  }

  if (parsed.username || parsed.password) {
    return {
      ok: false,
      error: "settings.apiBase must not include credentials",
    };
  }

  // Only allow HTTPS.
  if (parsed.protocol !== "https:") {
    return { ok: false, error: "Only https API bases are supported" };
  }

  if (parsed.port && parsed.port !== "443") {
    return {
      ok: false,
      error: "settings.apiBase must use default HTTPS port (443)",
    };
  }

  if (isPrivateOrLocalHostname(parsed.hostname)) {
    return { ok: false, error: "settings.apiBase hostname is not allowed" };
  }

  if (!isByokHostnameAllowed(parsed.hostname, env)) {
    return { ok: false, error: "settings.apiBase provider is not allowed" };
  }

  return { ok: true, url: parsed };
}

async function handleBYOKProxy(
  request: Request,
  env: Env,
  corsHeaders: HeadersInit,
): Promise<Response> {
  if (request.method !== "POST") {
    return errorResponse("Method Not Allowed", 405, corsHeaders);
  }

  let body: BYOKProxyRequest;
  try {
    body = (await request.json()) as BYOKProxyRequest;
  } catch {
    return errorResponse("Invalid JSON payload", 400, corsHeaders);
  }

  const prompt = body?.prompt?.trim();
  const apiBaseRaw = body?.settings?.apiBase?.trim();
  const model = body?.settings?.model?.trim();
  const temperature =
    typeof body?.temperature === "number" ? body.temperature : 0;
  const maxTokens =
    typeof body?.maxTokens === "number" ? body.maxTokens : 4000;

  if (!prompt) return errorResponse("Prompt is required", 400, corsHeaders);
  if (!apiBaseRaw)
    return errorResponse("settings.apiBase is required", 400, corsHeaders);
  if (!model)
    return errorResponse("settings.model is required", 400, corsHeaders);

  const validation = validateByokApiBase(apiBaseRaw, env);
  if (!validation.ok) {
    return errorResponse(validation.error, 400, corsHeaders);
  }

  const parsed = validation.url;
  const hostname = parsed.hostname.toLowerCase();
  const isOpenRouterBase =
    hostname === "openrouter.ai" || hostname.endsWith(".openrouter.ai");

  const allowEnvKeyFallback =
    isServiceAuthenticated(request, env) && !request.headers.get("Origin");

  const apiKey =
    body?.settings?.apiKey?.trim() ||
    (allowEnvKeyFallback && isOpenRouterBase
      ? env.OPENROUTER_API_KEY?.trim() || ""
      : "");

  if (!apiKey) {
    return errorResponse(
      isOpenRouterBase
        ? "OpenRouter API key is required (settings.apiKey)"
        : "settings.apiKey is required",
      400,
      corsHeaders,
    );
  }

  const chatCompletionsUrl = `${parsed.origin}${parsed.pathname.replace(/\/$/, "")}/chat/completions`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  // OpenRouter quickstart/app attribution headers (optional in docs, helpful in practice).
  if (isOpenRouterBase) {
    headers["HTTP-Referer"] =
      env.OPENROUTER_HTTP_REFERER || "https://promptready.app";
    headers["X-Title"] = env.OPENROUTER_TITLE || "PromptReady Extension";
    headers["X-OpenRouter-Title"] =
      env.OPENROUTER_TITLE || "PromptReady Extension";
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(chatCompletionsUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch (error) {
    return errorResponse(
      `Failed to reach upstream provider: ${error instanceof Error ? error.message : String(error)}`,
      502,
      corsHeaders,
    );
  }

  if (!upstreamResponse.ok) {
    const text = await upstreamResponse.text();
    return errorResponse(
      `Upstream provider error (${upstreamResponse.status}): ${text.slice(0, 500)}`,
      upstreamResponse.status,
      corsHeaders,
    );
  }

  const payload = (await upstreamResponse.json()) as any;
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    return errorResponse(
      "Upstream provider returned empty content",
      502,
      corsHeaders,
    );
  }

  return jsonResponse(
    {
      content,
      usage: payload?.usage
        ? {
            promptTokens: payload.usage.prompt_tokens ?? 0,
            completionTokens: payload.usage.completion_tokens ?? 0,
            totalTokens: payload.usage.total_tokens ?? 0,
          }
        : undefined,
    },
    200,
    corsHeaders,
  );
}

async function handleMeteredAIRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  corsHeaders: HeadersInit,
): Promise<Response> {
  if (request.method !== "POST") {
    return errorResponse("Method Not Allowed", 405, corsHeaders);
  }

  try {
    const { userId, content } = (await request.json()) as AIProxyRequest;
    if (!userId || !content) {
      return errorResponse(
        "User ID and content are required",
        400,
        corsHeaders,
      );
    }
    if (!isValidUserId(userId)) {
      return errorResponse("Invalid userId format", 400, corsHeaders);
    }

    // Rate limiting (best-effort): throttle brute force / abuse attempts.
    // We apply three independent fixed-window limits:
    // - per userId
    // - per Origin
    // - per client IP (if present)
    const origin = request.headers.get("Origin") || "";
    const clientIp = getClientIp(request);

    // Allow internal service-authenticated callers to bypass limits.
    if (!isServiceAuthenticated(request, env)) {
      const userRl = await enforceRateLimit(request, env, {
        scope: "user",
        key: userId,
        limit: 30,
        windowMs: 60_000,
      });
      if (!userRl.ok) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(userRl.retryAfterSec),
          },
        });
      }

      if (origin) {
        const originRl = await enforceRateLimit(request, env, {
          scope: "origin",
          key: origin,
          limit: 120,
          windowMs: 60_000,
        });
        if (!originRl.ok) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
            status: 429,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              "Retry-After": String(originRl.retryAfterSec),
            },
          });
        }
      }

      if (clientIp) {
        const ipRl = await enforceRateLimit(request, env, {
          scope: "ip",
          key: clientIp,
          limit: 180,
          windowMs: 60_000,
        });
        if (!ipRl.ok) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
            status: 429,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              "Retry-After": String(ipRl.retryAfterSec),
            },
          });
        }
      }
    }

    // 1. Reserve/decrement credits via credit-service BEFORE calling upstream.
    // This removes the "check then async decrement" race.
    const idempotencyKey =
      request.headers.get("Idempotency-Key") || crypto.randomUUID();

    const debitResponse = await env.CREDIT_SERVICE.fetch(
      "http://localhost/credits/decrement",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.SERVICE_SECRET}`,
        },
        body: JSON.stringify({ userId, amount: 1, idempotencyKey }),
      },
    );

    if (!debitResponse.ok) {
      const msg = await debitResponse.text().catch(() => "");
      return errorResponse(
        msg || "Failed to decrement credits",
        debitResponse.status,
        corsHeaders,
      );
    }

    // 2. Call external AI API for metered mode.
    const aiResponse = await fetch(
      "https://api.z.ai/api/paas/v4/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.AI_API_KEY || "not-set"}`,
        },
        body: JSON.stringify({
          model: "glm-4.6",
          messages: [
            {
              role: "user",
              content: `Clean and structure this content for better readability: ${content}`,
            },
          ],
          temperature: 0.7,
        }),
      },
    );

    if (!aiResponse.ok) {
      return errorResponse(
        `AI service request failed: ${await aiResponse.text()}`,
        aiResponse.status,
        corsHeaders,
      );
    }

    const aiData = (await aiResponse.json()) as any;
    const processedContent = aiData?.choices?.[0]?.message?.content || "";

    // 3. Return processed content.
    return jsonResponse(
      {
        status: "SUCCESS",
        processed_content: processedContent,
      },
      200,
      corsHeaders,
    );
  } catch (error) {
    return errorResponse(
      `Internal Server Error: ${error instanceof Error ? error.message : String(error)}`,
      500,
      corsHeaders,
    );
  }
}

function isServiceAuthenticated(request: Request, env: Env): boolean {
  const auth = request.headers.get("Authorization") || "";
  const expected = `Bearer ${env.SERVICE_SECRET}`;
  // Constant-time compare isn't critical here (worker-to-worker secret), but avoid
  // accidental truthy checks.
  return auth === expected;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const origin = request.headers.get("Origin");
    const corsHeaders = buildCorsHeaders(origin);

    // CORS / Origin policy:
    // - Browser callers must include an allowed Origin.
    // - Non-browser/internal callers that do not send Origin are only allowed when
    //   they are explicitly authenticated with SERVICE_SECRET.
    const originAllowed = isOriginAllowed(origin, env);
    if (!originAllowed) {
      if (!origin && isServiceAuthenticated(request, env)) {
        // allow internal call with no Origin
      } else {
        return errorResponse("Origin not allowed", 403, corsHeaders);
      }
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return jsonResponse({ ok: true, service: "ai-proxy" }, 200, corsHeaders);
    }

    // BYOK proxy endpoint used by extension popup/offscreen.
    if (url.pathname === "/api/proxy" || url.pathname === "/byok/proxy") {
      return handleBYOKProxy(request, env, corsHeaders);
    }

    // Credit-service passthrough endpoints.
    // Important: these endpoints are authenticated; the browser/extension
    // must never receive SERVICE_SECRET, so we add it here.
    if (url.pathname === "/user/status" || url.pathname === "/user/create") {
      const incoming = request as any as Request;
      const proxiedHeaders = new Headers(incoming.headers);
      proxiedHeaders.set("Authorization", `Bearer ${env.SERVICE_SECRET}`);

      const response = (await env.CREDIT_SERVICE.fetch(incoming.url, {
        method: incoming.method,
        headers: proxiedHeaders,
        body: incoming.body,
      } as any)) as any as Response;

      // Canonicalize the public network contract for credit status.
      // credit-service may return legacy `{ creditsRemaining }`.
      if (url.pathname === "/user/status") {
        const contentType = response.headers.get("Content-Type") || "";
        if (contentType.includes("application/json")) {
          try {
            const data = (await response.clone().json()) as any;
            if (
              data &&
              typeof data === "object" &&
              typeof data.creditsRemaining === "number" &&
              typeof data.balance !== "number"
            ) {
              const rewritten = {
                ...data,
                balance: data.creditsRemaining,
              };
              return jsonResponse(rewritten, response.status, corsHeaders);
            }
          } catch {
            // If parsing fails, fall back to raw upstream response.
          }
        }
      }

      return withCors(response, corsHeaders);
    }

    // Legacy metered AI endpoint remains available at `/`.
    return handleMeteredAIRequest(request, env, ctx, corsHeaders);
  },
};
