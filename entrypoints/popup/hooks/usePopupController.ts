// Custom hook for popup controller logic
// Separates UI logic from presentation for clean architecture

import { useReducer, useEffect, useCallback } from 'react';
import { browser } from 'wxt/browser';
import { Storage } from '@/lib/storage';
import type { Settings } from '@/lib/types';
import { BYOKClient } from '@/pro/byok-client';

// State types
interface PopupState {
  mode: 'offline' | 'ai';
  isPro: boolean;
  settings?: Settings;
  hasApiKey: boolean;
  apiKeyInput: string;
  processing: {
    status: 'idle' | 'capturing' | 'cleaning' | 'structuring' | 'exporting' | 'complete' | 'error';
    message?: string;
    progress?: number;
  };
  exportData: {
    markdown: string;
    json: any;
    metadata: any;
    qualityReport?: any;
  } | null;
  toast: {
    message: string;
    type: 'success' | 'error' | 'info';
  } | null;
  showUpgrade: boolean;
}

// Action types
type PopupAction =
  | { type: 'SETTINGS_LOADED'; payload: { mode: 'offline' | 'ai'; isPro: boolean; flags?: { aiModeEnabled: boolean; byokEnabled: boolean; trialEnabled: boolean }; settings: Settings } }
  | { type: 'SETTINGS_UPDATED'; payload: { settings: Settings } }
  | { type: 'SET_APIKEY_INPUT'; payload: { value: string } }
  | { type: 'MODE_CHANGED'; payload: { mode: 'offline' | 'ai' } }
  | { type: 'CAPTURE_START' }
  | { type: 'PROCESSING_PROGRESS'; payload: { status: string; message?: string; progress?: number } }
  | { type: 'PROCESSING_COMPLETE'; payload: { markdown: string; json: any; metadata: any; qualityReport?: any } }
  | { type: 'PROCESSING_ERROR'; payload: { error: string } }
  | { type: 'SHOW_TOAST'; payload: { message: string; type: 'success' | 'error' | 'info' } }
  | { type: 'HIDE_TOAST' }
  | { type: 'SHOW_UPGRADE' }
  | { type: 'HIDE_UPGRADE' };

// Reducer function
function popupReducer(state: PopupState, action: PopupAction): PopupState {
  switch (action.type) {
    case 'SETTINGS_LOADED': {
      const flags = action.payload.flags || { aiModeEnabled: false, byokEnabled: true, trialEnabled: false };
      const effectiveMode = flags.aiModeEnabled ? action.payload.mode : 'offline';
      return {
        ...state,
        mode: effectiveMode,
        isPro: action.payload.isPro,
        settings: action.payload.settings,
        hasApiKey: Boolean(action.payload.settings?.byok?.apiKey),
        apiKeyInput: '',
      };
    }

    case 'SETTINGS_UPDATED': {
      return {
        ...state,
        settings: action.payload.settings,
        isPro: action.payload.settings.isPro,
        hasApiKey: Boolean(action.payload.settings?.byok?.apiKey),
      };
    }

    case 'SET_APIKEY_INPUT': {
      return { ...state, apiKeyInput: action.payload.value };
    }

    case 'MODE_CHANGED':
      return {
        ...state,
        mode: action.payload.mode,
      };

    case 'CAPTURE_START':
      return {
        ...state,
        processing: { status: 'capturing', message: 'Capturing content...' },
        exportData: null,
      };

    case 'PROCESSING_PROGRESS':
      return {
        ...state,
        processing: {
          status: action.payload.status as any,
          message: action.payload.message,
          progress: action.payload.progress,
        },
      };

    case 'PROCESSING_COMPLETE':
      return {
        ...state,
        processing: { status: 'complete' },
        exportData: action.payload,
      };

    case 'PROCESSING_ERROR':
      return {
        ...state,
        processing: { status: 'error', message: action.payload.error },
      };

    case 'SHOW_TOAST':
      return {
        ...state,
        toast: action.payload,
      };

    case 'HIDE_TOAST':
      return {
        ...state,
        toast: null,
      };

    case 'SHOW_UPGRADE':
      return {
        ...state,
        showUpgrade: true,
      };

    case 'HIDE_UPGRADE':
      return {
        ...state,
        showUpgrade: false,
      };

    default:
      return state;
  }
}

