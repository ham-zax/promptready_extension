import { browser } from 'wxt/browser';

let cachedUserId: string | null = null;

/**
 * Stable user identity retrieval with quiet fallbacks and persistence.
 * Strategy:
 * - Prefer previously stored local ID (stable across sessions)
 * - If identity API is available and permitted, use it once and persist
 * - Otherwise generate a UUID, persist, and cache in-memory
 * - No warning logs on fallback to avoid console noise
 */
export async function getUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;

  try {
    // 1) Prefer a persisted ID to avoid repeated API calls and noisy logs
    const stored = await browser.storage.local.get('userId');
    const existing: string | undefined = stored?.userId;
    if (existing && typeof existing === 'string' && existing.length > 0) {
      cachedUserId = existing;
      return existing;
    }

    // 2) Try the browser identity API if present (may require permissions)
    if (browser?.identity?.getProfileUserInfo) {
      try {
        const userInfo = await browser.identity.getProfileUserInfo({ accountStatus: 'ANY' });
        if (userInfo?.id) {
          cachedUserId = userInfo.id;
          // Persist for stability across sessions and contexts
          await browser.storage.local.set({ userId: userInfo.id });
          return userInfo.id;
        }
      } catch {
        // Identity may not be available or permitted; proceed to fallback silently
      }
    }

    // 3) Fallback: generate a stable UUID and persist
    const newId = crypto.randomUUID();
    await browser.storage.local.set({ userId: newId });
    cachedUserId = newId;
    return newId;
  } catch {
    // Last-resort: non-persisted UUID to avoid blocking caller
    const failId = crypto.randomUUID();
    cachedUserId = failId;
    return failId;
  }
}
