import { browser } from 'wxt/browser';

function saveSettings() {
  const defaultMode = (document.getElementById('defaultMode') as HTMLSelectElement).value;
  const telemetry = (document.getElementById('telemetry') as HTMLInputElement).checked;
  const aiModeEnabled = (document.getElementById('aiModeEnabled') as HTMLInputElement).checked;
  const devEnablePro = (document.getElementById('devEnablePro') as HTMLInputElement).checked;

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
      (document.getElementById('defaultMode') as HTMLSelectElement).value = settings.mode || 'offline';
      (document.getElementById('telemetry') as HTMLInputElement).checked = settings.privacy?.telemetryEnabled || false;
      (document.getElementById('aiModeEnabled') as HTMLInputElement).checked = Boolean(settings.flags?.aiModeEnabled);
      (document.getElementById('devEnablePro') as HTMLInputElement).checked = Boolean(settings.isPro);
    }
  });
});