// Initial state
const initialState: PopupState = {
  mode: 'offline',
  isPro: false,
  settings: undefined,
  hasApiKey: false,
  apiKeyInput: '',
  processing: { status: 'idle' },
  exportData: null,
  toast: null,
  showUpgrade: false,
};

// Custom hook
export function usePopupController() {
  const [state, dispatch] = useReducer(popupReducer, initialState);

  // Toast helper
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    dispatch({ type: 'SHOW_TOAST', payload: { message, type } });
    setTimeout(() => {
      dispatch({ type: 'HIDE_TOAST' });
    }, 3000);
  }, []);

  // Load initial settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await Storage.getSettings();
        dispatch({
          type: 'SETTINGS_LOADED',
          payload: { mode: settings.mode, isPro: settings.isPro, flags: settings.flags, settings },
        });
      } catch (error) {
        console.error('Failed to load settings:', error);
        showToast('Failed to load settings', 'error');
      }
    };

    loadSettings();
  }, [showToast]);

  // Message listener for background script communication
  useEffect(() => {
    const messageListener = (message: any) => {
      console.log('Popup received message:', message.type);

      switch (message.type) {
        case 'PROCESSING_PROGRESS':
          dispatch({
            type: 'PROCESSING_PROGRESS',
            payload: {
              status: message.payload.stage,
              message: message.payload.message,
              progress: message.payload.progress,
            },
          });
          break;

        case 'PROCESSING_COMPLETE':
          dispatch({
            type: 'PROCESSING_COMPLETE',
            payload: message.payload,
          });
          showToast('Content processed successfully!', 'success');

          // Auto-copy Markdown after processing completes (like working version)
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

        case 'PROCESSING_ERROR':
          dispatch({
            type: 'PROCESSING_ERROR',
            payload: { error: message.payload.error },
          });
          showToast(`Processing failed: ${message.payload.error}`, 'error');
          break;

        case 'EXPORT_COMPLETE':
          showToast('Content exported successfully!', 'success');
          break;

        case 'COPY_COMPLETE':
          if (message.payload.success) {
            showToast('Copied to clipboard!', 'success');
          } else {
            showToast(`Copy failed: ${message.payload.error || 'Unknown error'}`, 'error');
          }
          break;

        case 'EXPORT_ERROR':
          showToast(`Export failed: ${message.payload.error}`, 'error');
          break;
      }
    };

    browser.runtime.onMessage.addListener(messageListener);
    return () => browser.runtime.onMessage.removeListener(messageListener);
  }, [showToast]);

  // Handler functions
  const handleModeToggle = useCallback(async () => {
    const settings = await Storage.getSettings();
    const flags = settings.flags || { aiModeEnabled: false, byokEnabled: true, trialEnabled: false };

    if (!flags.aiModeEnabled) {
      showToast('AI Mode is not available yet', 'info');
      return;
    }

    const newMode = state.mode === 'offline' ? 'ai' : 'offline';

    // Gate AI mode behind Pro/BYOK for Phase 1
    if (newMode === 'ai' && !state.isPro) {
      dispatch({ type: 'SHOW_UPGRADE' });
      return;
    }

    try {
      await Storage.updateSettings({ mode: newMode });
      dispatch({ type: 'MODE_CHANGED', payload: { mode: newMode } });
      showToast(`Switched to ${newMode.toUpperCase()} mode`, 'success');
    } catch (error) {
      console.error('Failed to update mode:', error);
      showToast('Failed to update mode', 'error');
    }
  }, [state.mode, state.isPro, showToast]);

  const onSettingsChange = useCallback(async (partial: Partial<Settings>) => {
    try {
      await Storage.updateSettings(partial);
      const updated = await Storage.getSettings();
      dispatch({ type: 'SETTINGS_UPDATED', payload: { settings: updated } });
      showToast('Settings saved', 'success');
    } catch (error) {
      console.error('Failed to save settings:', error);
      showToast('Failed to save settings', 'error');
    }
  }, [showToast]);

  const onApiKeyChange = useCallback((value: string) => {
    dispatch({ type: 'SET_APIKEY_INPUT', payload: { value } });
  }, []);

  const onApiKeySave = useCallback(async () => {
    try {
      const key = state.apiKeyInput.trim();
      await Storage.setApiKey(key);
      // Mark as Pro when BYOK key is present
      await Storage.updateSettings({ isPro: Boolean(key) });
      const updated = await Storage.getSettings();
      dispatch({ type: 'SETTINGS_UPDATED', payload: { settings: updated } });
      showToast('API key saved', 'success');
    } catch (error) {
      console.error('Failed to save API key:', error);
      showToast('Failed to save API key', 'error');
    }
  }, [state.apiKeyInput, showToast]);

  const onApiKeyTest = useCallback(async () => {
    try {
      const settings = await Storage.getSettings();
      const key = settings.byok.apiKey;
      if (!key) {
        showToast('Please enter and save an API key first', 'info');
        return;
      }
      const result = await BYOKClient.makeRequest(
        { prompt: 'ping', maxTokens: 4, temperature: 0 },
        { apiBase: settings.byok.apiBase, apiKey: key, model: settings.byok.model },
        { requireExplicitConsent: false }
      );
      if (result.content) {
        showToast('BYOK connection OK', 'success');
      } else {
        showToast('BYOK test completed (no content)', 'info');
      }
    } catch (error) {
      const msg = (error instanceof Error ? error.message : String(error));
      console.error('BYOK test failed:', msg);
      if (msg.includes('timed out')) {
        showToast('BYOK test timed out. Check network or try again.', 'error');
      } else if (msg.includes('401') || msg.toLowerCase().includes('unauthorized')) {
        showToast('BYOK test failed: Unauthorized (check API key).', 'error');
      } else if (msg.includes('429') || msg.toLowerCase().includes('rate')) {
        showToast('BYOK test failed: Rate limited. Please wait and retry.', 'error');
      } else {
        showToast(`BYOK test failed: ${msg.slice(0, 120)}`, 'error');
      }
    }
  }, [showToast]);

  const handleCapture = useCallback(async () => {
    try {
      dispatch({ type: 'CAPTURE_START' });

      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) {
        throw new Error('No active tab found');
      }

      await browser.runtime.sendMessage({
        type: 'CAPTURE_REQUEST',
        payload: { tabId: tab.id, mode: state.mode },
      });

    } catch (error) {
      console.error('Capture failed:', error);
      dispatch({
        type: 'PROCESSING_ERROR',
        payload: { error: 'Capture failed' },
      });
      showToast('Failed to capture content', 'error');
    }
  }, [state.mode, showToast]);

  const handleCopy = useCallback(async (content: string) => {
    try {
      console.log('handleCopy called, delegating to background script...');

      // Always delegate to background script (like the working version)
      await browser.runtime.sendMessage({
        type: 'EXPORT_REQUEST',
        payload: { format: 'md', action: 'copy', content },
      });

      console.log('Copy request sent to background successfully');
      // Success toast will be shown via EXPORT_COMPLETE message

    } catch (error) {
      console.error('Copy request failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Copy failed';
      showToast(`Copy failed: ${errorMessage}`, 'error');
    }
  }, [showToast]);

  const handleExport = useCallback(async (format: 'md' | 'json', action: 'copy' | 'download' = 'download') => {
    if (!state.exportData) {
      showToast('No content to export', 'error');
      return;
    }

    try {
      const content = format === 'md' ? state.exportData.markdown : JSON.stringify(state.exportData.json, null, 2);
      const filename = `promptready-export.${format}`;

      console.log(`handleExport called with format: ${format}, action: ${action}`);

      await browser.runtime.sendMessage({
        type: 'EXPORT_REQUEST',
        payload: { content, filename, format, action },
      });

      console.log('Export request sent successfully to background');

    } catch (error) {
      console.error('Export failed:', error);
      showToast('Failed to export content', 'error');
    }
  }, [state.exportData, showToast]);

  const handleUpgradeClose = useCallback(() => {
    dispatch({ type: 'HIDE_UPGRADE' });
  }, []);

  // Computed properties
  const isProcessing = state.processing.status === 'capturing' || state.processing.status === 'cleaning';
  const hasContent = !!state.exportData?.markdown;

  return {
    // State
    state,

    // Computed properties
    isProcessing,
    hasContent,

    // Handlers
    handleModeToggle,
    handleCapture,
    handleCopy,
    handleExport,
    handleUpgradeClose,

    // Settings/BYOK handlers
    onSettingsChange,
    onApiKeyChange,
    onApiKeySave,
    onApiKeyTest,

    // Utilities
    showToast,
  };
}
