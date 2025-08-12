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
  mode: 'general',
  theme: 'system',
  templates: {
    bundles: [],
  },
  byok: {
    provider: 'openrouter',
    apiBase: 'https://openrouter.ai/api/v1',
    apiKey: '',
    model: '',
  },
  privacy: {
    telemetryEnabled: false,
  },
  isPro: false,
  renderer: 'turndown',
  useReadability: false,
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
      const result = await browser.storage.local.get([STORAGE_KEYS.SETTINGS]);
      return { ...DEFAULT_SETTINGS, ...result[STORAGE_KEYS.SETTINGS] };
    } catch (error) {
      console.error('Failed to load settings:', error);
      return DEFAULT_SETTINGS;
    }
  }
  
  static async updateSettings(updates: Partial<Settings>): Promise<void> {
    try {
      const currentSettings = await this.getSettings();
      const newSettings = { ...currentSettings, ...updates };
      await browser.storage.local.set({
        [STORAGE_KEYS.SETTINGS]: newSettings,
      });
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  }
  
  // ---------------------------------------------------------------------------
  // Encrypted API Key Management (AES-GCM)
  // ---------------------------------------------------------------------------
  
  static async setEncryptedApiKey(apiKey: string, passphrase: string): Promise<void> {
    try {
      if (!apiKey || !passphrase) {
        throw new Error('API key and passphrase are required');
      }
      
      // Generate salt for PBKDF2
      const salt = crypto.getRandomValues(new Uint8Array(16));
      
      // Derive key from passphrase using PBKDF2
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(passphrase),
        'PBKDF2',
        false,
        ['deriveKey']
      );
      
      const derivedKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      );
      
      // Generate IV for AES-GCM
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // Encrypt the API key
      const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        derivedKey,
        new TextEncoder().encode(apiKey)
      );
      
      // Store encrypted data with salt and IV
      await browser.storage.local.set({
        [STORAGE_KEYS.ENCRYPTED_KEYS]: {
          encryptedApiKey: Array.from(new Uint8Array(encryptedData)),
          salt: Array.from(salt),
          iv: Array.from(iv),
        },
      });
      
      // Store passphrase in session storage (ephemeral)
      await browser.storage.session.set({ passphrase });
      
    } catch (error) {
      console.error('Failed to encrypt API key:', error);
      throw error;
    }
  }
  
  static async getDecryptedApiKey(): Promise<string | null> {
    try {
      const [encryptedResult, sessionResult] = await Promise.all([
        browser.storage.local.get([STORAGE_KEYS.ENCRYPTED_KEYS]),
        browser.storage.session.get(['passphrase']),
      ]);
      
      const encryptedData = encryptedResult[STORAGE_KEYS.ENCRYPTED_KEYS];
      const passphrase = sessionResult.passphrase;
      
      if (!encryptedData || !passphrase) {
        return null;
      }
      
      // Recreate the derived key
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(passphrase),
        'PBKDF2',
        false,
        ['deriveKey']
      );
      
      const derivedKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: new Uint8Array(encryptedData.salt),
          iterations: 100000,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
      
      // Decrypt the API key
      const decryptedData = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: new Uint8Array(encryptedData.iv),
        },
        derivedKey,
        new Uint8Array(encryptedData.encryptedApiKey)
      );
      
      return new TextDecoder().decode(decryptedData);
      
    } catch (error) {
      console.error('Failed to decrypt API key:', error);
      return null;
    }
  }
  
  static async clearEncryptedApiKey(): Promise<void> {
    try {
      await Promise.all([
        browser.storage.local.remove([STORAGE_KEYS.ENCRYPTED_KEYS]),
        browser.storage.session.remove(['passphrase']),
      ]);
    } catch (error) {
      console.error('Failed to clear encrypted API key:', error);
      throw error;
    }
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
      
      await browser.storage.local.set({
        [STORAGE_KEYS.TELEMETRY]: trimmedEvents,
      });
      
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
