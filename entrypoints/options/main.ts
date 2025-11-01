import { browser } from 'wxt/browser';

function saveSettings() {
  const defaultModeElement = document.getElementById('defaultMode') as HTMLSelectElement | null;
  const defaultMode = defaultModeElement ? defaultModeElement.value : 'offline';

  const telemetryElement = document.getElementById('telemetry') as HTMLInputElement | null;
  const telemetry = telemetryElement ? telemetryElement.checked : false;

  const aiModeEnabledElement = document.getElementById('aiModeEnabled') as HTMLInputElement | null;
  const aiModeEnabled = aiModeEnabledElement ? aiModeEnabledElement.checked : false;

  const devEnableProElement = document.getElementById('devEnablePro') as HTMLInputElement | null;
  const devEnablePro = devEnableProElement ? devEnableProElement.checked : false;

  browser.storage.local.set({
    promptready_settings: {
      mode: defaultMode,
      privacy: { telemetryEnabled: telemetry },
      flags: { aiModeEnabled, byokEnabled: true, trialEnabled: false },
      isPro: devEnablePro,
    },
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
  button?.addEventListener('click', saveSettings);

  browser.storage.local.get(['promptready_settings']).then((result: Record<string, any>) => {
    const settings = result.promptready_settings as any;
    if (settings) {
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

      const devEnableProElement = document.getElementById('devEnablePro') as HTMLInputElement | null;
      if (devEnableProElement) {
        devEnableProElement.checked = Boolean(settings.isPro);
      }
    }
  });
});


