// Privacy Settings Component
// Handles privacy preferences including telemetry and data collection

import React from 'react';
import { Settings } from '@/lib/types';
import { Lock } from 'lucide-react';

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
        <Lock className="w-4 h-4 text-muted-foreground" />
        <h4 className="font-semibold text-foreground">Privacy</h4>
      </div>
      
      <div className="pl-6">
        <label className="flex items-center space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.privacy.telemetryEnabled}
            onChange={(e) => onSettingsChange({
              privacy: { ...settings.privacy, telemetryEnabled: e.target.checked }
            })}
            className="w-4 h-4 rounded border-border text-brand-primary focus:ring-brand-primary"
          />
          <span className="text-sm font-medium text-foreground">Enable usage analytics</span>
        </label>
        <p className="text-xs text-muted-foreground mt-1 ml-7 leading-snug">
          Help improve PromptReady with anonymous usage data. No content is ever collected.
        </p>
      </div>
    </div>
  );
}
