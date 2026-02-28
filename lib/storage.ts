// Storage utilities with AES-GCM encryption for sensitive data
// Based on Architecture Section 8 (Security & Privacy)

import { browser } from 'wxt/browser';
import { CapturePolicy, Settings, TelemetryEvent } from './types.js';
import { getRuntimeProfile, type RuntimeProfile } from './runtime-profile.js';
import { DEFAULT_EXTRACTION_TUNING, normalizeExtractionTuning } from '../core/domain/extraction/policies.js';
import { normalizeByokProvider } from './byok-provider.js';

// =============================================================================
// Storage Keys
// =============================================================================

const STORAGE_KEYS = {
  SETTINGS: 'promptready_settings',
  ENCRYPTED_KEYS: 'promptready_encrypted_keys',
  TELEMETRY: 'promptready_telemetry',
} as const;

const LEGACY_MONETIZATION_KEYS = [
  'isPro',
  'credits',
  'trial',
] as const;

// =============================================================================
// Default Settings
// =============================================================================

const runtimeProfile = getRuntimeProfile();

const SETTINGS_SCHEMA_VERSION = 2;
const UNLOCK_SCHEME_VERSION = 1;

function toLocalDayKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const DEFAULT_CAPTURE_POLICY: CapturePolicy = {
  settleTimeoutMs: 600,
  quietWindowMs: 150,
  deepCaptureEnabled: false,
  maxScrollSteps: 5,
  maxScrollDurationMs: 3000,
  scrollStepDelayMs: 180,
  minTextGainRatio: 0.2,
  minHeadingGain: 2,
};

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

function normalizeCapturePolicy(policy: unknown): CapturePolicy {
  const source = (policy && typeof policy === 'object') ? (policy as Partial<CapturePolicy>) : {};
  return {
    settleTimeoutMs: clampNumber(source.settleTimeoutMs, 0, 10_000, DEFAULT_CAPTURE_POLICY.settleTimeoutMs),
    quietWindowMs: clampNumber(source.quietWindowMs, 50, 2_000, DEFAULT_CAPTURE_POLICY.quietWindowMs),
    deepCaptureEnabled:
      typeof source.deepCaptureEnabled === 'boolean' ? source.deepCaptureEnabled : DEFAULT_CAPTURE_POLICY.deepCaptureEnabled,
    maxScrollSteps: Math.floor(clampNumber(source.maxScrollSteps, 0, 20, DEFAULT_CAPTURE_POLICY.maxScrollSteps)),
    maxScrollDurationMs: clampNumber(
      source.maxScrollDurationMs,
      200,
      10_000,
      DEFAULT_CAPTURE_POLICY.maxScrollDurationMs
    ),
    scrollStepDelayMs: clampNumber(source.scrollStepDelayMs, 0, 1_000, DEFAULT_CAPTURE_POLICY.scrollStepDelayMs),
    minTextGainRatio: clampNumber(source.minTextGainRatio, 0, 2, DEFAULT_CAPTURE_POLICY.minTextGainRatio),
    minHeadingGain: Math.floor(clampNumber(source.minHeadingGain, 0, 20, DEFAULT_CAPTURE_POLICY.minHeadingGain)),
  };
}

function defaultByokUnlockState(): NonNullable<Settings['byokUnlock']> {
  return {
    isUnlocked: false,
    unlockCodeLast4: null,
    unlockedAt: null,
    unlockSchemeVersion: UNLOCK_SCHEME_VERSION,
  };
}

function defaultByokUsageState(dayKey: string = toLocalDayKey()): NonNullable<Settings['byokUsage']> {
  return {
    dayKey,
    successfulAiCount: 0,
    inflightRuns: {},
    countedSuccessIds: [],
  };
}

