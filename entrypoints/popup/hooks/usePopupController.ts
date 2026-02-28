// Custom hook for popup controller logic

import { useReducer, useEffect, useCallback } from 'react';
import { browser } from 'wxt/browser';
import { Storage } from '@/lib/storage';
import type {
  AIFallbackCode,
  AIAttemptOutcome,
  Settings,
} from '@/lib/types';
import { resolveEntitlements, type AILockReason } from '@/lib/entitlement-policy';
import UI_MESSAGES from '@/lib/ui-messages';

interface PopupState {
  mode: 'offline' | 'ai';
  settings?: Settings;
  hasApiKey: boolean;
  isUnlocked: boolean;
  canUseAIMode: boolean;
  aiLockReason: AILockReason;
  remainingFreeByokUsesToday: number;
  remainingFreeByokStartsToday: number;
  apiKeyInput: string;
  processing: {
    status: 'idle' | 'capturing' | 'cleaning' | 'processing' | 'structuring' | 'exporting' | 'complete' | 'error';
    message?: string;
    progress?: number;
  };
  exportData: {
    markdown: string;
    json: any;
    metadata: any;
    warnings?: string[];
    qualityReport?: any;
    pipelineUsed?: 'standard' | 'intelligent-bypass';
    stats?: any;
    aiAttempted?: boolean;
    aiProvider?: 'openrouter' | null;
    aiOutcome?: AIAttemptOutcome;
    fallbackCode?: AIFallbackCode;
    runId?: string;
  } | null;
  toast: {
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  } | null;
  settingsView: 'main' | 'byokChoice' | 'byokConfig';
  byokProvider: 'openrouter';
}

type ProcessingCompletePayload = {
  markdown?: string;
  exportMd?: string;
  json?: any;
  exportJson?: any;
  metadata: any;
  warnings?: string[];
  qualityReport?: any;
  stats?: any;
  aiAttempted?: boolean;
  aiProvider?: 'openrouter' | null;
  aiOutcome?: AIAttemptOutcome;
  fallbackCode?: AIFallbackCode;
  runId?: string;
};

type PopupAction =
  | { type: 'SETTINGS_LOADED'; payload: { settings: Settings } }
  | { type: 'SETTINGS_UPDATED'; payload: { settings: Settings } }
  | { type: 'SET_APIKEY_INPUT'; payload: { value: string } }
  | { type: 'MODE_CHANGED'; payload: { mode: 'offline' | 'ai' } }
  | { type: 'CAPTURE_START' }
  | { type: 'PROCESSING_PROGRESS'; payload: { status: string; message?: string; progress?: number } }
  | { type: 'PROCESSING_COMPLETE'; payload: ProcessingCompletePayload }
  | { type: 'PROCESSING_ERROR'; payload: { error: string } }
  | { type: 'SHOW_TOAST'; payload: { message: string; type: 'success' | 'error' | 'info' | 'warning' } }
  | { type: 'HIDE_TOAST' }
  | { type: 'SET_SETTINGS_VIEW'; payload: { view: 'main' | 'byokChoice' | 'byokConfig' } }
  | { type: 'SET_BYOK_PROVIDER'; payload: { provider: 'openrouter' } };

function deriveUiStateFromSettings(settings: Settings) {
  const entitlements = resolveEntitlements(settings);
  const effectiveMode =
    entitlements.flags.aiModeEnabled || entitlements.flags.developerMode
      ? settings.mode
      : 'offline';

  return {
    effectiveMode,
    hasApiKey: entitlements.hasApiKey,
    isUnlocked: entitlements.isUnlocked,
    canUseAIMode: entitlements.canUseAIMode,
    aiLockReason: entitlements.aiLockReason,
    remainingFreeByokUsesToday: entitlements.remainingFreeByokUsesToday,
    remainingFreeByokStartsToday: entitlements.remainingFreeByokStartsToday,
  };
}

