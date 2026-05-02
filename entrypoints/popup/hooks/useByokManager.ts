// BYOK Management Hook
// Focused hook for managing API keys and provider configurations

import { useState, useCallback, useEffect } from 'react';
import { Storage } from '@/lib/storage';
import { validateApiKey, debouncedValidateApiKey } from '@/lib/api-validation';

export interface ByokState {
  provider: 'openrouter';
  apiKey: string;
  apiBase: string;
  selectedModel: string;
  hasApiKey: boolean;
  isValid: boolean;
  isValidationInProgress: boolean;
  validationMessage: string;
}

export interface ByokActions {
  setProvider: (provider: 'openrouter') => void;
  setApiKey: (apiKey: string) => void;
  setApiBase: (apiBase: string) => void;
  setSelectedModel: (model: string) => void;
  validateConfiguration: () => Promise<boolean>;
  saveConfiguration: () => Promise<void>;
  clearConfiguration: () => Promise<void>;
  testCurrentConfiguration: () => Promise<void>;
}

const DEFAULT_PROVIDERS = {
  openrouter: {
    apiBase: 'https://openrouter.ai/api/v1',
    defaultModel: '',
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
          const apiKey = (byokConfig.apiKey || '').trim();
          setState(prev => ({
            ...prev,
            provider: 'openrouter',
            apiKey,
            apiBase: byokConfig.apiBase?.trim() || DEFAULT_PROVIDERS.openrouter.apiBase,
            selectedModel: byokConfig.selectedByokModel || byokConfig.model || DEFAULT_PROVIDERS.openrouter.defaultModel,
            hasApiKey: Boolean(apiKey),
          }));
        }
      } catch (error) {
        console.error('Failed to load BYOK configuration:', error);
      }
    };

    loadFromStorage();
  }, []);

  // Update defaults when provider changes
  const setProvider = useCallback((_provider: 'openrouter') => {
    // OpenRouter-only workflow: retain API compatibility while forcing canonical provider.
    setState(prev => ({
      ...prev,
      provider: 'openrouter',
      apiBase: DEFAULT_PROVIDERS.openrouter.apiBase,
      selectedModel: DEFAULT_PROVIDERS.openrouter.defaultModel,
      isValid: false,
      validationMessage: '',
    }));
  }, []);

  const setApiKey = useCallback((apiKey: string) => {
    const normalizedApiKey = apiKey.trim();
    setState(prev => ({
      ...prev,
      apiKey: normalizedApiKey,
      hasApiKey: Boolean(normalizedApiKey),
      isValid: false,
      validationMessage: '',
    }));

    // Debounced validation
    if (normalizedApiKey) {
      debouncedValidateApiKey({
        provider: state.provider,
        apiKey: normalizedApiKey,
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
    const apiKey = state.apiKey.trim();
    const apiBase = state.apiBase.trim();

    if (!apiKey) {
      setState(prev => ({
        ...prev,
        isValid: false,
        validationMessage: 'Please enter an API key',
      }));
      return false;
    }

    if (!state.selectedModel.trim()) {
      setState(prev => ({
        ...prev,
        isValid: false,
        validationMessage: 'Please select an OpenRouter model',
      }));
      return false;
    }

    setState(prev => ({
      ...prev,
      isValidationInProgress: true,
    }));

    try {
      const result = await validateApiKey({
        provider: state.provider,
        apiKey,
        apiBase,
      });

      setState(prev => ({
        ...prev,
        isValid: result.isValid,
        validationMessage: result.message,
        isValidationInProgress: false,
      }));
      return result.isValid;
    } catch {
      setState(prev => ({
        ...prev,
        isValid: false,
        validationMessage: 'Validation failed. Please try again.',
        isValidationInProgress: false,
      }));
      return false;
    }
  }, [state.provider, state.apiKey, state.apiBase, state.selectedModel]);

  const saveConfiguration = useCallback(async () => {
    const isValid = state.isValid || await validateConfiguration();
    if (!isValid) {
      return;
    }

    try {
      await Storage.updateSettings({
        byok: {
          provider: state.provider,
          apiKey: state.apiKey.trim(),
          apiBase: state.apiBase.trim(),
          model: state.selectedModel.trim(),
          selectedByokModel: state.selectedModel.trim(),
        },
      });

      setState(prev => ({
        ...prev,
        validationMessage: 'Configuration saved successfully',
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