function normalizeByokSettings(byok: unknown): Settings['byok'] {
  const source = (byok && typeof byok === 'object') ? (byok as Partial<Settings['byok']>) : {};
  const providerNormalization = normalizeByokProvider(source.provider);
  const selectedByokModel =
    source.selectedByokModel ||
    source.model ||
    DEFAULT_SETTINGS.byok.selectedByokModel;

  const customPrompt = typeof source.customPrompt === 'string' ? source.customPrompt : '';

  return {
    ...DEFAULT_SETTINGS.byok,
    ...source,
    provider: providerNormalization.canonicalProvider,
    model: source.model || selectedByokModel,
    selectedByokModel,
    customPrompt,
  };
}

function normalizeByokUnlockState(unlock: unknown): NonNullable<Settings['byokUnlock']> {
  const source = (unlock && typeof unlock === 'object') ? (unlock as Partial<NonNullable<Settings['byokUnlock']>>) : {};
  const isUnlocked = Boolean(source.isUnlocked);
  const unlockCodeLast4 =
    typeof source.unlockCodeLast4 === 'string' && source.unlockCodeLast4.trim().length > 0
      ? source.unlockCodeLast4.trim().slice(-4)
      : null;
  const unlockedAt =
    typeof source.unlockedAt === 'string' && source.unlockedAt.trim().length > 0
      ? source.unlockedAt
      : null;
  const unlockSchemeVersion =
    typeof source.unlockSchemeVersion === 'number' && Number.isFinite(source.unlockSchemeVersion)
      ? Math.max(1, Math.trunc(source.unlockSchemeVersion))
      : UNLOCK_SCHEME_VERSION;

  if (!isUnlocked) {
    return {
      ...defaultByokUnlockState(),
      unlockSchemeVersion,
    };
  }

  return {
    isUnlocked,
    unlockCodeLast4,
    unlockedAt,
    unlockSchemeVersion,
  };
}

const COUNTED_SUCCESS_RING_SIZE = 20;
const STALE_INFLIGHT_TIMEOUT_MS = 10 * 60 * 1000;

function normalizeByokUsageState(usage: unknown, now: Date = new Date()): NonNullable<Settings['byokUsage']> {
  const currentDayKey = toLocalDayKey(now);
  const source = (usage && typeof usage === 'object') ? (usage as Partial<NonNullable<Settings['byokUsage']>>) : {};

  const sourceDayKey = typeof source.dayKey === 'string' && source.dayKey.trim().length > 0
    ? source.dayKey
    : currentDayKey;

  // Day bucket normalization MUST happen before gate checks. When day changes,
  // all per-day counters/ring buffers reset deterministically.
  if (sourceDayKey !== currentDayKey) {
    return defaultByokUsageState(currentDayKey);
  }

  const successfulAiCount =
    typeof source.successfulAiCount === 'number' && Number.isFinite(source.successfulAiCount)
      ? Math.max(0, Math.trunc(source.successfulAiCount))
      : 0;

  const nowMs = now.getTime();
  const inflightRunsRaw = (source.inflightRuns && typeof source.inflightRuns === 'object')
    ? source.inflightRuns
    : {};
  const inflightRuns: NonNullable<Settings['byokUsage']>['inflightRuns'] = {};

  for (const [runId, raw] of Object.entries(inflightRunsRaw)) {
    if (!runId || !runId.trim()) continue;

    let startedAt: number | null = null;
    let runDayKey = currentDayKey;

    if (typeof raw === 'number' && Number.isFinite(raw)) {
      // Backward compatibility for transient legacy shape: runId -> startedAt
      startedAt = Math.trunc(raw);
    } else if (raw && typeof raw === 'object') {
      const entry = raw as { startedAt?: unknown; dayKey?: unknown };
      if (typeof entry.startedAt === 'number' && Number.isFinite(entry.startedAt)) {
        startedAt = Math.trunc(entry.startedAt);
      }
      if (typeof entry.dayKey === 'string' && entry.dayKey.trim()) {
        runDayKey = entry.dayKey;
      }
    }

    if (startedAt === null || startedAt <= 0) continue;
    if (runDayKey !== currentDayKey) continue;
    if (nowMs - startedAt > STALE_INFLIGHT_TIMEOUT_MS) continue;

    inflightRuns[runId] = {
      startedAt,
      dayKey: runDayKey,
    };
  }

  const countedSuccessIds = Array.isArray(source.countedSuccessIds)
    ? source.countedSuccessIds
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => value.trim())
      .slice(-COUNTED_SUCCESS_RING_SIZE)
    : [];

  return {
    dayKey: currentDayKey,
    successfulAiCount,
    inflightRuns,
    countedSuccessIds,
  };
}

