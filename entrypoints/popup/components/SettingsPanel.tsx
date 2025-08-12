import React, { useState } from 'react';
import { Settings } from '@/lib/types';
import { ModelSelect } from './ModelSelect';

interface SettingsPanelProps {
  isExpanded: boolean;
  settings: Settings;
  onSettingsChange: (settings: Partial<Settings>) => void;
  onApiKeyChange: (apiKey: string) => void;
  onApiKeySave: () => void;
  onApiKeyTest: () => void;
  hasApiKey: boolean;
  apiKeyInput: string;
}

export function SettingsPanel({
  isExpanded,
  settings,
  onSettingsChange,
  onApiKeyChange,
  onApiKeySave,
  onApiKeyTest,
  hasApiKey,
  apiKeyInput,
}: SettingsPanelProps) {
  const [showApiKey, setShowApiKey] = useState(false);

  if (!isExpanded) return null;

  return (
    <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-4">
      {/* Settings Header */}
      <div className="flex items-center space-x-2 mb-4">
        <span className="text-lg">⚙️</span>
        <h3 className="font-semibold text-gray-900">Settings</h3>
      </div>

      {/* AI Configuration Section */}
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

        {settings.isPro ? (
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
                  >
                    {showApiKey ? '🙈' : '👁️'}
                  </button>
                </div>
                <button
                  onClick={onApiKeySave}
                  disabled={!apiKeyInput.trim()}
                  className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
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
              Upgrade to Pro to configure AI settings
            </p>
            <p className="text-xs text-purple-600">
              Use your own OpenAI or OpenRouter API key for enhanced processing
            </p>
          </div>
        )}
      </div>

      {/* Appearance Section */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <span className="text-sm">🎨</span>
          <h4 className="font-medium text-gray-800">Appearance</h4>
        </div>
        <div className="pl-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Theme
          </label>
          <select
            value={settings.theme || 'system'}
            onChange={(e) => onSettingsChange({ theme: e.target.value as 'system' | 'light' | 'dark' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </div>

      {/* Privacy Section */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <span className="text-sm">🔒</span>
          <h4 className="font-medium text-gray-800">Privacy</h4>
        </div>
        <div className="pl-6">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={settings.privacy.telemetryEnabled}
              onChange={(e) => onSettingsChange({
                privacy: { ...settings.privacy, telemetryEnabled: e.target.checked }
              })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Enable usage analytics</span>
          </label>
          <p className="text-xs text-gray-500 mt-1 ml-6">
            Help improve PromptReady with anonymous usage data
          </p>
        </div>
      </div>

      {/* Pro Status Section */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <span className="text-sm">💎</span>
          <h4 className="font-medium text-gray-800">Pro Status</h4>
        </div>
        <div className="pl-6 flex items-center justify-between">
          <span className="text-sm text-gray-700">Current plan</span>
          <span className={`px-2 py-1 text-xs rounded-full font-medium ${
            settings.isPro 
              ? 'bg-green-100 text-green-700' 
              : 'bg-gray-100 text-gray-600'
          }`}>
            {settings.isPro ? 'Pro' : 'Free'}
          </span>
        </div>
        {!settings.isPro && (
          <div className="pl-6">
            <button className="w-full px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm rounded-md hover:from-purple-600 hover:to-pink-600 transition-all">
              Upgrade to Pro
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
