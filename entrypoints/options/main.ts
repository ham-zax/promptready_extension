import { browser } from 'wxt/browser';

const SETTINGS_KEY = 'promptready_settings';

async function saveSettings() {
  const defaultModeElement = document.getElementById('defaultMode') as HTMLSelectElement | null;
  const defaultMode = defaultModeElement ? defaultModeElement.value : 'offline';

  const telemetryElement = document.getElementById('telemetry') as HTMLInputElement | null;
  const telemetry = telemetryElement ? telemetryElement.checked : false;

  const aiModeEnabledElement = document.getElementById('aiModeEnabled') as HTMLInputElement | null;
  const aiModeEnabled = aiModeEnabledElement ? aiModeEnabledElement.checked : false;

  const devUnlockUnlimitedElement = document.getElementById('devUnlockUnlimited') as HTMLInputElement | null;
  const devUnlockUnlimited = devUnlockUnlimitedElement ? devUnlockUnlimitedElement.checked : false;

  const existing = await browser.storage.local.get([SETTINGS_KEY]);
  const current = (existing?.[SETTINGS_KEY] || {}) as Record<string, any>;

  const nextSettings = {
    ...current,
    settingsSchemaVersion: 2,
    mode: defaultMode,
    privacy: {
      ...(current.privacy || {}),
      telemetryEnabled: telemetry,
    },
    flags: {
      ...(current.flags || {}),
      aiModeEnabled,
      byokEnabled: true,
    },
    byokUnlock: {
      ...(current.byokUnlock || {}),
      isUnlocked: devUnlockUnlimited,
      unlockCodeLast4: devUnlockUnlimited ? 'DEVU' : null,
      unlockedAt: devUnlockUnlimited ? new Date().toISOString() : null,
      unlockSchemeVersion: 1,
    },
  };

  await browser.storage.local.set({
    [SETTINGS_KEY]: nextSettings,
  });

  const button = document.getElementById('saveBtn') as HTMLButtonElement;
  const originalText = button.textContent || 'Save Settings';
  button.textContent = '✅ Saved!';
  button.style.backgroundColor = '#059669';
  setTimeout(() => {
    button.textContent = originalText;
    button.style.backgroundColor = '#2563eb';
  }, 2000);
}

document.addEventListener('DOMContentLoaded', () => {
  const button = document.getElementById('saveBtn');
  button?.addEventListener('click', () => {
    saveSettings().catch((error) => {
      console.error('Failed to save options settings:', error);
    });
  });

  browser.storage.local.get([SETTINGS_KEY]).then((result: Record<string, any>) => {
    const settings = result[SETTINGS_KEY] as any;
    if (!settings) {
      return;
    }

    const defaultModeElement = document.getElementById('defaultMode') as HTMLSelectElement | null;
    if (defaultModeElement) {
      defaultModeElement.value = settings.mode || 'offline';
    }

    const telemetryElement = document.getElementById('telemetry') as HTMLInputElement | null;
    if (telemetryElement) {
      telemetryElement.checked = settings.privacy?.telemetryEnabled || false;
    }

    const aiModeEnabledElement = document.getElementById('aiModeEnabled') as HTMLInputElement | null;
    if (aiModeEnabledElement) {
      aiModeEnabledElement.checked = Boolean(settings.flags?.aiModeEnabled);
    }

    const devUnlockUnlimitedElement = document.getElementById('devUnlockUnlimited') as HTMLInputElement | null;
    if (devUnlockUnlimitedElement) {
      devUnlockUnlimitedElement.checked = Boolean(settings.byokUnlock?.isUnlocked);
    }
  });
});
