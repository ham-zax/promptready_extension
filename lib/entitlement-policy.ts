import type { CreditsState, FeatureFlags, Settings } from './types.js';
import { getRuntimeProfile, type RuntimeProfile } from './runtime-profile.js';

const UNLIMITED_CREDITS = 999999;

const DEFAULT_FLAGS: FeatureFlags = {
  aiModeEnabled: true,
  byokEnabled: true,
  trialEnabled: true,
  developerMode: false,
};

function normalizeFlags(settings: Settings, profile: RuntimeProfile): FeatureFlags {
  const raw = settings.flags || DEFAULT_FLAGS;
  return {
    aiModeEnabled: raw.aiModeEnabled ?? true,
    byokEnabled: raw.byokEnabled ?? true,
    trialEnabled: raw.trialEnabled ?? true,
    developerMode: profile.enforceDeveloperMode ? true : Boolean(raw.developerMode),
  };
}

function normalizeCredits(settings: Settings, forceUnlimited: boolean): CreditsState {
  const fallback: CreditsState = {
    remaining: 0,
    total: 0,
    lastReset: new Date().toISOString(),
  };
  const current = settings.credits || fallback;
  if (!forceUnlimited) return current;
  return {
    ...current,
    remaining: Math.max(current.remaining || 0, UNLIMITED_CREDITS),
    total: Math.max(current.total || 0, UNLIMITED_CREDITS),
    lastReset: current.lastReset || fallback.lastReset,
  };
}

export interface ResolvedEntitlements {
  profile: RuntimeProfile;
  flags: FeatureFlags;
  hasApiKey: boolean;
  credits: CreditsState;
  isPro: boolean;
  isDeveloperMode: boolean;
  hasUnlimitedAccess: boolean;
  shouldFetchRemoteCredits: boolean;
}

export function resolveEntitlements(
  settings: Settings,
  profile: RuntimeProfile = getRuntimeProfile()
): ResolvedEntitlements {
  const flags = normalizeFlags(settings, profile);
  const hasApiKey = Boolean(settings.byok?.apiKey);
  const forceUnlimited =
    profile.openAccessEnabled ||
    profile.premiumBypassEnabled ||
    flags.developerMode ||
    profile.useMockMonetization;
  const credits = normalizeCredits(settings, forceUnlimited);

  const isDeveloperMode = Boolean(flags.developerMode);
  const hasUnlimitedAccess =
    profile.openAccessEnabled ||
    isDeveloperMode ||
    hasApiKey ||
    profile.premiumBypassEnabled ||
    profile.useMockMonetization;
  const isPro = hasUnlimitedAccess || credits.remaining > 0 || Boolean(settings.isPro);
  const shouldFetchRemoteCredits = profile.openAccessEnabled
    ? false
    : !(hasUnlimitedAccess || !settings.user?.id);

  return {
    profile,
    flags,
    hasApiKey,
    credits,
    isPro,
    isDeveloperMode,
    hasUnlimitedAccess,
    shouldFetchRemoteCredits,
  };
}
