// Custom hook for popup controller logic
// Separates UI logic from presentation for clean architecture

import { useReducer, useEffect, useCallback } from 'react';
import { getUserId } from '@/lib/user';
import { browser } from 'wxt/browser';
import { Storage } from '@/lib/storage';
import type { Settings, CreditsState, UserState, TrialState } from '@/lib/types';
import { BYOKClient } from '@/pro/byok-client';
import { MonetizationClient } from '@/pro/monetization-client';
import { ExperimentationClient, type CohortAssignment } from '@/pro/experimentation-client';
import UI_MESSAGES from '@/lib/ui-messages';

// State types
interface PopupState {
  mode: 'offline' | 'ai';
  isPro: boolean;
  settings?: Settings;
  credits?: CreditsState;
  user?: UserState;
  trial?: TrialState;
  cohort?: CohortAssignment;
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
    pipelineUsed?: 'standard' | 'intelligent-bypass';
  } | null;
  toast: {
    message: string;
    type: 'success' | 'error' | 'info';
  } | null;
  showUpgrade: boolean;
}

// Action types
type PopupAction =
  | { type: 'SETTINGS_LOADED'; payload: { settings: Settings } }
  | { type: 'SETTINGS_UPDATED'; payload: { settings: Settings } }
  | { type: 'CREDITS_UPDATED'; payload: { credits: CreditsState } }
  | { type: 'COHORT_UPDATED'; payload: { cohort: CohortAssignment } }
  | { type: 'SET_APIKEY_INPUT'; payload: { value: string } }
  | { type: 'MODE_CHANGED'; payload: { mode: 'offline' | 'ai' } }
  | { type: 'CAPTURE_START' }
  | { type: 'PROCESSING_PROGRESS'; payload: { status: string; message?: string; progress?: number } }
  | { type: 'PROCESSING_COMPLETE'; payload: { markdown: string; json: any; metadata: any; qualityReport?: any; stats?: any } }
  | { type: 'PROCESSING_ERROR'; payload: { error: string } }
  | { type: 'SHOW_TOAST'; payload: { message: string; type: 'success' | 'error' | 'info' } }
  | { type: 'HIDE_TOAST' }
  | { type: 'SHOW_UPGRADE' }
  | { type: 'HIDE_UPGRADE' };

