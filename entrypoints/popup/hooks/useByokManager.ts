// BYOK Management Hook
// Focused hook for managing API keys and provider configurations

import { useState, useCallback, useEffect } from 'react';
import { Storage } from '@/lib/storage';
import { validateApiKey, debouncedValidateApiKey } from '@/lib/api-validation';
import type { Settings } from '@/lib/types';

export interface ByokState {
  provider: 'openrouter' | 'manual' | 'z.ai';
  apiKey: string;
  apiBase: string;
  selectedModel: string;
  hasApiKey: boolean;
  isValid: boolean;
  isValidationInProgress: boolean;
  validationMessage: string;
}

export interface ByokActions {
  setProvider: (provider: ByokState['provider']) => void;
  setApiKey: (apiKey: string) => void;
  setApiBase: (apiBase: string) => void;
  setSelectedModel: (model: string) => void;
  validateConfiguration: () => Promise<void>;
  saveConfiguration: () => Promise<void>;
  clearConfiguration: () => Promise<void>;
  testCurrentConfiguration: () => Promise<void>;
}

const DEFAULT_PROVIDERS = {
  openrouter: {
    apiBase: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-3.5-sonnet',
  },
  manual: {
    apiBase: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4',
  },
  'z.ai': {
    apiBase: 'https://api.z.ai/v1',
    defaultModel: 'z.ai-flash',
  },
};

export function useByokManager(): ByokState & ByokActions {
  const [state, setState] = useState<ByokState>({
    provider: 'openrouter',
    apiKey: '',
    apiBase: DEFAULT_PROVIDERS.openrouter.apiBase,
    selectedModel: DEFAULT_PROVIDERS.openrouter.defaultModel,
    hasApiKey: false,
    isValid: false,
    isValidationInProgress: false,
    validationMessage: '',
  });

  // Load initial state from storage
  useEffect(() => {
    const loadFromStorage = async () => {
      try {
        const settings = await Storage.getSettings();
        const byokConfig = settings.byok;

        if (byokConfig) {
          setState(prev => ({
            ...prev,
            provider: byokConfig.provider || 'openrouter',
            apiKey: byokConfig.apiKey || '',
            apiBase: byokConfig.apiBase || DEFAULT_PROVIDERS[byokConfig.provider || 'openrouter'].apiBase,
            selectedModel: byokConfig.selectedByokModel || DEFAULT_PROVIDERS[byokConfig.provider || 'openrouter'].defaultModel,
            hasApiKey: Boolean(byokConfig.apiKey),
          }));
        }
      } catch (error) {
        console.error('Failed to load BYOK configuration:', error);
      }
    };

    loadFromStorage();
  }, []);

  // Update defaults when provider changes
  const setProvider = useCallback((provider: ByokState['provider']) => {
    setState(prev => {
      const providerDefaults = DEFAULT_PROVIDERS[provider];
      return {
        ...prev,
        provider,
        apiBase: providerDefaults.apiBase,
        selectedModel: providerDefaults.defaultModel,
        isValid: false,
        validationMessage: '',
      };
    });
  }, []);

  const setApiKey = useCallback((apiKey: string) => {
    setState(prev => ({
      ...prev,
      apiKey,
      hasApiKey: Boolean(apiKey),
      isValid: false,
      validationMessage: '',
    }));

    // Debounced validation
    if (apiKey) {
      debouncedValidateApiKey({
        provider: state.provider,
        apiKey,
        apiBase: state.apiBase,
      }).then(result => {
        setState(prev => ({
          ...prev,
          isValid: result.isValid,
          validationMessage: result.message,
        }));
      });
    }
  }, [state.provider, state.apiBase]);

  const setApiBase = useCallback((apiBase: string) => {
    setState(prev => ({
      ...prev,
      apiBase,
      isValid: false,
      validationMessage: '',
    }));
  }, []);

  const setSelectedModel = useCallback((selectedModel: string) => {
    setState(prev => ({
      ...prev,
      selectedModel,
    }));
  }, []);

  const validateConfiguration = useCallback(async () => {
    if (!state.apiKey) {
      setState(prev => ({
        ...prev,
        isValid: false,
        validationMessage: 'Please enter an API key',
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      isValidationInProgress: true,
    }));

    try {
      const result = await validateApiKey({
        provider: state.provider,
        apiKey: state.apiKey,
        apiBase: state.apiBase,
      });

      setState(prev => ({
        ...prev,
        isValid: result.isValid,
        validationMessage: result.message,
        isValidationInProgress: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isValid: false,
        validationMessage: 'Validation failed. Please try again.',
        isValidationInProgress: false,
      }));
    }
  }, [state.provider, state.apiKey, state.apiKey]);

  const saveConfiguration = useCallback(async () => {
    if (!state.isValid) {
      await validateConfiguration();
      if (!state.isValid) return;
    }

    try {
      await Storage.updateSettings({
        byok: {
          provider: state.provider,
          apiKey: state.apiKey,
          apiBase: state.apiBase,
          selectedByokModel: state.selectedModel,
        },
        isPro: true,
        trial: { hasExhausted: false, showUpgradePrompt: false },
      });

      setState(prev => ({
        ...prev,
        validationMessage: '✅ Configuration saved successfully',
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        validationMessage: 'Failed to save configuration. Please try again.',
      }));
      throw error;
    }
  }, [state.provider, state.apiKey, state.apiBase, state.selectedModel, state.isValid, validateConfiguration]);

  const clearConfiguration = useCallback(async () => {
    try {
      await Storage.clearApiKey();
      setState(prev => ({
        ...prev,
        apiKey: '',
        hasApiKey: false,
        isValid: false,
        validationMessage: '',
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        validationMessage: 'Failed to clear configuration.',
      }));
      throw error;
    }
  }, []);

  const testCurrentConfiguration = useCallback(async () => {
    if (!state.hasApiKey) {
      setState(prev => ({
        ...prev,
        validationMessage: 'No API key configured',
      }));
      return;
    }

    await validateConfiguration();
  }, [state.hasApiKey, validateConfiguration]);

  return {
    ...state,
    setProvider,
    setApiKey,
    setApiBase,
    setSelectedModel,
    validateConfiguration,
    saveConfiguration,
    clearConfiguration,
    testCurrentConfiguration,
  };
}