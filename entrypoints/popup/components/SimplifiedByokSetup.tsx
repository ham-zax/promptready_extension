import React, { useState, useEffect } from 'react';
import { Settings } from '@/lib/types';
import { Storage } from '@/lib/storage';
import { validateApiKey } from '@/lib/api-validation';

interface SimplifiedByokSetupProps {
  settings: Settings;
  onComplete: () => void;
  onCancel: () => void;
}

type Provider = 'openrouter' | 'manual' | 'z.ai';

type ProviderInfo = {
  name: string;
  description: string;
  icon: string;
  placeholder: string;
  defaultBase: string;
  fixedBase?: boolean;
};


export function SimplifiedByokSetup({ settings, onComplete, onCancel }: SimplifiedByokSetupProps) {
  const [provider, setProvider] = useState<Provider>('openrouter');
  const [apiKey, setApiKey] = useState('');
  const [apiBase, setApiBase] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<{
    isValid: boolean;
    message: string;
  } | null>(null);

  const providers: Record<Provider, ProviderInfo> = {
    openrouter: {
      name: 'OpenRouter',
      description: 'Access multiple AI models through one API',
      icon: '🌐',
      placeholder: 'sk-or-v1-...',
      defaultBase: 'https://openrouter.ai/api/v1',
    },
    manual: {
      name: 'OpenAI Compatible',
      description: 'Use any OpenAI-compatible API',
      icon: '🔧',
      placeholder: 'sk-...',
      defaultBase: 'https://api.openai.com/v1',
    },
    'z.ai': {
      name: 'Z.AI',
      description: 'Fast and affordable AI API',
      icon: '⚡',
      placeholder: 'Enter your Z.AI API key',
      defaultBase: 'https://api.z.ai/v1',
      fixedBase: true,
    },
  };

  useEffect(() => {
    const currentProvider = providers[provider];
    if (!currentProvider.fixedBase) {
      setApiBase(currentProvider.defaultBase);
    }
  }, [provider]);

  const handleValidate = async () => {
    if (!apiKey.trim()) {
      setValidationStatus({ isValid: false, message: 'Please enter an API key' });
      return;
    }

    setIsValidating(true);
    setValidationStatus(null);

    try {
      const result = await validateApiKey({
        provider,
        apiKey,
        apiBase: provider === 'z.ai' ? providers['z.ai'].defaultBase : apiBase,
      });

      setValidationStatus(result);
    } catch (error) {
      setValidationStatus({
        isValid: false,
        message: 'Validation failed. Please check your API key and connection.',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = async () => {
    if (!validationStatus?.isValid) {
      await handleValidate();
      if (!validationStatus?.isValid) return;
    }

    try {
      const selectedModel = provider === 'openrouter' ? 'anthropic/claude-3.5-sonnet' :
                           provider === 'manual' ? 'gpt-4' : 'z.ai-flash';
      
      await Storage.updateSettings({
        byok: {
          provider,
          apiKey,
          apiBase: provider === 'z.ai' ? providers['z.ai'].defaultBase : apiBase,
          model: selectedModel,
          selectedByokModel: selectedModel,
        },
        isPro: true,
        trial: { ...settings.trial, hasExhausted: false, showUpgradePrompt: false },
      });

      onComplete();
    } catch (error) {
      console.error('Failed to save API settings:', error);
      setValidationStatus({
        isValid: false,
        message: 'Failed to save settings. Please try again.',
      });
    }
  };

  const currentProvider = providers[provider];

  return (
    <div className="bg-white rounded-lg p-6 max-w-md mx-auto shadow-lg">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-xl">🤖</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Connect Your AI Provider
        </h2>
        <p className="text-sm text-gray-600">
          Use your own API key for unlimited AI processing
        </p>
      </div>

      {/* Provider Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Choose your AI provider
        </label>
        <div className="grid grid-cols-1 gap-2">
          {Object.entries(providers).map(([key, providerInfo]) => (
            <button
              key={key}
              onClick={() => setProvider(key as Provider)}
              className={`p-3 rounded-lg border-2 transition-all text-left ${
                provider === key
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className="text-lg">{providerInfo.icon}</span>
                <div>
                  <div className="font-medium text-gray-900">{providerInfo.name}</div>
                  <div className="text-xs text-gray-600">{providerInfo.description}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* API Configuration */}
      <div className="space-y-4 mb-6">
        {/* API Key */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={currentProvider.placeholder}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* API Base URL */}
        {!currentProvider.fixedBase && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Base URL
            </label>
            <input
              type="url"
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              placeholder={currentProvider.defaultBase}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}

        {/* Validation Status */}
        {validationStatus && (
          <div className={`p-3 rounded-md text-sm ${
            validationStatus.isValid
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {validationStatus.message}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex space-x-3">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>

        <button
          onClick={handleValidate}
          disabled={!apiKey.trim() || isValidating}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isValidating ? 'Validating...' : 'Test Connection'}
        </button>

        <button
          onClick={handleSave}
          disabled={!validationStatus?.isValid}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Connect & Start
        </button>
      </div>

      {/* Help Text */}
      <div className="mt-4 text-center">
        <p className="text-xs text-gray-500">
          Your API key is stored locally and never shared with PromptReady servers
        </p>
      </div>
    </div>
  );
}