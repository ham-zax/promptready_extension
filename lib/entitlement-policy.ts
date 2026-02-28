import type { ByokUsageState, FeatureFlags, Settings } from './types.js';
import { getRuntimeProfile, type RuntimeProfile } from './runtime-profile.js';

export const FREE_BYOK_DAILY_LIMIT = 5;
export const BYOK_STALE_INFLIGHT_TIMEOUT_MS = 10 * 60 * 1000;

const DEFAULT_FLAGS: FeatureFlags = {
  aiModeEnabled: true,
  byokEnabled: true,
  trialEnabled: true,
  developerMode: false,
};

export type AILockReason =
  | 'ai_mode_disabled'
  | 'missing_api_key'
  | 'daily_limit_reached'
  | null;

function toLocalDayKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeFlags(settings: Settings, profile: RuntimeProfile): FeatureFlags {
  const raw = settings.flags || DEFAULT_FLAGS;
  return {
    aiModeEnabled: raw.aiModeEnabled ?? true,
    byokEnabled: raw.byokEnabled ?? true,
    trialEnabled: raw.trialEnabled ?? true,
    developerMode: profile.enforceDeveloperMode ? true : Boolean(raw.developerMode),
  };
}

function normalizeByokUsage(
  usage: Settings['byokUsage'] | undefined,
  now: Date = new Date()
): ByokUsageState {
  const currentDayKey = toLocalDayKey(now);
  const source = usage || {
    dayKey: currentDayKey,
    successfulAiCount: 0,
    inflightRuns: {},
    countedSuccessIds: [],
  };

  if (source.dayKey !== currentDayKey) {
    return {
      dayKey: currentDayKey,
      successfulAiCount: 0,
      inflightRuns: {},
      countedSuccessIds: [],
    };
  }

  const nowMs = now.getTime();
  const inflightRuns: ByokUsageState['inflightRuns'] = {};

  for (const [runId, raw] of Object.entries(source.inflightRuns || {})) {
    if (!runId || !runId.trim()) {
      continue;
    }

    const startedAt = typeof raw?.startedAt === 'number' ? Math.trunc(raw.startedAt) : 0;
    const runDayKey = typeof raw?.dayKey === 'string' ? raw.dayKey : currentDayKey;

    if (startedAt <= 0) {
      continue;
    }

    if (runDayKey !== currentDayKey) {
      continue;
    }

    if (nowMs - startedAt > BYOK_STALE_INFLIGHT_TIMEOUT_MS) {
      continue;
    }

    inflightRuns[runId] = {
      startedAt,
      dayKey: runDayKey,
    };
  }

  return {
    dayKey: currentDayKey,
    successfulAiCount:
      typeof source.successfulAiCount === 'number' && Number.isFinite(source.successfulAiCount)
        ? Math.max(0, Math.trunc(source.successfulAiCount))
        : 0,
    inflightRuns,
    countedSuccessIds: Array.isArray(source.countedSuccessIds)
      ? source.countedSuccessIds
          .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
          .map((id) => id.trim())
      : [],
  };
}

export interface ResolvedEntitlements {
  profile: RuntimeProfile;
  flags: FeatureFlags;
  usageDayKey: string;
  hasApiKey: boolean;
  isUnlocked: boolean;
  isDeveloperMode: boolean;
  hasUnlimitedAccess: boolean;
  successfulAiCountToday: number;
  inflightAiCount: number;
  remainingFreeByokUsesToday: number;
  remainingFreeByokStartsToday: number;
  canUseAIMode: boolean;
  aiLockReason: AILockReason;
}

export function resolveEntitlements(
  settings: Settings,
  profile: RuntimeProfile = getRuntimeProfile()
): ResolvedEntitlements {
  const flags = normalizeFlags(settings, profile);
  const usage = normalizeByokUsage(settings.byokUsage);
  const hasApiKey = Boolean(settings.byok?.apiKey?.trim());
  const isUnlocked = Boolean(settings.byokUnlock?.isUnlocked);
  const isDeveloperMode = Boolean(flags.developerMode);
  const hasUnlimitedAccess =
    profile.openAccessEnabled ||
    profile.premiumBypassEnabled ||
    profile.useMockMonetization ||
    isDeveloperMode ||
    isUnlocked;

  const successfulAiCountToday = Math.max(0, usage.successfulAiCount || 0);
  const inflightAiCount = Object.keys(usage.inflightRuns || {}).length;

  const remainingFreeByokUsesToday = Math.max(
    0,
    FREE_BYOK_DAILY_LIMIT - successfulAiCountToday
  );
  const remainingFreeByokStartsToday = Math.max(
    0,
    FREE_BYOK_DAILY_LIMIT - (successfulAiCountToday + inflightAiCount)
  );

  let canUseAIMode = true;
  let aiLockReason: AILockReason = null;

  if (!flags.aiModeEnabled && !isDeveloperMode) {
    canUseAIMode = false;
    aiLockReason = 'ai_mode_disabled';
  } else if (hasUnlimitedAccess) {
    canUseAIMode = true;
    aiLockReason = null;
  } else if (!hasApiKey) {
    canUseAIMode = false;
    aiLockReason = 'missing_api_key';
  } else if (remainingFreeByokStartsToday <= 0) {
    canUseAIMode = false;
    aiLockReason = 'daily_limit_reached';
  }

  return {
    profile,
    flags,
    usageDayKey: usage.dayKey,
    hasApiKey,
    isUnlocked,
    isDeveloperMode,
    hasUnlimitedAccess,
    successfulAiCountToday,
    inflightAiCount,
    remainingFreeByokUsesToday,
    remainingFreeByokStartsToday,
    canUseAIMode,
    aiLockReason,
  };
}
