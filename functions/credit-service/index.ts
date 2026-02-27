/// <reference types="@cloudflare/workers-types" />

export interface Env {
  CREDITS_KV: KVNamespace;
  SERVICE_SECRET: string; // Added for inter-service authentication
}

interface UserRequest {
  userId: string;
}

interface CreateUserRequest {
  userId: string;
}

function isValidUserId(userId: string): boolean {
  const trimmed = userId.trim();
  const uuidV4 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const chromeIdentity = /^[0-9]{6,32}$/;
  const prefixed = /^pr_[a-z0-9_-]{16,128}$/i;
  return uuidV4.test(trimmed) || chromeIdentity.test(trimmed) || prefixed.test(trimmed);
}

// Canonical credit status response schema (used by ai-proxy + UI).
// Keep it minimal and stable.
export interface CreditStatusResponse {
  userId: string;
  balance: number;
  weeklyCap?: number;
}

export interface CreditErrorResponse {
  error:
    | "USER_NOT_FOUND"
    | "INSUFFICIENT_CREDITS"
    | "UNAUTHORIZED"
    | "INVALID_REQUEST";
}

interface DecrementRequest {
  userId: string;
  amount?: number;
  idempotencyKey?: string;
}

// A simple router to handle different paths
const router = {
  "/user/status": handleUserStatus,
  "/user/create": handleUserCreate,
  "/credits/decrement": handleDecrement,
};

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    const handler = router[url.pathname as keyof typeof router];

    if (handler) {
      return handler(request, env);
    }

    return new Response("Not Found", { status: 404 });
  },
};

function requireServiceAuth(request: Request, env: Env): Response | null {
  const expectedToken = env.SERVICE_SECRET;
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

async function handleUserStatus(request: Request, env: Env): Promise<Response> {
  // This endpoint must not be public: otherwise anyone can probe balances.
  const unauthorized = requireServiceAuth(request, env);
  if (unauthorized) return unauthorized;

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { userId } = (await request.json()) as UserRequest;
    if (!userId) {
      return new Response("User ID is required", { status: 400 });
    }
    if (!isValidUserId(userId)) {
      return new Response("Invalid userId", { status: 400 });
    }

    const userCredits = await env.CREDITS_KV.get(userId);

    if (userCredits === null) {
      // Do not auto-provision credits here. User creation / initial credit grant
      // must be performed by an explicit, authenticated flow.
      return new Response(
        JSON.stringify({
          error: "USER_NOT_FOUND",
        } satisfies CreditErrorResponse),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        userId,
        balance: parseInt(userCredits, 10),
      } satisfies CreditStatusResponse),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in handleUserStatus:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

async function handleUserCreate(request: Request, env: Env): Promise<Response> {
  const unauthorized = requireServiceAuth(request, env);
  if (unauthorized) return unauthorized;

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { userId } = (await request.json()) as CreateUserRequest;
    if (!userId) {
      return new Response("User ID is required", { status: 400 });
    }
    if (!isValidUserId(userId)) {
      return new Response("Invalid userId", { status: 400 });
    }

    const existing = await env.CREDITS_KV.get(userId);
    if (existing !== null) {
      return new Response(
        JSON.stringify({
          userId,
          balance: parseInt(existing, 10),
        } satisfies CreditStatusResponse),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const initialCredits = 150;
    await env.CREDITS_KV.put(userId, String(initialCredits));

    return new Response(
      JSON.stringify({
        userId,
        balance: initialCredits,
      } satisfies CreditStatusResponse),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in handleUserCreate:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

async function handleDecrement(request: Request, env: Env): Promise<Response> {
  const unauthorized = requireServiceAuth(request, env);
  if (unauthorized) return unauthorized;

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const {
      userId,
      amount = 1,
      idempotencyKey,
    } = (await request.json()) as DecrementRequest;
    if (!userId) return new Response("User ID is required", { status: 400 });
    if (!isValidUserId(userId)) return new Response("Invalid userId", { status: 400 });

    const decrementBy = Number.isFinite(amount) ? Math.trunc(amount) : 1;
    if (decrementBy <= 0)
      return new Response("amount must be > 0", { status: 400 });

    // KV is not atomic for read-modify-write. To prevent lost updates under
    // concurrency, we serialize decrements per userId using a lightweight
    // best-effort lock in KV.
    const lockKey = `lock:${userId}`;
    const lockId = crypto.randomUUID();
    const lockTtlSeconds = 10;
    const maxWaitMs = 1500;
    const start = Date.now();

    while (true) {
      const currentLock = await env.CREDITS_KV.get(lockKey);
      if (currentLock === null) {
        await env.CREDITS_KV.put(lockKey, lockId, {
          expirationTtl: lockTtlSeconds,
        });
        // Confirm we hold the lock (handles races where two writers put)
        const confirmed = await env.CREDITS_KV.get(lockKey);
        if (confirmed === lockId) break;
      }

      if (Date.now() - start > maxWaitMs) {
        return new Response("Conflict", { status: 409 });
      }
      // Small backoff to reduce thundering herd
      await new Promise((r) => setTimeout(r, 15));
    }

    try {
      // Idempotency: store final creditsRemaining under an idempotency key.
      if (idempotencyKey) {
        const idemKey = `idem:${userId}:${idempotencyKey}`;
        const already = await env.CREDITS_KV.get(idemKey);
        if (already !== null) {
          return new Response(
            JSON.stringify({
              userId,
              balance: parseInt(already, 10),
            } satisfies CreditStatusResponse),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        const newCredits = await decrementLocked(env, userId, decrementBy);
        await env.CREDITS_KV.put(idemKey, String(newCredits), {
          expirationTtl: 60 * 60 * 24,
        });
        return new Response(
          JSON.stringify({
            userId,
            balance: newCredits,
          } satisfies CreditStatusResponse),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const newCredits = await decrementLocked(env, userId, decrementBy);
      return new Response(
        JSON.stringify({
          userId,
          balance: newCredits,
        } satisfies CreditStatusResponse),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (err) {
      const status =
        typeof (err as any)?.status === "number"
          ? (err as any).status
          : undefined;
      if (status) return new Response((err as Error).message, { status });
      throw err;
    } finally {
      // Best-effort unlock: only delete if we still own it.
      const confirmed = await env.CREDITS_KV.get(lockKey);
      if (confirmed === lockId) {
        // Some unit tests use minimal KV mocks without delete().
        await (env.CREDITS_KV as any).delete?.(lockKey);
      }
    }
  } catch (error) {
    console.error("Error in handleDecrement:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

async function decrementLocked(
  env: Env,
  userId: string,
  decrementBy: number,
): Promise<number> {
  const currentCreditsStr = await env.CREDITS_KV.get(userId);
  if (currentCreditsStr === null) {
    const err = new Error("USER_NOT_FOUND");
    // @ts-expect-error annotate
    err.status = 404;
    throw err;
  }

  const currentCredits = parseInt(currentCreditsStr, 10);
  if (!Number.isFinite(currentCredits)) {
    throw new Error("Invalid credit state");
  }
  if (currentCredits < decrementBy) {
    const err = new Error("INSUFFICIENT_CREDITS");
    // @ts-expect-error annotate
    err.status = 402;
    throw err;
  }

  const newCredits = currentCredits - decrementBy;
  await env.CREDITS_KV.put(userId, String(newCredits));
  return newCredits;
}
