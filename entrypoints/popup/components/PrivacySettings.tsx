// Privacy Settings Component
// Handles privacy preferences including telemetry and data collection

import React from 'react';
import { Settings } from '@/lib/types';

interface PrivacySettingsProps {
  settings: Settings;
  onSettingsChange: (settings: Partial<Settings>) => void;
}

export function PrivacySettings({
  settings,
  onSettingsChange,
}: PrivacySettingsProps) {
  return (
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
          Help improve PromptReady with anonymous usage data. No content is ever collected.
        </p>
      </div>
    </div>
  );
}
