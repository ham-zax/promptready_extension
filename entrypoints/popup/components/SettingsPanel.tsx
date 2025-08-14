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
  if (!isExpanded) return null;

  return (
    <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-4">
      {/* Settings Header */}
      <div className="flex items-center space-x-2 mb-4">
        <span className="text-lg">⚙️</span>
        <h3 className="font-semibold text-gray-900">Settings</h3>
      </div>

      {/* Processing Profiles */}
      <ProcessingProfiles
        settings={settings}
        onSettingsChange={onSettingsChange}
      />

      {/* BYOK Settings */}
      <ByokSettings
        settings={settings}
        onSettingsChange={onSettingsChange}
        onApiKeyChange={onApiKeyChange}
        onApiKeySave={onApiKeySave}
        onApiKeyTest={onApiKeyTest}
        hasApiKey={hasApiKey}
        apiKeyInput={apiKeyInput}
      />

      {/* Appearance Settings */}
      <AppearanceSettings
        settings={settings}
        onSettingsChange={onSettingsChange}
      />

      {/* Privacy Settings */}
      <PrivacySettings
        settings={settings}
        onSettingsChange={onSettingsChange}
      />

      {/* Pro Status */}
      <ProStatusSettings settings={settings} />
    </div>
  );
}