const DEFAULT_SETTINGS: Settings = {
  settingsSchemaVersion: SETTINGS_SCHEMA_VERSION,
  mode: 'offline',
  theme: 'system',
  templates: {
    bundles: [],
  },
  byok: {
    provider: 'openrouter',
    apiBase: 'https://openrouter.ai/api/v1',
    apiKey: '', // No demo key by default; users can add BYOK
    model: 'arcee-ai/trinity-large-preview:free',
    selectedByokModel: 'arcee-ai/trinity-large-preview:free',
    customPrompt: '',
  },
  byokUnlock: defaultByokUnlockState(),
  byokUsage: defaultByokUsageState(),
  privacy: {
    telemetryEnabled: false,
  },
  // Legacy fields intentionally omitted from defaults (purge-on-read model).
  renderer: 'turndown',
  useReadability: true,
  processing: {
    profile: 'standard',
    readabilityPreset: 'standard',
    turndownPreset: 'standard',
    extractionTuning: { ...DEFAULT_EXTRACTION_TUNING },
    capturePolicy: { ...DEFAULT_CAPTURE_POLICY },
    customOptions: {
      preserveCodeBlocks: true,
      includeImages: true,
      preserveTables: true,
      preserveLinks: true,
    },
  },
  flags: {
    aiModeEnabled: true,   // AI mode can be enabled when credits/BYOK or DEV
    byokEnabled: true,
    trialEnabled: true,
    developerMode: runtimeProfile.enforceDeveloperMode,
  },
  ui: {
    theme: 'auto',
    animations: true,
    compactMode: false,
    keepPopupOpen: true,  // Keep popup open by default
    autoCloseDelay: 3000, // 3 seconds delay
  },
};

export function applyRuntimePolicyOverrides(
  settings: Settings,
  profile: RuntimeProfile,
  defaultSettings: Settings = DEFAULT_SETTINGS
): Settings {
  if (!profile.openAccessEnabled && !profile.premiumBypassEnabled && !profile.enforceDeveloperMode) {
    return settings;
  }

  const flags = settings.flags || defaultSettings.flags!;

  return {
    ...settings,
    // Preserve explicit user choice; open-access should unlock modes, not force a mode.
    mode: settings.mode || defaultSettings.mode,
    flags: {
      ...flags,
      aiModeEnabled: true,
      byokEnabled: true,
      trialEnabled: true,
      developerMode: profile.enforceDeveloperMode ? true : Boolean(flags.developerMode),
    },
    byokUnlock: settings.byokUnlock || defaultByokUnlockState(),
    byokUsage: settings.byokUsage || defaultByokUsageState(),
  };
}

// =============================================================================
// Storage Interface
// =============================================================================

export class Storage {
  private static applyRuntimeOverrides(settings: Settings): Settings {
    const profile = getRuntimeProfile();
    return applyRuntimePolicyOverrides(settings, profile, DEFAULT_SETTINGS);
  }

  // ---------------------------------------------------------------------------
  // Settings Management
  // ---------------------------------------------------------------------------

