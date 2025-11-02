import React from 'react';
import { Settings } from '@/lib/types';
import { ByokSettings } from './ByokSettings';
import { AppearanceSettings } from './AppearanceSettings';
import { PrivacySettings } from './PrivacySettings';
import { ProStatusSettings } from './ProStatusSettings';
import { ProcessingProfiles } from './ProcessingProfiles';

interface SettingsPanelProps {
  isExpanded: boolean;
  settings: Settings;
  onSettingsChange: (settings: Partial<Settings>) => void;
  onApiKeyChange: (apiKey: string) => void;
  onApiKeySave: () => void;
  onApiKeyTest: () => void;
  hasApiKey: boolean;
  apiKeyInput: string;
  settingsView: 'main' | 'byokChoice' | 'byokConfig';
  onSetSettingsView: (view: 'main' | 'byokChoice' | 'byokConfig') => void;
  byokProvider: 'openrouter' | 'manual';
  onSetByokProvider: (provider: 'openrouter' | 'manual') => void;
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
  settingsView,
  onSetSettingsView,
  byokProvider,
  onSetByokProvider,
}: SettingsPanelProps) {
  if (!isExpanded) return null;

  const handleByokChoice = (provider: 'openrouter' | 'manual' | 'z.ai') => {
    onSetByokProvider(provider);
    onSetSettingsView('byokConfig');
  };

  const renderContent = () => {
    switch (settingsView) {
      case 'byokChoice':
        return (
          <div className="text-center">
            <h3 className="font-semibold text-gray-900 mb-4">Connect your AI Provider</h3>
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={() => handleByokChoice('openrouter')}
                className="w-full py-2 px-4 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
              >
                OpenRouter
              </button>
              <button
                onClick={() => handleByokChoice('manual')}
                className="w-full py-2 px-4 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
              >
                Manual
              </button>
              <button
                onClick={() => handleByokChoice('z.ai')}
                className="w-full py-2 px-4 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
              >
                Z.AI
              </button>
            </div>
          </div>
        );
      case 'byokConfig':
        return (
          <ByokSettings
            settings={settings}
            onSettingsChange={onSettingsChange}
            onApiKeyChange={onApiKeyChange}
            onApiKeySave={onApiKeySave}
            onApiKeyTest={onApiKeyTest}
            hasApiKey={hasApiKey}
            apiKeyInput={apiKeyInput}
            provider={byokProvider}
          />
        );
      default:
        return (
          <>
            <ProcessingProfiles
              settings={settings}
              onSettingsChange={onSettingsChange}
            />
            <AppearanceSettings
              settings={settings}
              onSettingsChange={onSettingsChange}
            />
            <PrivacySettings
              settings={settings}
              onSettingsChange={onSettingsChange}
            />
            <ProStatusSettings settings={settings} />
          </>
        );
    }
  };

  return (
    <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-4">
      <div className="flex items-center space-x-2 mb-4">
        <span className="text-lg">⚙️</span>
        <h3 className="font-semibold text-gray-900">Settings</h3>
      </div>
      {renderContent()}
    </div>
  );
}
