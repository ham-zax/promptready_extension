// BYOK (Bring Your Own Key) Settings Component
// Handles AI configuration including API keys, models, and providers

import React, { useState } from 'react';
import { Settings } from '@/lib/types';
import { ModelSelect } from './ModelSelect';

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

  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-2">
        <span className="text-sm">🤖</span>
        <h4 className="font-medium text-gray-800">AI Configuration</h4>
        {!settings.isPro && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-500 to-pink-500 text-white">
            Pro
          </span>
        )}
      </div>

      {(settings.isPro || settings.flags?.byokEnabled) ? (
        <div className="space-y-3 pl-6">
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

          {/* Model Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Model
            </label>
            <ModelSelect
              value={settings.byok.model}
              onChange={(model) => onSettingsChange({ byok: { ...settings.byok, model } })}
              apiBase={settings.byok.apiBase}
            />
          </div>

          {/* Provider Info */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Provider
            </label>
            <div className="px-3 py-2 bg-gray-100 rounded-md text-sm text-gray-600">
              {settings.byok.provider === 'openrouter' ? 'OpenRouter' : 'Custom'}
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