function popupReducer(state: PopupState, action: PopupAction): PopupState {
  switch (action.type) {
    case 'SETTINGS_LOADED': {
      const { settings } = action.payload;
      const next = deriveUiStateFromSettings(settings);

      return {
        ...state,
        mode: next.effectiveMode,
        settings,
        hasApiKey: next.hasApiKey,
        isUnlocked: next.isUnlocked,
        canUseAIMode: next.canUseAIMode,
        aiLockReason: next.aiLockReason,
        remainingFreeByokUsesToday: next.remainingFreeByokUsesToday,
        remainingFreeByokStartsToday: next.remainingFreeByokStartsToday,
        apiKeyInput: '',
      };
    }
    case 'SETTINGS_UPDATED': {
      const { settings } = action.payload;
      const next = deriveUiStateFromSettings(settings);

      return {
        ...state,
        mode: next.effectiveMode,
        settings,
        hasApiKey: next.hasApiKey,
        isUnlocked: next.isUnlocked,
        canUseAIMode: next.canUseAIMode,
        aiLockReason: next.aiLockReason,
        remainingFreeByokUsesToday: next.remainingFreeByokUsesToday,
        remainingFreeByokStartsToday: next.remainingFreeByokStartsToday,
      };
    }
    case 'SET_APIKEY_INPUT':
      return {
        ...state,
        apiKeyInput: action.payload.value,
      };
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
    case 'PROCESSING_COMPLETE': {
      const pipelineUsed = action.payload?.stats?.pipelineUsed;
      return {
        ...state,
        processing: { status: 'complete' },
        exportData: {
          ...action.payload,
          markdown: action.payload.markdown || action.payload.exportMd || '',
          json: action.payload.json || action.payload.exportJson,
          pipelineUsed,
        },
      };
    }
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
    case 'SET_SETTINGS_VIEW':
      return {
        ...state,
        settingsView: action.payload.view,
      };
    case 'SET_BYOK_PROVIDER':
      return {
        ...state,
        byokProvider: action.payload.provider,
      };
    default:
      return state;
  }
}

const initialState: PopupState = {
  mode: 'offline',
  settings: undefined,
  hasApiKey: false,
  isUnlocked: false,
  canUseAIMode: false,
  aiLockReason: 'missing_api_key',
  remainingFreeByokUsesToday: 0,
  remainingFreeByokStartsToday: 0,
  apiKeyInput: '',
  processing: { status: 'idle' },
  exportData: null,
  toast: null,
  settingsView: 'main',
  byokProvider: 'openrouter',
};

function resolveFallbackToastMessage(aiOutcome?: AIAttemptOutcome): string {
  if (aiOutcome === 'fallback_missing_key') {
    return UI_MESSAGES.aiFallbackMissingKey;
  }

  if (aiOutcome === 'fallback_provider') {
    return UI_MESSAGES.aiFallbackProviderUnsupported;
  }

  if (aiOutcome === 'fallback_daily_limit_reached') {
    return UI_MESSAGES.aiFallbackDailyLimitReached;
  }

  return UI_MESSAGES.aiFallbackRequestFailed;
}