  static async getSettings(): Promise<Settings> {
    try {
      // Check if browser APIs are available
      if (typeof browser === 'undefined' || !browser.storage || !browser.storage.local) {
        console.warn('[Storage] Browser storage not available, using defaults');
        return { ...DEFAULT_SETTINGS };
      }

      const result = (await browser.storage.local.get([STORAGE_KEYS.SETTINGS])) as Record<string, unknown>;
      const storedRaw = result[STORAGE_KEYS.SETTINGS];

      if (!storedRaw || typeof storedRaw !== 'object') {
        const newSettings: Settings = {
          ...DEFAULT_SETTINGS,
          settingsSchemaVersion: SETTINGS_SCHEMA_VERSION,
          user: {
            id: `anon_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
          },
          byokUnlock: defaultByokUnlockState(),
          byokUsage: defaultByokUsageState(),
        };

        await browser.storage.local.set({
          [STORAGE_KEYS.SETTINGS]: newSettings,
        });

        return this.applyRuntimeOverrides(newSettings);
      }

      const storedObject = storedRaw as Record<string, unknown>;
      const stored = storedObject as Partial<Settings>;
      const rawSchemaVersion =
        typeof stored.settingsSchemaVersion === 'number' && Number.isFinite(stored.settingsSchemaVersion)
          ? Math.trunc(stored.settingsSchemaVersion)
          : 0;
      const requiresSchemaUpgrade = rawSchemaVersion < SETTINGS_SCHEMA_VERSION;

      // Migrate legacy mode values
      const rawMode = (stored as any).mode;
      const migratedMode: Settings['mode'] = rawMode === 'ai' ? 'ai' : 'offline';

      const settings: Settings = {
        ...DEFAULT_SETTINGS,
        ...stored,
        mode: migratedMode,
        settingsSchemaVersion: SETTINGS_SCHEMA_VERSION,
      };

      settings.processing = {
        ...DEFAULT_SETTINGS.processing,
        ...(settings.processing || {}),
        profile: (settings.processing && settings.processing.profile) || DEFAULT_SETTINGS.processing!.profile,
        readabilityPreset:
          (settings.processing && settings.processing.readabilityPreset) || DEFAULT_SETTINGS.processing!.readabilityPreset,
        turndownPreset:
          (settings.processing && settings.processing.turndownPreset) || DEFAULT_SETTINGS.processing!.turndownPreset,
        extractionTuning: normalizeExtractionTuning((settings.processing as any)?.extractionTuning),
        capturePolicy: normalizeCapturePolicy((settings.processing as any)?.capturePolicy),
        customOptions: {
          ...DEFAULT_SETTINGS.processing!.customOptions,
          ...((settings.processing && settings.processing.customOptions) || {}),
        },
      };

      const userIdMissing = !settings.user || !settings.user.id;
      if (userIdMissing) {
        if (!settings.user) settings.user = {};
        settings.user.id = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      }

      // Canonicalize BYOK provider/model for OpenRouter-only workflow.
      const beforeByok = settings.byok;
      settings.byok = normalizeByokSettings(settings.byok);
      const providerMigrated =
        (beforeByok?.provider || 'openrouter') !== settings.byok.provider;
      const selectedModelMigrated =
        (beforeByok?.selectedByokModel || beforeByok?.model || DEFAULT_SETTINGS.byok.selectedByokModel) !==
        settings.byok.selectedByokModel;

      const normalizedByokUnlock = normalizeByokUnlockState(stored.byokUnlock);
      const normalizedByokUsage = normalizeByokUsageState(stored.byokUsage);
      settings.byokUnlock = normalizedByokUnlock;
      settings.byokUsage = normalizedByokUsage;

      // Purge legacy monetization fields from settings (purge-on-read policy)
      const hadLegacyMonetizationFields = LEGACY_MONETIZATION_KEYS.some((key) => key in storedObject);
      for (const key of LEGACY_MONETIZATION_KEYS) {
        delete (settings as unknown as Record<string, unknown>)[key];
      }

      const byokUnlockChanged = JSON.stringify(stored.byokUnlock || {}) !== JSON.stringify(normalizedByokUnlock);
      const byokUsageChanged = JSON.stringify(stored.byokUsage || {}) !== JSON.stringify(normalizedByokUsage);

      // Save migrated/sanitized settings when schema or normalization changes are detected.
      if (
        requiresSchemaUpgrade ||
        rawMode !== migratedMode ||
        providerMigrated ||
        selectedModelMigrated ||
        userIdMissing ||
        hadLegacyMonetizationFields ||
        byokUnlockChanged ||
        byokUsageChanged
      ) {
        await browser.storage.local.set({
          [STORAGE_KEYS.SETTINGS]: settings,
        });
      }

      return this.applyRuntimeOverrides(settings);
    } catch (error) {
      console.error('Failed to load settings:', error);
      return this.applyRuntimeOverrides(DEFAULT_SETTINGS);
    }
  }

  static async updateSettings(updates: Partial<Settings>): Promise<void> {
    try {
      // Check if browser APIs are available
      if (typeof browser === 'undefined' || !browser.storage || !browser.storage.local) {
        console.warn('[Storage] Browser storage not available, ignoring updates');
        return;
      }

      const currentSettings = await this.getSettings();
      // Deep-merge for nested objects we manage (byok, privacy, templates)
      const { byok, byokUnlock, byokUsage, privacy, templates, user, processing, ...rest } = (updates || {}) as any;
      const nextByok = normalizeByokSettings({
        ...currentSettings.byok,
        ...(byok || {}),
      });
      const nextByokUnlock = normalizeByokUnlockState({
        ...(currentSettings.byokUnlock || defaultByokUnlockState()),
        ...(byokUnlock || {}),
      });
      const nextByokUsage = normalizeByokUsageState({
        ...(currentSettings.byokUsage || defaultByokUsageState()),
        ...(byokUsage || {}),
      });

      const newSettings: Settings = {
        ...currentSettings,
        ...rest,
        settingsSchemaVersion: SETTINGS_SCHEMA_VERSION,
        byok: nextByok,
        byokUnlock: nextByokUnlock,
        byokUsage: nextByokUsage,
        privacy: {
          ...currentSettings.privacy,
          ...(privacy || {})
        },
        templates: {
          ...currentSettings.templates,
          ...(templates || {})
        },
        user: {
          ...currentSettings.user,
          ...(user || {})
        },
        processing: {
          ...currentSettings.processing,
          ...(processing || {}),
          profile: (processing && processing.profile) || currentSettings.processing!.profile,
          readabilityPreset:
            (processing && processing.readabilityPreset) || currentSettings.processing!.readabilityPreset,
          turndownPreset:
            (processing && processing.turndownPreset) || currentSettings.processing!.turndownPreset,
          extractionTuning: normalizeExtractionTuning((processing || {}).extractionTuning ?? currentSettings.processing?.extractionTuning),
          capturePolicy: normalizeCapturePolicy((processing || {}).capturePolicy ?? currentSettings.processing?.capturePolicy),
          customOptions: {
            ...(currentSettings.processing?.customOptions || DEFAULT_SETTINGS.processing!.customOptions),
            ...((processing && processing.customOptions) || {}),
          },
        },
      };

      for (const key of LEGACY_MONETIZATION_KEYS) {
        delete (newSettings as unknown as Record<string, unknown>)[key];
      }

      await browser.storage.local.set({
        [STORAGE_KEYS.SETTINGS]: newSettings,
      });
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------\
  // API Key Management (plain storage)
  // ---------------------------------------------------------------------------

  static async setApiKey(apiKey: string): Promise<void> {
    try {
      const current = await this.getSettings();
      const byok = {
        ...current.byok,
        apiKey: apiKey || '',
        selectedByokModel:
          current.byok?.selectedByokModel || current.byok?.model || DEFAULT_SETTINGS.byok.selectedByokModel,
      } as Settings['byok'];
      const nextSettings: Settings = {
        ...current,
        settingsSchemaVersion: SETTINGS_SCHEMA_VERSION,
        byok,
        byokUnlock: current.byokUnlock || defaultByokUnlockState(),
        byokUsage: normalizeByokUsageState(current.byokUsage),
      };

      for (const key of LEGACY_MONETIZATION_KEYS) {
        delete (nextSettings as unknown as Record<string, unknown>)[key];
      }

      await browser.storage.local.set({
        [STORAGE_KEYS.SETTINGS]: nextSettings,
      });
      // Cleanup any legacy encrypted key artifacts
      await browser.storage.local.remove([STORAGE_KEYS.ENCRYPTED_KEYS]);
      await browser.storage.session.remove(['passphrase']);
    } catch (error) {
      console.error('Failed to save API key:', error);
      throw error;
    }
  }

  static async getApiKey(): Promise<string | null> {
    try {
      const settings = await this.getSettings();
      const key = settings.byok.apiKey || '';
      return key ? key : null;
    } catch (error) {
      console.error('Failed to read API key:', error);
      return null;
    }
  }

  static async clearApiKey(): Promise<void> {
    try {
      const current = await this.getSettings();
      const byok = {
        ...current.byok,
        apiKey: '',
        selectedByokModel:
          current.byok?.selectedByokModel || current.byok?.model || DEFAULT_SETTINGS.byok.selectedByokModel,
      } as Settings['byok'];
      const nextSettings: Settings = {
        ...current,
        settingsSchemaVersion: SETTINGS_SCHEMA_VERSION,
        byok,
        byokUnlock: current.byokUnlock || defaultByokUnlockState(),
        byokUsage: normalizeByokUsageState(current.byokUsage),
      };

      for (const key of LEGACY_MONETIZATION_KEYS) {
        delete (nextSettings as unknown as Record<string, unknown>)[key];
      }

      await browser.storage.local.set({
        [STORAGE_KEYS.SETTINGS]: nextSettings,
      });
      // Also remove any legacy encrypted state
      await browser.storage.local.remove([STORAGE_KEYS.ENCRYPTED_KEYS]);
      await browser.storage.session.remove(['passphrase']);
    } catch (error) {
      console.error('Failed to clear API key:', error);
      throw error;
    }
  }

  // Backwards-compat wrappers (no-op encryption)
  static async setEncryptedApiKey(apiKey: string, _passphrase: string): Promise<void> {
    return this.setApiKey(apiKey);
  }

  // No longer used; ensure no session passphrase remains
  static async setSessionPassphrase(_passphrase: string): Promise<void> {
    try {
      await browser.storage.session.remove(['passphrase']);
    } catch (error) {
      console.error('Failed to clear session passphrase:', error);
      throw error;
    }
  }

  static async getDecryptedApiKey(): Promise<string | null> {
    return this.getApiKey();
  }

  static async clearEncryptedApiKey(): Promise<void> {
    return this.clearApiKey();
  }

  // ---------------------------------------------------------------------------
  // Telemetry Management (opt-in)
  // ---------------------------------------------------------------------------

  static async recordTelemetry(event: TelemetryEvent): Promise<void> {
    try {
      const settings = await this.getSettings();
      if (!settings.privacy.telemetryEnabled) {
        return; // Telemetry disabled
      }

      const result = (await browser.storage.local.get([STORAGE_KEYS.TELEMETRY])) as Record<string, unknown>;
      const raw = result[STORAGE_KEYS.TELEMETRY];
      const existing = Array.isArray(raw) ? (raw as TelemetryEvent[]) : [];

      // Keep only last 1000 events to prevent storage bloat
      const trimmedEvents = [...existing, event].slice(-1000);
      await browser.storage.local.set(
        {
          [STORAGE_KEYS.TELEMETRY]: trimmedEvents,
        }
      );

    } catch (error) {
      console.error('Failed to record telemetry:', error);
      // Don't throw - telemetry failures shouldn't break functionality
    }
  }

  static async getTelemetryEvents(): Promise<TelemetryEvent[]> {
    try {
      const result = (await browser.storage.local.get([STORAGE_KEYS.TELEMETRY])) as Record<string, unknown>;
      const raw = result[STORAGE_KEYS.TELEMETRY];
      return Array.isArray(raw) ? (raw as TelemetryEvent[]) : [];
    } catch (error) {
      console.error('Failed to get telemetry events:', error);
      return [];
    }
  }

  static async clearTelemetry(): Promise<void> {
    try {
      await browser.storage.local.remove([STORAGE_KEYS.TELEMETRY]);
    } catch (error) {
      console.error('Failed to clear telemetry:', error);
      throw error;
    }
  }
}
