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
  // Get UI settings with defaults
  const uiSettings = settings.ui || {
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
    <div className="space-y-3">
      <div className="flex items-center space-x-2">
        <span className="text-sm">🎨</span>
        <h4 className="font-medium text-gray-800">Appearance & Behavior</h4>
      </div>
      
      <div className="pl-6 space-y-4">
        {/* Theme Selection */}
        <div>
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

        {/* Popup Behavior */}
        <div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={uiSettings.keepPopupOpen}
              onChange={(e) => handleUIChange({ keepPopupOpen: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Keep popup open after capture</span>
          </label>
          <p className="text-xs text-gray-500 mt-1 pl-6">
            When unchecked, popup will close automatically after {Math.floor((uiSettings.autoCloseDelay || 3000) / 1000)} seconds
          </p>
        </div>

        {/* Auto-close delay (only show if keepPopupOpen is false) */}
        {!uiSettings.keepPopupOpen && (
          <div className="pl-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Auto-close delay
            </label>
            <select
              value={uiSettings.autoCloseDelay || 3000}
              onChange={(e) => handleUIChange({ autoCloseDelay: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="1000">1 second</option>
              <option value="2000">2 seconds</option>
              <option value="3000">3 seconds</option>
              <option value="5000">5 seconds</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
