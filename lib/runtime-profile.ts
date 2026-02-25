export interface RuntimeProfile {
  isDevelopment: boolean;
  openAccessEnabled: boolean;
  premiumBypassEnabled: boolean;
  enforceDeveloperMode: boolean;
  useMockMonetization: boolean;
  monetizationApiBase: string;
  byokProxyUrl: string;
  trafilaturaServiceUrl: string;
}

export interface RuntimeProfileValidationResult {
  profile: RuntimeProfile;
  errors: string[];
  warnings: string[];
}

const DEV_DEFAULT_MONETIZATION_BASE = 'http://127.0.0.1:8788';
const DEV_DEFAULT_BYOK_PROXY = 'http://127.0.0.1:8788/byok/proxy';
const DEV_DEFAULT_TRAFILATURA_URL = 'http://127.0.0.1:8089';
const PROD_DEFAULT_MONETIZATION_BASE = 'https://promptready.app';
const PROD_DEFAULT_BYOK_PROXY = 'https://promptready.app/api/proxy';
const PROD_DEFAULT_TRAFILATURA_URL = '';

function readMetaEnv(name: string): string | undefined {
  try {
    const env = (import.meta as any)?.env;
    const value = env?.[name];
    return typeof value === 'string' ? value : undefined;
  } catch {
    return undefined;
  }
}

function readBoolean(name: string): boolean | undefined {
  const raw = readMetaEnv(name)?.trim().toLowerCase();
  if (!raw) return undefined;
  if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
  if (['0', 'false', 'no', 'off'].includes(raw)) return false;
  return undefined;
}

function readString(name: string): string | undefined {
  const value = readMetaEnv(name)?.trim();
  return value ? value : undefined;
}

let cachedProfile: RuntimeProfile | null = null;

function isLocalTarget(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname.endsWith('.local')
    );
  } catch {
    return false;
  }
}

export function getRuntimeProfile(): RuntimeProfile {
  if (cachedProfile) return cachedProfile;

  const isDevelopment = Boolean((import.meta as any)?.env?.DEV);

  const openAccessEnabled = readBoolean('WXT_DEV_OPEN_ACCESS') ?? isDevelopment;
  const premiumBypassEnabled = readBoolean('WXT_DEV_FORCE_PREMIUM') ?? isDevelopment;
  const enforceDeveloperMode = readBoolean('WXT_DEV_FORCE_DEVELOPER_MODE') ?? isDevelopment;
  const useMockMonetization = readBoolean('WXT_USE_MOCK_MONETIZATION') ?? isDevelopment;

  const monetizationApiBase =
    readString('WXT_MONETIZATION_API_BASE') ??
    (isDevelopment ? DEV_DEFAULT_MONETIZATION_BASE : PROD_DEFAULT_MONETIZATION_BASE);

  const byokProxyUrl =
    readString('WXT_BYOK_PROXY_URL') ??
    (isDevelopment ? DEV_DEFAULT_BYOK_PROXY : PROD_DEFAULT_BYOK_PROXY);

  const trafilaturaServiceUrl =
    readString('WXT_TRAFILATURA_URL') ??
    (isDevelopment ? DEV_DEFAULT_TRAFILATURA_URL : PROD_DEFAULT_TRAFILATURA_URL);

  cachedProfile = {
    isDevelopment,
    openAccessEnabled,
    premiumBypassEnabled,
    enforceDeveloperMode,
    useMockMonetization,
    monetizationApiBase,
    byokProxyUrl,
    trafilaturaServiceUrl,
  };

  return cachedProfile;
}

export function validateRuntimeProfile(
  profile: RuntimeProfile = getRuntimeProfile()
): RuntimeProfileValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!profile.isDevelopment) {
    if (profile.openAccessEnabled) {
      errors.push('openAccessEnabled must be false outside development');
    }
    if (profile.premiumBypassEnabled) {
      errors.push('premiumBypassEnabled must be false outside development');
    }
    if (profile.enforceDeveloperMode) {
      errors.push('enforceDeveloperMode must be false outside development');
    }
    if (profile.useMockMonetization) {
      errors.push('useMockMonetization must be false outside development');
    }
    if (isLocalTarget(profile.monetizationApiBase)) {
      errors.push('monetizationApiBase cannot target localhost outside development');
    }
    if (isLocalTarget(profile.byokProxyUrl)) {
      errors.push('byokProxyUrl cannot target localhost outside development');
    }
    if (profile.trafilaturaServiceUrl && isLocalTarget(profile.trafilaturaServiceUrl)) {
      errors.push('trafilaturaServiceUrl cannot target localhost outside development');
    }
  } else {
    if (!profile.openAccessEnabled) {
      warnings.push('openAccessEnabled is off in development; premium flows may require real credits');
    }
    if (!profile.premiumBypassEnabled) {
      warnings.push('premiumBypassEnabled is off in development; premium UX may be gated');
    }
    if (!profile.enforceDeveloperMode) {
      warnings.push('enforceDeveloperMode is off in development; AI mode may remain gated');
    }
    if (!profile.trafilaturaServiceUrl) {
      warnings.push('trafilaturaServiceUrl is empty in development; local extraction fallback will be unavailable');
    }
  }

  return { profile, errors, warnings };
}

export function assertRuntimeProfileSafe(profile: RuntimeProfile = getRuntimeProfile()): void {
  const result = validateRuntimeProfile(profile);
  if (result.errors.length > 0) {
    throw new Error(`[RuntimeProfile] Invalid configuration: ${result.errors.join('; ')}`);
  }
}