export function usePopupController() {
  const [state, dispatch] = useReducer(popupReducer, initialState);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    dispatch({ type: 'SHOW_TOAST', payload: { message, type } });
    setTimeout(() => {
      dispatch({ type: 'HIDE_TOAST' });
    }, 3000);
  }, []);

  const refreshSettings = useCallback(async () => {
    const settings = await Storage.getSettings();
    dispatch({ type: 'SETTINGS_UPDATED', payload: { settings } });
    return settings;
  }, []);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const settings = await Storage.getSettings();
        dispatch({ type: 'SETTINGS_LOADED', payload: { settings } });
      } catch (error) {
        console.error('Failed to load settings:', error);
        showToast(UI_MESSAGES.failedToLoadSettings, 'error');
      }
    };

    loadInitialData();
  }, [showToast]);

  useEffect(() => {
    const consumeFailedBroadcasts = async () => {
      try {
        const res = await browser.storage.session.get(['failed_broadcasts']);
        const failed: any[] = (res && (res as any).failed_broadcasts) || [];

        if (!Array.isArray(failed) || failed.length === 0) {
          return;
        }

        for (const msg of failed) {
          try {
            switch (msg.type) {
              case 'PROCESSING_COMPLETE': {
                dispatch({ type: 'PROCESSING_COMPLETE', payload: msg.payload });
                const aiOutcome = msg?.payload?.aiOutcome as AIAttemptOutcome | undefined;
                const isFallback = typeof aiOutcome === 'string' && aiOutcome.startsWith('fallback_');

                if (isFallback) {
                  showToast(resolveFallbackToastMessage(aiOutcome), 'warning');
                } else {
                  const pipeline = msg?.payload?.stats?.pipelineUsed;
                  const successMessage =
                    pipeline === 'intelligent-bypass'
                      ? UI_MESSAGES.intelligentBypassSuccess
                      : UI_MESSAGES.contentProcessed;
                  showToast(successMessage, 'success');
                }

                await refreshSettings();
                break;
              }
              case 'EXPORT_COMPLETE':
                showToast(UI_MESSAGES.contentExported, 'success');
                break;
              case 'PROCESSING_ERROR':
                if (msg?.payload?.fallbackUsed) {
                  break;
                }
                dispatch({
                  type: 'PROCESSING_ERROR',
                  payload: { error: msg?.payload?.error || 'Unknown error' },
                });
                showToast(
                  UI_MESSAGES.processingFailed(msg?.payload?.error || 'Unknown error'),
                  'error'
                );
                break;
              default:
                break;
            }
          } catch (innerErr) {
            console.warn('Failed to consume stored message:', innerErr);
          }
        }

        await browser.storage.session.remove(['failed_broadcasts']);
      } catch (err) {
        console.warn('Failed to load pending broadcasts:', err);
      }
    };

    consumeFailedBroadcasts();
  }, [refreshSettings, showToast]);

  useEffect(() => {
    const messageListener = (message: any) => {
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

        case 'PROCESSING_COMPLETE': {
          dispatch({
            type: 'PROCESSING_COMPLETE',
            payload: message.payload,
          });

          const aiOutcome = message?.payload?.aiOutcome as AIAttemptOutcome | undefined;
          const isFallback = typeof aiOutcome === 'string' && aiOutcome.startsWith('fallback_');

          if (isFallback) {
            showToast(resolveFallbackToastMessage(aiOutcome), 'warning');
          } else {
            const pipeline = message?.payload?.stats?.pipelineUsed;
            const successMessage =
              pipeline === 'intelligent-bypass'
                ? UI_MESSAGES.intelligentBypassSuccess
                : UI_MESSAGES.contentProcessed;
            showToast(successMessage, 'success');
          }

          refreshSettings().catch((err) => {
            console.warn('Failed to refresh settings after PROCESSING_COMPLETE:', err);
          });
          break;
        }

        case 'PROCESSING_ERROR':
          if (message?.payload?.fallbackUsed) {
            break;
          }
          dispatch({
            type: 'PROCESSING_ERROR',
            payload: { error: message.payload.error },
          });
          showToast(UI_MESSAGES.processingFailed(message.payload.error), 'error');
          break;

        case 'EXPORT_COMPLETE':
          showToast(UI_MESSAGES.contentExported, 'success');
          break;

        case 'COPY_COMPLETE':
          if (message.payload.success) {
            showToast(UI_MESSAGES.copiedToClipboard, 'success');
          } else {
            (async () => {
              try {
                const data = state.exportData?.markdown || '';
                if (data && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                  await navigator.clipboard.writeText(data);
                  showToast(UI_MESSAGES.copiedToClipboard, 'success');
                } else {
                  showToast(UI_MESSAGES.copyFailed(message.payload.error || 'Unknown error'), 'error');
                }
              } catch (e: any) {
                const errMsg = e?.message || String(e) || 'Unknown error';
                showToast(UI_MESSAGES.copyFailed(errMsg), 'error');
              }
            })();
          }
          break;

        case 'EXPORT_ERROR':
          showToast(UI_MESSAGES.failedToExport, 'error');
          break;

        default:
          break;
      }
    };

    browser.runtime.onMessage.addListener(messageListener);
    return () => browser.runtime.onMessage.removeListener(messageListener);
  }, [refreshSettings, showToast, state.exportData?.markdown]);

  const handleModeToggle = useCallback(async (targetMode?: Settings['mode']) => {
    const settings = await Storage.getSettings();
    const entitlements = resolveEntitlements(settings);

    const newMode = targetMode || (state.mode === 'offline' ? 'ai' : 'offline');

    if (newMode === 'ai') {
      if (!entitlements.flags.aiModeEnabled && !entitlements.flags.developerMode) {
        showToast('AI mode is disabled in settings.', 'info');
        return;
      }

      if (!entitlements.canUseAIMode) {
        if (entitlements.aiLockReason === 'daily_limit_reached') {
          showToast(UI_MESSAGES.dailyLimitReachedInline, 'warning');
        } else if (entitlements.aiLockReason === 'missing_api_key') {
          showToast(UI_MESSAGES.aiModeRequiresApiKey, 'info');
        } else {
          showToast('AI mode is currently unavailable.', 'warning');
        }
        return;
      }
    }

    try {
      await Storage.updateSettings({ mode: newMode });
      dispatch({ type: 'MODE_CHANGED', payload: { mode: newMode } });
      await refreshSettings();
    } catch (error) {
      console.error('Failed to update mode:', error);
      showToast(UI_MESSAGES.failedToUpdateMode, 'error');
    }
  }, [refreshSettings, showToast, state.mode]);

  const onSettingsChange = useCallback(async (partial: Partial<Settings>) => {
    try {
      await Storage.updateSettings(partial);
      await refreshSettings();
      showToast(UI_MESSAGES.settingsSaved, 'success');
    } catch (error) {
      console.error('Failed to save settings:', error);
      showToast(UI_MESSAGES.failedToSaveSettings, 'error');
    }
  }, [refreshSettings, showToast]);

  const onApiKeyChange = useCallback((value: string) => {
    dispatch({ type: 'SET_APIKEY_INPUT', payload: { value } });
  }, []);

  const onApiKeySave = useCallback(async () => {
    try {
      const key = state.apiKeyInput.trim();
      await Storage.setApiKey(key);
      dispatch({ type: 'SET_APIKEY_INPUT', payload: { value: '' } });
      await refreshSettings();
      showToast(UI_MESSAGES.apiKeySaved, 'success');
    } catch (error) {
      console.error('Failed to save API key:', error);
      showToast(UI_MESSAGES.failedToSaveApiKey, 'error');
    }
  }, [refreshSettings, showToast, state.apiKeyInput]);

  const onApiKeyTest = useCallback(async () => {
    try {
      const settings = await Storage.getSettings();
      const key = settings.byok.apiKey;
      if (!key) {
        showToast(UI_MESSAGES.enterAndSaveApiKeyFirst, 'info');
        return;
      }

      if (key.trim() !== '') {
        showToast(UI_MESSAGES.byokConnectionOk, 'success');
      } else {
        showToast(UI_MESSAGES.byokTestFailedGeneric('Invalid API Key'), 'error');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('BYOK test failed:', msg);
      showToast(UI_MESSAGES.byokTestFailedGeneric(msg.slice(0, 120)), 'error');
    }
  }, [showToast]);

  const handleCapture = useCallback(async () => {
    try {
      dispatch({ type: 'CAPTURE_START' });
      dispatch({
        type: 'PROCESSING_PROGRESS',
        payload: { status: 'processing', message: 'Capturing content...', progress: 10 },
      });

      const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
      const tabId = activeTab?.id;
      if (!tabId) {
        throw new Error('No active tab found');
      }

      await browser.runtime.sendMessage({
        type: 'CAPTURE_REQUEST',
        payload: { tabId },
      });
    } catch (error) {
      console.error('Capture failed:', error);
      dispatch({
        type: 'PROCESSING_ERROR',
        payload: { error: error instanceof Error ? error.message : 'Capture failed' },
      });
      showToast(UI_MESSAGES.failedToCapture, 'error');
      throw (error instanceof Error ? error : new Error('Capture failed'));
    }
  }, [showToast]);

  const handleCopy = useCallback(async (content: string) => {
    const text = typeof content === 'string' ? content : '';
    if (!text.trim()) {
      showToast(UI_MESSAGES.noContentToExport, 'error');
      return;
    }

    try {
      if (
        typeof navigator !== 'undefined' &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function'
      ) {
        await navigator.clipboard.writeText(text);
        showToast(UI_MESSAGES.copiedToClipboard, 'success');
        return;
      }
    } catch (error) {
      console.warn('Popup clipboard write failed, delegating to background:', error);
    }

    try {
      await browser.runtime.sendMessage({
        type: 'EXPORT_REQUEST',
        payload: { format: 'md', action: 'copy', content: text },
      });
    } catch (error) {
      console.error('Copy request failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Copy failed';
      showToast(UI_MESSAGES.copyFailed(errorMessage), 'error');
    }
  }, [showToast]);

  const handleExport = useCallback(async (format: 'md' | 'json', action: 'copy' | 'download' = 'download') => {
    if (!state.exportData) {
      showToast(UI_MESSAGES.noContentToExport, 'error');
      return;
    }

    try {
      const content = format === 'md'
        ? state.exportData.markdown
        : JSON.stringify(state.exportData.json, null, 2);
      const filename = `promptready-export.${format}`;

      await browser.runtime.sendMessage({
        type: 'EXPORT_REQUEST',
        payload: { content, filename, format, action },
      });
    } catch (error) {
      console.error('Export failed:', error);
      showToast(UI_MESSAGES.failedToExport, 'error');
    }
  }, [showToast, state.exportData]);

  const handleSetSettingsView = useCallback((view: 'main' | 'byokChoice' | 'byokConfig') => {
    dispatch({ type: 'SET_SETTINGS_VIEW', payload: { view } });
  }, []);

  const handleSetByokProvider = useCallback((provider: 'openrouter') => {
    dispatch({ type: 'SET_BYOK_PROVIDER', payload: { provider } });
  }, []);

  const isProcessing =
    state.processing.status === 'capturing' ||
    state.processing.status === 'cleaning' ||
    state.processing.status === 'structuring' ||
    state.processing.status === 'exporting' ||
    state.processing.status === 'processing';

  const hasContent = !!state.exportData?.markdown;

  return {
    state,
    isProcessing,
    hasContent,
    handleModeToggle,
    handleCapture,
    handleCopy,
    handleExport,
    onSettingsChange,
    onApiKeyChange,
    onApiKeySave,
    onApiKeyTest,
    handleSetSettingsView,
    handleSetByokProvider,
    showToast,
  };
}
