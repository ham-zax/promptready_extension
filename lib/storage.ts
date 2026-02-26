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

// =============================================================================
// Default Settings
// =============================================================================

const runtimeProfile = getRuntimeProfile();
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

function normalizeByokSettings(byok: unknown): Settings['byok'] {
  const source = (byok && typeof byok === 'object') ? (byok as Partial<Settings['byok']>) : {};
  const providerNormalization = normalizeByokProvider(source.provider);
  const selectedByokModel =
    source.selectedByokModel ||
    source.model ||
    DEFAULT_SETTINGS.byok.selectedByokModel;

  return {
    ...DEFAULT_SETTINGS.byok,
    ...source,
    provider: providerNormalization.canonicalProvider,
    model: source.model || selectedByokModel,
    selectedByokModel,
  };
}

const DEFAULT_SETTINGS: Settings = {
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
  },
  privacy: {
    telemetryEnabled: false,
  },
  isPro: runtimeProfile.openAccessEnabled || runtimeProfile.premiumBypassEnabled,
  credits: {
    remaining: runtimeProfile.openAccessEnabled || runtimeProfile.premiumBypassEnabled ? 999999 : 10,
    total: runtimeProfile.openAccessEnabled || runtimeProfile.premiumBypassEnabled ? 999999 : 10,
    lastReset: new Date().toISOString(),
  },
  user: {
    id: '', // Anonymous ID will be generated
  },
  trial: {
    hasExhausted: false,
    showUpgradePrompt: false,
  },
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
  const credits = settings.credits || defaultSettings.credits!;

  return {
    ...settings,
    // Preserve explicit user choice; open-access should unlock modes, not force a mode.
    mode: settings.mode || defaultSettings.mode,
    isPro: profile.openAccessEnabled || profile.premiumBypassEnabled ? true : settings.isPro,
    flags: {
      ...flags,
      aiModeEnabled: true,
      byokEnabled: true,
      trialEnabled: true,
      developerMode: profile.enforceDeveloperMode ? true : Boolean(flags.developerMode),
    },
    credits: profile.openAccessEnabled || profile.premiumBypassEnabled
      ? {
        ...credits,
        remaining: Math.max(credits.remaining || 0, 999999),
        total: Math.max(credits.total || 0, 999999),
      }
      : credits,
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
        const newSettings = { ...DEFAULT_SETTINGS };
        if (!newSettings.user) {
          newSettings.user = { id: '' };
        }
        newSettings.user.id = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`; // Generate anonymous ID
        return this.applyRuntimeOverrides(newSettings);
      }

      const stored = storedRaw as Partial<Settings>;

      // Migrate legacy mode values
      const rawMode = (stored as any).mode;
      const migratedMode: Settings['mode'] = rawMode === 'ai' ? 'ai' : 'offline';

      const settings = { ...DEFAULT_SETTINGS, ...stored, mode: migratedMode };

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

      // Save migrated settings if mode/byok/user fields were changed
      if (rawMode !== migratedMode || providerMigrated || selectedModelMigrated || userIdMissing) {
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
      const { byok, privacy, templates, credits, user, trial, processing, ...rest } = (updates || {}) as any;
      const nextByok = normalizeByokSettings({
        ...currentSettings.byok,
        ...(byok || {}),
      });
      const newSettings: Settings = {
        ...currentSettings,
        ...rest,
        byok: nextByok,
        privacy: {
          ...currentSettings.privacy,
          ...(privacy || {})
        }, templates: {
          ...currentSettings.templates,
          ...(templates || {})
        }, credits: {
          ...currentSettings.credits,
          ...(credits || {})
        }, user: {
          ...currentSettings.user,
          ...(user || {})
        }, trial: {
          ...currentSettings.trial,
          ...(trial || {})
        }, processing: {
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
      } as Settings;
      await browser.storage.local.set(
        {
          [STORAGE_KEYS.SETTINGS]: newSettings,
        }
      );
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
      const profile = getRuntimeProfile();
      // A user with a BYOK key is considered "Pro". In development, keep profile open access on.
      const trial = { ...(current.trial || {}), hasExhausted: false, showUpgradePrompt: false };
      await browser.storage.local.set(
        {
          [STORAGE_KEYS.SETTINGS]: { ...current, byok, trial, isPro: Boolean(apiKey) || profile.openAccessEnabled || profile.premiumBypassEnabled },
        }
      );
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
      await browser.storage.local.set(
        {
          [STORAGE_KEYS.SETTINGS]: { ...current, byok },
        }
      );
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
