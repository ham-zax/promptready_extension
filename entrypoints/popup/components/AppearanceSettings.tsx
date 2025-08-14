// Appearance Settings Component
// Handles theme selection and visual preferences

import React from 'react';
import { Settings } from '@/lib/types';

interface AppearanceSettingsProps {
  settings: Settings;
  onSettingsChange: (settings: Partial<Settings>) => void;
}

export function AppearanceSettings({
  settings,
  onSettingsChange,
}: AppearanceSettingsProps) {
  return (
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
        <p className="text-xs text-gray-500 mt-1">
          Choose how PromptReady appears in your browser
        </p>
      </div>
    </div>
  );
}
