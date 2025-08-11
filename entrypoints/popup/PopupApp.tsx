import React, { useState, useEffect } from 'react';
import { browser } from 'wxt/browser';
import { Settings, ProcessingState, PromptReadyExport } from '@/lib/types';
import { Storage } from '@/lib/storage';
import { ModeToggle } from './components/ModeToggle.js';
import { PrimaryButton } from './components/PrimaryButton.js';
import { ExportActions } from './components/ExportActions.js';
import { StatusStrip } from './components/StatusStrip.js';
import { ProBadge } from './components/ProBadge.js';
import { Toast } from './components/Toast.js';

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

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await Storage.getSettings();
        setState(prev => ({ ...prev, settings }));
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
      await Storage.updateSettings({ renderer });
      setState(prev => ({ ...prev, settings: { ...prev.settings, renderer } }));
    } catch (e) {
      console.error('Failed to change renderer:', e);
      showToast('Failed to update setting', 'error');
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
    browser.runtime.openOptionsPage();
  };

  const openProBundles = () => {
    // TODO: Implement Pro bundles interface
    showToast('Pro bundles coming soon!', 'info');
  };

  return (
    <div className="w-96 min-h-96 bg-white text-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center">
            <span className="text-white text-xs font-bold">P</span>
          </div>
          <h1 className="text-lg font-semibold text-gray-900">
            PromptReady
          </h1>
        </div>
        
        <ModeToggle
          mode={state.settings.mode}
          onChange={handleModeChange}
        />
      </div>

      {/* Body */}
      <div className="flex-1 p-4 space-y-4">
        {/* Description */}
        <p className="text-sm text-gray-600">
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
          <span className="text-sm text-gray-700">Selection only</span>
          <button
            onClick={handleSelectionOnly}
            className="px-2 py-1 text-sm rounded border bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
          >
            Capture Selection
          </button>
        </div>

        {/* Settings toggles */}
        <div className="flex items-center justify-between text-sm text-gray-700">
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

        <div className="flex items-center justify-between text-sm text-gray-700">
          <span>Renderer</span>
          <select
            value={state.settings.renderer || 'turndown'}
            onChange={handleRendererChange}
            className="border rounded px-2 py-1 bg-white text-gray-900"
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

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
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
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
            >
              Settings
            </button>
          </div>
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
