import React, { useState, useEffect } from 'react';
import { browser } from 'wxt/browser';
import { Settings, ProcessingState, PromptReadyExport } from '@/lib/types';
import { Storage } from '@/lib/storage';
import { ModeToggle } from './components/ModeToggle.js';
import { PrimaryButton } from './components/PrimaryButton.js';
import { ExportActions } from './components/ExportActions.js';
import { StatusStrip } from './components/StatusStrip.js';
import { ProBadge } from './components/ProBadge.js';
import { Disclosure } from './components/Disclosure.js';
import { Toast } from './components/Toast.js';
import { ModelSelect } from './components/ModelSelect.js';

interface PopupState {
  settings: Settings;
  processing: ProcessingState;
  exportData: {
    markdown: string;
    json: PromptReadyExport;
  } | null;
  toast: {
    message: string;
    type: 'success' | 'error' | 'info';
  } | null;
}

type View = 'home' | 'settings';

export default function PopupApp() {
  const [state, setState] = useState<PopupState>({
    settings: {
      mode: 'general',
      templates: { bundles: [] },
      byok: {
        provider: 'openrouter',
        apiBase: 'https://openrouter.ai/api/v1',
        apiKey: '',
        model: '',
      },
      privacy: { telemetryEnabled: false },
      isPro: false,
    },
    processing: { status: 'idle' },
    exportData: null,
    toast: null,
  });
  const [view, setView] = useState<View>('home');
  const [byokApiKeyInput, setByokApiKeyInput] = useState('');
  const [hasByokKey, setHasByokKey] = useState(false);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await Storage.getSettings();
        setState(prev => ({ ...prev, settings }));
        // Apply theme on load
        const theme = settings.theme || 'system';
        const root = document.documentElement;
        const apply = (t: 'system' | 'light' | 'dark') => {
          if (t === 'dark') root.classList.add('dark');
          else if (t === 'light') root.classList.remove('dark');
          else root.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches);
        };
        apply(theme);
        if (theme === 'system') {
          const m = window.matchMedia('(prefers-color-scheme: dark)');
          const handle = () => apply('system');
          m.addEventListener?.('change', handle);
        }

        // Check if a BYOK API key exists (presence only)
        try {
          const key = await Storage.getApiKey();
          setHasByokKey(Boolean(key));
        } catch {}
      } catch (error) {
        console.error('Failed to load settings:', error);
        showToast('Failed to load settings', 'error');
      }
    };

    loadSettings();
  }, []);

  // Listen for messages from background script
  useEffect(() => {
    const handleMessage = (message: any) => {
      switch (message.type) {
        case 'PROCESSING_COMPLETE': {
          setState(prev => ({
            ...prev,
            processing: { status: 'complete' },
            exportData: {
              markdown: message.payload.exportMd,
              json: message.payload.exportJson,
            },
          }));
          showToast('Content processed successfully!', 'success');
          // Auto-copy Markdown after processing completes
          (async () => {
            try {
              await browser.runtime.sendMessage({
                type: 'EXPORT_REQUEST',
                payload: { format: 'md', action: 'copy' },
              });
            } catch (e) {
              console.warn('Auto-copy request failed:', e);
            }
          })();
          break;
        }

        case 'BYOK_RESULT': {
          const content = message.payload?.content || '';
          // Populate exportData so the Export buttons work after BYOK validation
          const byokExport: PromptReadyExport = {
            version: '1.0',
            metadata: {
              title: 'BYOK Result',
              url: '',
              capturedAt: new Date().toISOString(),
              selectionHash: 'byok',
            },
            blocks: [{ type: 'paragraph', text: content }],
          };
          setState(prev => ({
            ...prev,
            processing: { status: 'complete' },
            exportData: { markdown: content, json: byokExport },
          }));
          showToast('BYOK validation complete', 'success');
          // Optionally, copy result to clipboard automatically via background
          (async () => {
            try {
              await browser.runtime.sendMessage({
                type: 'EXPORT_REQUEST',
                payload: { format: 'md', action: 'copy' },
              });
            } catch (e) {
              console.warn('BYOK auto-copy failed:', e);
            }
          })();
          break;
        }

        case 'ERROR':
          setState(prev => ({
            ...prev,
            processing: { status: 'error', message: message.payload.message },
          }));
          showToast(message.payload.message, 'error');
          break;

        case 'EXPORT_COMPLETE':
          // Show success message when export actually completes
          const { format, action } = message.payload;
          showToast(`${action === 'copy' ? 'Copied' : 'Downloaded'} ${format.toUpperCase()}`, 'success');
          break;

        default:
          break;
      }
    };

    browser.runtime.onMessage.addListener(handleMessage);
    return () => browser.runtime.onMessage.removeListener(handleMessage);
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setState(prev => ({ ...prev, toast: { message, type } }));
    setTimeout(() => {
      setState(prev => ({ ...prev, toast: null }));
    }, 5000);
  };

  const handleModeChange = async (mode: 'general' | 'code_docs') => {
    try {
      await Storage.updateSettings({ mode });
      setState(prev => ({
        ...prev,
        settings: { ...prev.settings, mode },
      }));
    } catch (error) {
      console.error('Failed to update mode:', error);
      showToast('Failed to update mode', 'error');
    }
  };

  const toggleReadability = async () => {
    try {
      const currentlyOn = state.settings.useReadability !== false;
      const next = !currentlyOn;
      await Storage.updateSettings({ useReadability: next });
      setState(prev => ({
        ...prev,
        settings: { ...prev.settings, useReadability: next },
      }));
    } catch (e) {
      console.error('Failed to toggle Readability:', e);
      showToast('Failed to update setting', 'error');
    }
  };

  const handleRendererChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    try {
      const renderer = e.target.value as 'turndown' | 'structurer';
      const useReadability = renderer === 'structurer' ? false : (state.settings.useReadability !== false);
      await Storage.updateSettings({ renderer, useReadability });
      setState(prev => ({ ...prev, settings: { ...prev.settings, renderer, useReadability } }));
    } catch (e) {
      console.error('Failed to change renderer:', e);
      showToast('Failed to update setting', 'error');
    }
  };

  const saveEncryptedByokKey = async () => {
    try {
      if (!byokApiKeyInput) {
        showToast('Enter API key', 'error');
        return;
      }
      // Store API key directly (no passphrase)
      await Storage.setApiKey(byokApiKeyInput);
      // Clear local input for security
      setByokApiKeyInput('');
      setHasByokKey(true);
      showToast('API key saved', 'success');
    } catch (e) {
      console.error('Failed to save API key:', e);
      showToast('Failed to save API key', 'error');
    }
  };

  const clearEncryptedByokKey = async () => {
    try {
      await Storage.clearApiKey();
      showToast('API key cleared', 'success');
      setHasByokKey(false);
    } catch (e) {
      console.error('Failed to clear API key:', e);
      showToast('Failed to clear API key', 'error');
    }
  };

  const handleCleanAndExport = async () => {
    try {
      setState(prev => ({
        ...prev,
        processing: { status: 'capturing', message: 'Capturing content...' },
        exportData: null,
      }));

      // Get active tab and send capture message to content script via background
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) {
        throw new Error('No active tab found');
      }

      // Send capture message to content script
      try {
        await browser.tabs.sendMessage(tab.id, { type: 'CAPTURE_SELECTION' });
      } catch (error) {
        console.error('Failed to send message to content script:', error);
        setState(prev => ({
          ...prev,
          processing: { status: 'error', message: 'Please refresh the page and try again' },
        }));
        showToast('Content script not ready. Please refresh the page and try again.', 'error');
      }

    } catch (error) {
      console.error('Capture failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to capture content';
      setState(prev => ({
        ...prev,
        processing: { status: 'error', message: errorMessage },
      }));
      showToast(errorMessage, 'error');
    }
  };

  const handleSelectionOnly = async () => {
    try {
      setState(prev => ({ ...prev, processing: { status: 'capturing', message: 'Capturing selection...' }, exportData: null }));
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab found');
      await browser.tabs.sendMessage(tab.id, { type: 'CAPTURE_SELECTION_ONLY' });
    } catch (e) {
      console.error('Selection capture failed:', e);
      showToast('Selection capture failed', 'error');
      setState(prev => ({ ...prev, processing: { status: 'error', message: 'Selection capture failed' } }));
    }
  };

  const handleExport = async (format: 'md' | 'json', action: 'copy' | 'download') => {
    try {
      console.log(`handleExport called with format: ${format}, action: ${action}`);
      if (!state.exportData) throw new Error('No content to export');

      // Always delegate copy/download to background so it can use Offscreen
      console.log('Sending export request to background:', { format, action });
      await browser.runtime.sendMessage({ type: 'EXPORT_REQUEST', payload: { format, action } });
      console.log('Export request sent successfully to background');
      // Success toast will be shown on EXPORT_COMPLETE from background
    } catch (error) {
      console.error('Export failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Export failed';
      showToast(errorMessage, 'error');
    }
  };

  const openSettings = () => {
    setView('settings');
  };

  const backToHome = () => setView('home');

  const openProBundles = () => {
    // TODO: Implement Pro bundles interface
    showToast('Pro bundles coming soon!', 'info');
  };

  const testByokValidate = async () => {
    try {
      // If user has pasted a key but not saved, save it now for convenience
      if (byokApiKeyInput) {
        await Storage.setApiKey(byokApiKeyInput);
        setByokApiKeyInput('');
        setHasByokKey(true);
      }

      const currentKey = await Storage.getApiKey();
      if (!currentKey) {
        showToast('No API key saved. Paste your key and Save, or try again.', 'error');
        return;
      }

      const bundleContent = 'Respond with only the word `OK` if you are functioning correctly.';
      const model = state.settings.byok.model || 'openrouter/auto';
      await browser.runtime.sendMessage({
        type: 'BYOK_REQUEST',
        payload: { bundleContent, model },
      });
      showToast('BYOK request sent…', 'info');
    } catch (e) {
      console.error('BYOK request failed:', e);
      showToast('Failed to start BYOK validation', 'error');
    }
  };

  return (
    <div className="w-96 min-h-96 bg-background text-foreground flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center">
            <span className="text-white text-xs font-bold">P</span>
          </div>
          <h1 className="text-lg font-semibold text-foreground">
            {view === 'home' ? 'PromptReady' : 'Settings'}
          </h1>
        </div>
        {view === 'home' ? (
          <ModeToggle
            mode={state.settings.mode}
            onChange={handleModeChange}
          />
        ) : (
          <button
            onClick={backToHome}
            className="px-2 py-1 text-xs rounded border bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground"
          >
            Back
          </button>
        )}
      </div>

      {/* Body */}
      {view === 'home' ? (
        <div className="flex-1 p-4 space-y-4">
          {/* Description */}
          <p className="text-sm text-muted-foreground">
            {state.settings.mode === 'code_docs' 
              ? 'Clean code documentation, API references, and technical content'
              : 'Clean articles, blog posts, and general web content'
            }
          </p>

          {/* Primary Action */}
          <PrimaryButton
            onClick={handleCleanAndExport}
            disabled={state.processing.status !== 'idle' && state.processing.status !== 'complete' && state.processing.status !== 'error'}
            loading={state.processing.status !== 'idle' && state.processing.status !== 'complete' && state.processing.status !== 'error'}
            loadingText={state.processing.message}
          >
            Clean & Export
          </PrimaryButton>

          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Selection only</span>
            <button
              onClick={handleSelectionOnly}
              className="px-2 py-1 text-sm rounded border bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground"
            >
              Capture Selection
            </button>
          </div>

          {/* Quick controls on home */}
          <div className="flex items-center justify-between text-sm text-foreground">
            <span>Use Readability (articles)</span>
            <label className="inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={state.settings.useReadability !== false}
                onChange={toggleReadability}
                className="sr-only"
              />
              <span className={`w-10 h-6 inline-flex items-center rounded-full transition-colors ${state.settings.useReadability !== false ? 'bg-green-500' : 'bg-gray-300'}`}>
                <span className={`w-4 h-4 bg-white rounded-full transform transition-transform ${state.settings.useReadability !== false ? 'translate-x-5' : 'translate-x-1'}`}></span>
              </span>
            </label>
          </div>

          <div className="flex items-center justify-between text-sm text-foreground">
            <span>Renderer</span>
            <select
              value={state.settings.renderer || 'turndown'}
              onChange={handleRendererChange}
              className="border rounded px-2 py-1 bg-background text-foreground border-input"
            >
              <option value="turndown">Turndown (GFM)</option>
              <option value="structurer">Structurer</option>
            </select>
          </div>

          {/* Export Actions */}
          {state.exportData && (
            <ExportActions
              onExport={handleExport}
              disabled={!state.exportData}
            />
          )}
        </div>
      ) : (
        <div className="flex-1 p-4 space-y-3">
          <Disclosure title="Appearance" description="Theme and color scheme" defaultOpen>
            <div className="flex items-center justify-between text-sm text-foreground">
              <span>Theme</span>
              <select
                value={state.settings.theme || 'system'}
                onChange={async (e) => {
                  const nextTheme = e.target.value as 'system' | 'light' | 'dark';
                  await Storage.updateSettings({ theme: nextTheme });
                  setState((prev) => ({ ...prev, settings: { ...prev.settings, theme: nextTheme } }));
                  const root = document.documentElement;
                  if (nextTheme === 'dark') root.classList.add('dark');
                  else if (nextTheme === 'light') root.classList.remove('dark');
                  else root.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches);
                }}
                className="border rounded px-2 py-1 bg-background text-foreground border-input"
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </Disclosure>
          <Disclosure title="General" description="Capture behavior and rendering" defaultOpen>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm text-foreground">
                <span>Mode</span>
                <select
                  value={state.settings.mode}
                  onChange={(e) => handleModeChange(e.target.value as 'general' | 'code_docs')}
                  className="border rounded px-2 py-1 bg-background text-foreground border-input"
                >
                  <option value="general">General</option>
                  <option value="code_docs">Code & Docs</option>
                </select>
              </div>

              <div className="flex items-center justify-between text-sm text-foreground">
                <span>Use Readability (articles)</span>
                <label className="inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={state.settings.useReadability !== false}
                    onChange={toggleReadability}
                    className="sr-only"
                  />
                  <span className={`w-10 h-6 inline-flex items-center rounded-full transition-colors ${state.settings.useReadability !== false ? 'bg-green-500' : 'bg-gray-300'}`}>
                    <span className={`w-4 h-4 bg-white rounded-full transform transition-transform ${state.settings.useReadability !== false ? 'translate-x-5' : 'translate-x-1'}`}></span>
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-between text-sm text-foreground">
                <span>Renderer</span>
                <select
                  value={state.settings.renderer || 'turndown'}
                  onChange={handleRendererChange}
                  className="border rounded px-2 py-1 bg-background text-foreground border-input"
                >
                  <option value="turndown">Turndown (GFM)</option>
                  <option value="structurer">Structurer</option>
                </select>
              </div>
            </div>
          </Disclosure>

          <Disclosure title="Privacy" description="Telemetry preferences">
            <div className="flex items-center justify-between text-sm text-foreground">
              <span>Enable Usage Analytics</span>
              <label className="inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={state.settings.privacy.telemetryEnabled}
                  onChange={async () => {
                    const next = !state.settings.privacy.telemetryEnabled;
                    await Storage.updateSettings({ privacy: { telemetryEnabled: next } as any });
                    setState((prev) => ({ ...prev, settings: { ...prev.settings, privacy: { telemetryEnabled: next } } }));
                  }}
                  className="sr-only"
                />
                <span className={`w-10 h-6 inline-flex items-center rounded-full transition-colors ${state.settings.privacy.telemetryEnabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <span className={`w-4 h-4 bg-white rounded-full transform transition-transform ${state.settings.privacy.telemetryEnabled ? 'translate-x-5' : 'translate-x-1'}`}></span>
                </span>
              </label>
            </div>
          </Disclosure>

          <Disclosure title="Pro" description="Manage Pro features (coming soon)">
            <div className="flex items-center justify-between text-sm text-foreground">
              <span>Pro status</span>
              <span className={`px-2 py-0.5 text-xs rounded-full ${state.settings.isPro ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                {state.settings.isPro ? 'Active' : 'Free'}
              </span>
            </div>
          </Disclosure>

          <Disclosure title="BYOK (Pro)" description="OpenAI-compatible settings and secure key storage" defaultOpen>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm text-foreground">
                <span>Provider</span>
                <span className="px-2 py-1 text-xs rounded bg-muted text-muted-foreground">{state.settings.byok.provider || 'openrouter'}</span>
              </div>

              <div className="flex items-center justify-between text-sm text-foreground">
                <label htmlFor="apiBase" className="mr-2">API Base</label>
                <input
                  id="apiBase"
                  type="text"
                  value={state.settings.byok.apiBase || ''}
                  onChange={async (e) => {
                    const apiBase = e.target.value;
                    await Storage.updateSettings({ byok: { apiBase } as any });
                    setState(prev => ({ ...prev, settings: { ...prev.settings, byok: { ...prev.settings.byok, apiBase } } }));
                  }}
                  className="border rounded px-2 py-1 bg-background text-foreground border-input w-64"
                />
              </div>

              <div className="flex items-center justify-between text-sm text-foreground">
                <div className="flex flex-col items-start w-full space-y-2">
                  <label className="mr-2">Model (OpenRouter dropdown or Manual)</label>
                  <ModelSelect
                    value={state.settings.byok.model || ''}
                    apiBase={state.settings.byok.apiBase || 'https://openrouter.ai/api/v1'}
                    onChange={async (model) => {
                      await Storage.updateSettings({ byok: { model } as any });
                      setState(prev => ({ ...prev, settings: { ...prev.settings, byok: { ...prev.settings.byok, model } } }));
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-col space-y-2">
                <label htmlFor="apiKey" className="text-sm text-foreground">API Key</label>
                <input
                  id="apiKey"
                  type="password"
                  value={byokApiKeyInput}
                  onChange={(e) => setByokApiKeyInput(e.target.value)}
                  placeholder="Paste your OpenRouter key"
                  className="border rounded px-2 py-1 bg-background text-foreground border-input w-full"
                />
                <span className="text-xs text-muted-foreground">
                  {hasByokKey ? 'Key status: Saved' : 'Key status: Not saved'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={saveEncryptedByokKey}
                  className="px-3 py-2 text-xs rounded border bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground"
                  title="Saves your key to local extension storage"
                >
                  Save API Key
                </button>
                <button
                  onClick={clearEncryptedByokKey}
                  className="px-3 py-2 text-xs rounded border bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground"
                >
                  Clear Key
                </button>
                <button
                  onClick={testByokValidate}
                  disabled={!hasByokKey && !byokApiKeyInput}
                  className={`px-3 py-2 text-xs rounded border border-input ${!hasByokKey && !byokApiKeyInput ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-background text-foreground hover:bg-accent hover:text-accent-foreground'}`}
                  title={!hasByokKey && !byokApiKeyInput ? 'Paste your key first' : 'Saves pasted key (if any) and validates'}
                >
                  Validate Now
                </button>
              </div>
            </div>
          </Disclosure>
        </div>
      )}

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center justify-between">
          {view === 'home' ? (
            <>
              <StatusStrip
                processing={state.processing}
                lastAction={state.exportData ? 'Content ready' : undefined}
              />
              <div className="flex items-center space-x-2">
                {state.settings.isPro && (
                  <ProBadge onClick={openProBundles} />
                )}
                <button
                  onClick={openSettings}
                  className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-accent"
                >
                  Settings
                </button>
              </div>
            </>
          ) : (
            <div className="w-full flex justify-end">
              <button
                onClick={backToHome}
                className="px-3 py-2 text-xs rounded border bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {state.toast && (
        <Toast
          message={state.toast.message}
          type={state.toast.type}
          onClose={() => setState(prev => ({ ...prev, toast: null }))}
        />
      )}
    </div>
  );
}
