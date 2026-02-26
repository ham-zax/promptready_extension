import React, { useState } from 'react';
import { Settings } from '@/lib/types';
import { Storage } from '@/lib/storage';
import { validateApiKey } from '@/lib/api-validation';
import { Globe, Bot } from 'lucide-react';

interface SimplifiedByokSetupProps {
  settings: Settings;
  onComplete: () => void;
  onCancel: () => void;
}

type Provider = 'openrouter';

type ProviderInfo = {
  name: string;
  description: string;
  icon: React.ReactNode;
  placeholder: string;
  defaultBase: string;
  fixedBase?: boolean;
};

const PROVIDERS: Record<Provider, ProviderInfo> = {
  openrouter: {
    name: 'OpenRouter',
    description: 'Access multiple AI models through one API',
    icon: <Globe className="w-5 h-5 text-blue-500" />,
    placeholder: 'sk-or-v1-...',
    defaultBase: 'https://openrouter.ai/api/v1',
  },
};

export function SimplifiedByokSetup({ settings, onComplete, onCancel }: SimplifiedByokSetupProps) {
  const provider: Provider = 'openrouter';
  const [apiKey, setApiKey] = useState('');
  const [apiBase] = useState('https://openrouter.ai/api/v1');
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<{
    isValid: boolean;
    message: string;
  } | null>(null);

  const handleValidate = async () => {
    if (!apiKey.trim()) {
      setValidationStatus({ isValid: false, message: 'Please enter an API key' });
      return;
    }

    setIsValidating(true);
    setValidationStatus(null);

    try {
      const result = await validateApiKey({
        provider: 'openrouter',
        apiKey,
        apiBase,
      });

      setValidationStatus(result);
    } catch {
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
      const selectedModel = 'arcee-ai/trinity-large-preview:free';

      await Storage.updateSettings({
        byok: {
          provider: 'openrouter',
          apiKey,
          apiBase: 'https://openrouter.ai/api/v1',
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

  const currentProvider = PROVIDERS[provider];

  return (
    <div className="bg-white rounded-xl p-6 max-w-md mx-auto shadow-sm border border-gray-100">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-brand-surface text-brand-primary rounded-full flex items-center justify-center mx-auto mb-3 border border-brand-border">
          <Bot className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">
          Connect Your AI Provider
        </h2>
        <p className="text-xs text-gray-500">
          Use your own API key for unlimited AI processing
        </p>
      </div>

      {/* Provider Selection (OpenRouter-only) */}
      <div className="mb-6">
        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">
          AI Provider
        </label>
        <div className="p-3 rounded-xl border border-brand-primary bg-brand-surface shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-white transition-colors">
              {currentProvider.icon}
            </div>
            <div>
              <div className="font-semibold text-sm text-brand-primary">{currentProvider.name}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">{currentProvider.description}</div>
            </div>
          </div>
        </div>
      </div>

      {/* API Configuration */}
      <div className="space-y-4 mb-6">
        {/* API Key */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={currentProvider.placeholder}
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-all shadow-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            API Base URL
          </label>
          <input
            type="url"
            value={apiBase}
            readOnly
            className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-600 cursor-not-allowed"
          />
        </div>

        {/* Validation Status */}
        {validationStatus && (
          <div className={`p-3 rounded-lg text-sm font-medium animate-in fade-in duration-200 ${validationStatus.isValid
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
            {validationStatus.message}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col space-y-2">
        <button
          onClick={handleSave}
          disabled={!validationStatus?.isValid}
          className="w-full py-2.5 bg-brand-primary text-brand-primary-foreground font-semibold rounded-lg hover:opacity-90 active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          Connect & Start
        </button>

        <div className="flex space-x-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 bg-white border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 active:scale-[0.98] transition-all text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleValidate}
            disabled={!apiKey.trim() || isValidating}
            className="flex-1 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all text-sm"
          >
            {isValidating ? 'Validating...' : 'Test Connection'}
          </button>
        </div>
      </div>

      {/* Help Text */}
      <div className="mt-5 pt-4 border-t border-gray-100 text-center">
        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
          Your API key is stored locally
        </p>
      </div>
    </div>
  );
}