// Reducer function
function popupReducer(state: PopupState, action: PopupAction): PopupState {
  switch (action.type) {
    case 'SETTINGS_LOADED': {
      const { settings } = action.payload;
      const flags = settings.flags || { aiModeEnabled: false, byokEnabled: true, trialEnabled: false };
      const effectiveMode = flags.aiModeEnabled ? settings.mode : 'offline';
      const hasApiKey = Boolean(settings.byok?.apiKey);
      // "Pro" is having a BYOK key or having credits in the new system
      const isPro = hasApiKey || (settings.credits?.remaining || 0) > 0;

      return {
        ...state,
        mode: effectiveMode,
        isPro,
        settings,
        credits: settings.credits,
        user: settings.user,
        trial: settings.trial,
        hasApiKey,
        apiKeyInput: '',
      };
    }
    case 'CREDITS_UPDATED': {
      const credits = action.payload.credits;
      const hasExhausted = credits.remaining <= 0;
      return {
        ...state,
        credits: credits,
        trial: {
          ...state.trial,
          hasExhausted: hasExhausted,
        },
        isPro: state.hasApiKey || !hasExhausted,
      };
    }
    case 'COHORT_UPDATED': {
      return {
        ...state,
        cohort: action.payload.cohort,
      };
    }

    case 'SETTINGS_UPDATED': {
      const { settings } = action.payload;
      const hasApiKey = Boolean(settings.byok?.apiKey);
      const isPro = hasApiKey || (settings.credits?.remaining || 0) > 0;

      return {
        ...state,
        settings,
        isPro,
        credits: settings.credits,
        user: settings.user,
        trial: settings.trial,
        hasApiKey,
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

    case 'PROCESSING_COMPLETE': {
      const remainingCredits = action.payload.metadata?.remainingCredits;
      const newCredits: CreditsState | undefined = remainingCredits !== undefined ? {
        ...state.credits!,
        remaining: remainingCredits,
      } : state.credits;

      const hasExhausted = newCredits ? newCredits.remaining <= 0 : true;

      // Preserve pipelineUsed from payload.stats if present
      const pipelineUsed = (action.payload as any)?.stats?.pipelineUsed;

      return {
        ...state,
        processing: { status: 'complete' },
        exportData: { ...action.payload, pipelineUsed },
        credits: newCredits,
        trial: {
          ...state.trial,
          hasExhausted: hasExhausted,
        },
        isPro: state.hasApiKey || !hasExhausted,
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
  credits: undefined,
  user: undefined,
  trial: undefined,
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
    const loadInitialData = async () => {
      try {
        const settings = await Storage.getSettings();
        dispatch({ type: 'SETTINGS_LOADED', payload: { settings } });

        const userId = await getUserId();
        if (userId) {
          // Store user ID in settings if it's not already there
          if (!settings.user?.id) {
            await Storage.updateSettings({ user: { id: userId } });
            const updatedSettings = await Storage.getSettings();
            dispatch({ type: 'SETTINGS_UPDATED', payload: { settings: updatedSettings } });
          }

          // Only query the credit system for non-BYOK users (BYOK implies paid)
          if (!settings.byok?.apiKey) {
            try {
              const creditStatus = await MonetizationClient.checkCredits(userId);
              const credits: CreditsState = {
                remaining: creditStatus.balance,
                total: settings.credits?.total || 150, // sensible default total if not present
                lastReset: settings.credits?.lastReset || new Date().toISOString(),
              };
              // Dispatch credits update so reducer can recalculate isPro
              dispatch({ type: 'CREDITS_UPDATED', payload: { credits } });
            } catch (creditErr) {
              console.warn('Failed to fetch credits:', creditErr);
              // Do not block startup on credit fetch failure; show a non-blocking toast
              showToast(UI_MESSAGES.failedToLoadSettings, 'info');
            }
          }

          const cohort = await ExperimentationClient.getCohort(userId);
          dispatch({ type: 'COHORT_UPDATED', payload: { cohort } });
        }
      } catch (error) {
        console.error('Failed to load settings or extras:', error);
        showToast(UI_MESSAGES.failedToLoadSettings, 'error');
      }
    };

    loadInitialData();
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
          // Show a dynamic success message when intelligent-bypass pipeline was used
          const pipeline = (message?.payload as any)?.stats?.pipelineUsed;
          const successMessage = pipeline === 'intelligent-bypass'
            ? UI_MESSAGES.intelligentBypassSuccess
            : UI_MESSAGES.contentProcessed;
          showToast(successMessage, 'success');

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
          showToast(UI_MESSAGES.processingFailed(message.payload.error), 'error');
          break;

        case 'EXPORT_COMPLETE':
          showToast(UI_MESSAGES.contentExported, 'success');
          break;

        case 'COPY_COMPLETE':
          if (message.payload.success) {
            showToast(UI_MESSAGES.copiedToClipboard, 'success');
          } else {
            showToast(UI_MESSAGES.copyFailed(message.payload.error || 'Unknown error'), 'error');
          }
          break;

        case 'EXPORT_ERROR':
          showToast(UI_MESSAGES.failedToExport, 'error');
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
      showToast(UI_MESSAGES.failedToLoadSettings, 'info');
      return;
    }

    const newMode = state.mode === 'offline' ? 'ai' : 'offline';

    // Gate AI mode behind Pro/BYOK/Trial for Phase 2
    if (newMode === 'ai' && !state.isPro && state.trial?.hasExhausted) {
      dispatch({ type: 'SHOW_UPGRADE' });
      return;
    }

    try {
      await Storage.updateSettings({ mode: newMode });
      dispatch({ type: 'MODE_CHANGED', payload: { mode: newMode } });
      showToast(UI_MESSAGES.switchedToMode(newMode), 'success');
    } catch (error) {
      console.error('Failed to update mode:', error);
      showToast(UI_MESSAGES.failedToUpdateMode, 'error');
    }
  }, [state.mode, state.isPro, state.trial, showToast]);

  const onSettingsChange = useCallback(async (partial: Partial<Settings>) => {
    try {
      await Storage.updateSettings(partial);
      const updated = await Storage.getSettings();
      dispatch({ type: 'SETTINGS_UPDATED', payload: { settings: updated } });
      showToast(UI_MESSAGES.settingsSaved, 'success');
    } catch (error) {
      console.error('Failed to save settings:', error);
      showToast(UI_MESSAGES.failedToSaveSettings, 'error');
    }
  }, [showToast]);

  const onApiKeyChange = useCallback((value: string) => {
    dispatch({ type: 'SET_APIKEY_INPUT', payload: { value } });
  }, []);

  const onApiKeySave = useCallback(async () => {
    try {
      const key = state.apiKeyInput.trim();
      await Storage.setApiKey(key);
      const updated = await Storage.getSettings();
      dispatch({ type: 'SETTINGS_UPDATED', payload: { settings: updated } });
      showToast(UI_MESSAGES.apiKeySaved, 'success');
    } catch (error) {
      console.error('Failed to save API key:', error);
      showToast(UI_MESSAGES.failedToSaveApiKey, 'error');
    }
  }, [state.apiKeyInput, showToast]);

  const onApiKeyTest = useCallback(async () => {
    try {
      const settings = await Storage.getSettings();
      const key = settings.byok.apiKey;
      if (!key) {
        showToast(UI_MESSAGES.enterAndSaveApiKeyFirst, 'info');
        return;
      }
      const result = await BYOKClient.makeRequest(
        { prompt: 'ping', maxTokens: 4, temperature: 0 },
        { apiBase: settings.byok.apiBase, apiKey: key, model: settings.byok.selectedByokModel || settings.byok.model }, // Use selected model or fallback to default
        { requireExplicitConsent: false }
      );
      if (result.content) {
        showToast(UI_MESSAGES.byokConnectionOk, 'success');
      } else {
        showToast(UI_MESSAGES.byokTestNoContent, 'info');
      }
    } catch (error) {
      const msg = (error instanceof Error ? error.message : String(error));
      console.error('BYOK test failed:', msg);

      const lower = msg.toLowerCase();

      // Timeout / aborts
      if (lower.includes('timed out') || lower.includes('timeout') || lower.includes('abort')) {
        showToast(UI_MESSAGES.byokTestTimeout, 'error');

      // Network connectivity issues (fetch failed / DNS / offline)
      } else if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('could not connect') || lower.includes('connection error')) {
        showToast(UI_MESSAGES.connectionError, 'error');

      // Service capacity / 5xx responses
      } else if (msg.includes('503') || msg.includes('502') || lower.includes('service temporarily') || lower.includes('temporarily unavailable') || lower.includes('service unavailable') || lower.includes('capacity')) {
        showToast(UI_MESSAGES.serviceTemporarilyUnavailable, 'error');

      // Authorization / invalid key
      } else if (msg.includes('401') || lower.includes('unauthorized') || lower.includes('invalid api key')) {
        showToast(UI_MESSAGES.byokTestUnauthorized, 'error');

      // Rate limiting
      } else if (msg.includes('429') || lower.includes('rate') || lower.includes('rate limited')) {
        showToast(UI_MESSAGES.byokTestRateLimited, 'error');

      // Model list / OpenRouter-specific model fetch failures
      } else if (lower.includes('could not fetch') || lower.includes("couldn't fetch") || (lower.includes('models') && lower.includes('fetch'))) {
        showToast(UI_MESSAGES.modelFetchFailed, 'error');

      // Fallback: show a truncated generic message
      } else {
        showToast(UI_MESSAGES.byokTestFailedGeneric(msg.slice(0, 120)), 'error');
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
      showToast(UI_MESSAGES.failedToCapture, 'error');
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
      showToast(UI_MESSAGES.copyFailed(errorMessage), 'error');
    }
  }, [showToast]);

  const handleExport = useCallback(async (format: 'md' | 'json', action: 'copy' | 'download' = 'download') => {
    if (!state.exportData) {
      showToast(UI_MESSAGES.noContentToExport, 'error');
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
      showToast(UI_MESSAGES.failedToExport, 'error');
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
