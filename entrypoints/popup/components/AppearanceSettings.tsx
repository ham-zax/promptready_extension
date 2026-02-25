// Appearance Settings Component
// Handles theme selection and visual preferences

import React from 'react';
import { Settings } from '@/lib/types';
import { Palette } from 'lucide-react';

interface AppearanceSettingsProps {
  settings?: Settings;
  onSettingsChange: (settings: Partial<Settings>) => void;
}

export function AppearanceSettings({
  settings,
  onSettingsChange,
}: AppearanceSettingsProps) {
  // Get UI settings with defaults
  const uiSettings = settings?.ui || {
    theme: 'auto',
    animations: true,
    compactMode: false,
    keepPopupOpen: true,
    autoCloseDelay: 3000,
  };

  const handleUIChange = (uiChanges: Partial<Settings['ui']>) => {
    onSettingsChange({
      ui: {
        ...uiSettings,
        ...uiChanges,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Palette className="w-5 h-5 text-brand-primary" />
        <h4 className="font-semibold text-foreground">Appearance</h4>
      </div>
      
      <div className="pl-7 space-y-4">
        {/* Theme Selection */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">
            Theme
          </label>
          <select
            value={uiSettings.theme || 'auto'}
            onChange={(e) => handleUIChange({ theme: e.target.value as 'auto' | 'light' | 'dark' })}
            className="w-full px-3 py-2 bg-background border border-border text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-all cursor-pointer"
          >
            <option value="auto">Match Browser</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          <p className="text-xs text-muted-foreground mt-1.5 leading-snug">
            Keep visuals consistent with your preferred browser theme
          </p>
        </div>
      </div>
    </div>
  );
}
