// BYOK (Bring Your Own Key) Settings Component
// Handles AI configuration including API keys, models, and providers

import React, { useState, useEffect } from 'react';
import { Settings } from '@/lib/types';
import { ModelSelect } from './ModelSelect';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';

type Provider = 'openrouter' | 'manual' | 'z.ai';

interface ByokSettingsProps {
  settings: Settings;
  onSettingsChange: (settings: Partial<Settings>) => void;
  onApiKeyChange: (apiKey: string) => void;
  onApiKeySave: () => void;
  onApiKeyTest: () => void;
  hasApiKey: boolean;
  apiKeyInput: string;
  provider?: Provider;
}


export function ByokSettings({
  settings,
  onSettingsChange,
  onApiKeyChange,
  onApiKeySave,
  onApiKeyTest,
  hasApiKey,
  apiKeyInput,
  provider,
}: ByokSettingsProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [localProvider, setLocalProvider] = useState<Provider | null>(
    provider ?? (settings.byok?.provider as Provider) ?? null
  );

  const DEFAULTS: Record<Provider, { apiBase: string; model: string }> = {
    openrouter: { apiBase: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-3.5-sonnet' },
    manual: { apiBase: 'https://api.openai.com/v1', model: 'gpt-4' },
    'z.ai': { apiBase: 'https://api.z.ai/v1', model: 'z.ai-flash' },
  };

  const chooseProvider = (p: Provider) => {
    setLocalProvider(p);
    const d = DEFAULTS[p];
    onSettingsChange({
      byok: {
        ...settings.byok,
        provider: p,
        apiBase: d.apiBase,
        selectedByokModel: d.model,
      },
    });
  };

  const pv = localProvider ?? provider ?? (settings.byok?.provider as Provider) ?? null;

  // Header
  const header = (
    <div className="flex items-center space-x-2">
      <span className="text-sm">🤖</span>
      <h4 className="font-medium text-gray-800">AI Configuration</h4>
      {settings.isPro && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-500 to-pink-500 text-white">
          Pro
        </span>
      )}
    </div>
  );

  // Provider choice view (shown when provider not set)
  if (!pv) {
    return (
      <div className="space-y-3">
        {header}
        <div className="text-center">
          <h3 className="font-semibold text-gray-900 mb-4">Connect your AI Provider</h3>
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => chooseProvider('openrouter')}
              className="w-full py-2 px-4 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
            >
              OpenRouter
            </button>
            <button
              onClick={() => chooseProvider('manual')}
              className="w-full py-2 px-4 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
            >
              Manual
            </button>
            <button
              onClick={() => chooseProvider('z.ai')}
              className="w-full py-2 px-4 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
            >
              Z.AI
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {header}

      {(settings.isPro || settings.flags?.byokEnabled) ? (
        <div className="space-y-3 pl-6">
            <label className="block text-sm font-medium text-gray-700">
              API Key ({pv === 'openrouter' ? 'OpenRouter' : pv === 'z.ai' ? 'Z.AI' : 'Manual'})
            </label>
            <div className="flex space-x-2">
              <div className="flex-1 relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => onApiKeyChange(e.target.value)}
                  placeholder={hasApiKey ? '••••••••••••••••' : 'Enter your API key'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                >
                  {showApiKey ? '🙈' : '👁️'}
                </button>
              </div>
              <button
                onClick={onApiKeySave}
                disabled={!apiKeyInput.trim()}
                className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Save
              </button>
            </div>

          {pv === 'manual' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                API Base URL
              </label>
              <input
                type="text"
                value={settings.byok.apiBase || ''}
                onChange={(e) => onSettingsChange({ byok: { ...settings.byok, apiBase: e.target.value } })}
                placeholder="e.g., https://api.openai.com/v1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {pv === 'z.ai' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                API Base URL
              </label>
              <input
                type="text"
                value="https://api.z.ai/v1"
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-100 cursor-not-allowed"
              />
            </div>
          )}

          {hasApiKey && pv === 'openrouter' && (
            <div className="space-y-2">
              <label htmlFor="model-select" className="block text-sm font-medium text-gray-700">
                Model
              </label>
              <ModelSelect
                value={settings.byok.selectedByokModel || settings.byok.model || ''}
                onChange={(v: string) => onSettingsChange({ byok: { ...settings.byok, selectedByokModel: v } })}
                apiBase={settings.byok.apiBase}
              />
            </div>
          )}

          {hasApiKey && pv === 'manual' && (
            <div className="space-y-2">
              <label htmlFor="model-select-manual" className="block text-sm font-medium text-gray-700">
                Model
              </label>
              <select
                id="model-select-manual"
                value={settings.byok.selectedByokModel || settings.byok.model}
                onChange={(e) => onSettingsChange({ byok: { ...settings.byok, selectedByokModel: e.target.value } })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {/* Hardcoded models for Manual provider fallback */}
                <option value="llama-3.1-8b-instant">Llama 3.1 8B Instant</option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
              </select>
            </div>
          )}

          {hasApiKey && pv === 'z.ai' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Model
              </label>
              <input
                type="text"
                value="z.ai-flash"
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-100 cursor-not-allowed"
              />
            </div>
          )}

          {/* Test Button */}
          {hasApiKey && (
            <button
              onClick={onApiKeyTest}
              className="w-full px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
            >
              Test API Connection
            </button>
          )}

          {/* Remove Key (destructive) */}
          {hasApiKey && (
            <div className="mt-2">
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    className="w-full px-3 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors"
                  >
                    Remove Key
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogTitle>Remove API Key?</DialogTitle>
                  <DialogDescription>
                    Are you sure? This will remove your key and revert you to the free plan.
                  </DialogDescription>
                  <DialogFooter>
                    <DialogClose asChild>
                      <button className="px-3 py-2 bg-gray-200 rounded-md">Cancel</button>
                    </DialogClose>
                    <button
                      onClick={() => {
                        onSettingsChange({ byok: { ...settings.byok, apiKey: '' } });
                        onApiKeyChange('');
                      }}
                      className="px-3 py-2 bg-red-600 text-white rounded-md"
                    >
                      Confirm & Remove
                    </button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      ) : (
        <div className="pl-6 py-3 bg-purple-50 rounded-md border border-purple-200">
          <p className="text-sm text-purple-700 mb-2">
            BYOK is available but Pro features are locked. Enter your key to enable AI Mode.
          </p>
          <p className="text-xs text-purple-600">
            Use your own OpenAI or OpenRouter API key for enhanced processing
          </p>
        </div>
      )}
    </div>
  );
}
