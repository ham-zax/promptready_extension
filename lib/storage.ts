// Storage utilities with AES-GCM encryption for sensitive data
// Based on Architecture Section 8 (Security & Privacy)

import { browser } from 'wxt/browser';
import { Settings, TelemetryEvent } from './types.js';

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

const DEFAULT_SETTINGS: Settings = {
  mode: 'offline', // Default to Offline for free users
  theme: 'system',
  templates: {
    bundles: [],
  },
  byok: {
    provider: 'openrouter',
    apiBase: 'https://openrouter.ai/api/v1',
    apiKey: '', // No demo key by default; users can add BYOK
    model: 'anthropic/claude-3.5-sonnet',
    selectedByokModel: 'anthropic/claude-3.5-sonnet',
  },
  privacy: {
    telemetryEnabled: false,
  },
  isPro: false,
  credits: {
    remaining: 10, // Small free quota; AI requires credits/BYOK
    total: 10,
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
    developerMode: false,  // Developer mode OFF by default
  },
  ui: {
    theme: 'auto',
    animations: true,
    compactMode: false,
    keepPopupOpen: true,  // Keep popup open by default
    autoCloseDelay: 3000, // 3 seconds delay
  },
};

// =============================================================================
// Storage Interface
// =============================================================================

export class Storage {

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

      const result = await browser.storage.local.get([STORAGE_KEYS.SETTINGS]);
      const stored = result[STORAGE_KEYS.SETTINGS];

      if (!stored) {
        const newSettings = { ...DEFAULT_SETTINGS };
        if (!newSettings.user) {
          newSettings.user = { id: '' };
        }
        newSettings.user.id = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`; // Generate anonymous ID
        return newSettings;
      }

      // Migrate legacy mode values
      let migratedMode = stored.mode;
      if (stored.mode === 'general' || stored.mode === 'code_docs') {
        migratedMode = 'offline'; // Both legacy modes become offline mode
      }

      const settings = { ...DEFAULT_SETTINGS, ...stored, mode: migratedMode };

      // Ensure user ID exists (check for both missing and empty string)
      if (!settings.user || !settings.user.id) {
        if (!settings.user) settings.user = {};
        settings.user.id = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        // Save the generated ID
        await browser.storage.local.set({
          [STORAGE_KEYS.SETTINGS]: settings,
        });
      }

      // Ensure selectedByokModel exists for backward compatibility (may previously have been 'model')
      settings.byok = {
        ...DEFAULT_SETTINGS.byok,
        ...(settings.byok || {}),
        selectedByokModel:
          (settings.byok && (settings.byok.selectedByokModel || settings.byok.model)) ||
          DEFAULT_SETTINGS.byok.selectedByokModel,
      };

      // Save migrated settings if mode was changed
      if (stored.mode !== migratedMode) {
        await browser.storage.local.set({
          [STORAGE_KEYS.SETTINGS]: settings,
        });
      }

      return settings;
    } catch (error) {
      console.error('Failed to load settings:', error);
      return DEFAULT_SETTINGS;
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
      const { byok, privacy, templates, credits, user, trial, ...rest } = (updates || {}) as any;
      const newSettings: Settings = {
        ...currentSettings,
        ...rest,
        byok: {
          ...currentSettings.byok,
          ...(byok || {})
        }, privacy: {
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
      // A user with a BYOK key is considered "Pro"
      const trial = { ...(current.trial || {}), hasExhausted: false, showUpgradePrompt: false };
      await browser.storage.local.set(
        {
          [STORAGE_KEYS.SETTINGS]: { ...current, byok, trial, isPro: Boolean(apiKey) },
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

      const result = await browser.storage.local.get([STORAGE_KEYS.TELEMETRY]);
      const events = result[STORAGE_KEYS.TELEMETRY] || [];

      // Add new event
      events.push(event);

      // Keep only last 1000 events to prevent storage bloat
      const trimmedEvents = events.slice(-1000);
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
      const result = await browser.storage.local.get([STORAGE_KEYS.TELEMETRY]);
      return result[STORAGE_KEYS.TELEMETRY] || [];
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
