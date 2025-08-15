// BYOK (Bring Your Own Key) Settings Component
// Handles AI configuration including API keys, models, and providers

import React, { useState, useEffect } from 'react';
import { Settings } from '@/lib/types';
import ByokChoice, { ByokProvider } from './ByokChoice';
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


interface ByokSettingsProps {
  settings: Settings;
  onSettingsChange: (settings: Partial<Settings>) => void;
  onApiKeyChange: (apiKey: string) => void;
  onApiKeySave: () => void;
  onApiKeyTest: () => void;
  hasApiKey: boolean;
  apiKeyInput: string;
}

export function ByokSettings({
  settings,
  onSettingsChange,
  onApiKeyChange,
  onApiKeySave,
  onApiKeyTest,
  hasApiKey,
  apiKeyInput,
}: ByokSettingsProps) {
  const [showApiKey, setShowApiKey] = useState(false);

  // Show the BYOK Choice view by default if no provider is set.
  const [showChoice, setShowChoice] = useState<boolean>(() => {
    return !Boolean(settings?.byok?.provider);
  });
  const [provider, setProvider] = useState<ByokProvider>(settings?.byok?.provider || 'openrouter');

  const handleChoose = (p: ByokProvider) => {
    setProvider(p);
    setShowChoice(false);
    onSettingsChange({ byok: { ...settings.byok, provider: p } });
  };

  useEffect(() => {
    if (showChoice) {
      onApiKeyChange('');
    }
  }, [showChoice]);

  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-2">
        <span className="text-sm">🤖</span>
        <h4 className="font-medium text-gray-800">AI Configuration</h4>
        {settings.isPro && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-500 to-pink-500 text-white">
            Pro
          </span>
        )}
      </div>

      {(settings.isPro || settings.flags?.byokEnabled) ? (
        showChoice ? (
          <div className="pl-6">
            <ByokChoice onChoose={handleChoose} onClose={() => setShowChoice(false)} />
          </div>
        ) : (
          <div className="space-y-3 pl-6">
            <div className="flex justify-end">
              <button
                onClick={() => setShowChoice(true)}
                className="text-xs text-blue-600 hover:underline"
              >
                Change provider
              </button>
            </div>

            {/* API Key Input */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                API Key
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
            </div>
 
            {hasApiKey && settings.byok?.provider === 'openrouter' && (
              <div className="space-y-2">
                <label htmlFor="model-select" className="block text-sm font-medium text-gray-700">
                  Model
                </label>
                <ModelSelect
                  value={settings.byok.selectedByokModel || settings.byok.model}
                  onChange={(v: string) => onSettingsChange({ byok: { ...settings.byok, selectedByokModel: v } })}
                  apiBase={settings.byok.apiBase}
                />
              </div>
            )}
+
            {hasApiKey && settings.byok?.provider !== 'openrouter' && (
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

            {/* Provider Info */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Provider
              </label>
              <div className="px-3 py-2 bg-gray-100 rounded-md text-sm text-gray-600">
                {settings.byok.provider === 'openrouter' ? 'OpenRouter' : 'Manual'}
              </div>
            </div>

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
        )
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
