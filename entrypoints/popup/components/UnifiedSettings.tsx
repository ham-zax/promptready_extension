import React, { useState } from 'react';
import { Settings } from '@/lib/types';
import { ProcessingProfiles } from './ProcessingProfiles';
import { AppearanceSettings } from './AppearanceSettings';
import { PrivacySettings } from './PrivacySettings';
import { ProStatusSettings } from './ProStatusSettings';
import { SimplifiedByokSetup } from './SimplifiedByokSetup';
import { ProUpgradePrompt } from './ProUpgradePrompt';

interface UnifiedSettingsProps {
  isExpanded: boolean;
  settings: Settings;
  onSettingsChange: (settings: Partial<Settings>) => void;
  isPro: boolean;
  hasApiKey: boolean;
}

type View = 'main' | 'byok' | 'upgrade';

export function UnifiedSettings({
  isExpanded,
  settings,
  onSettingsChange,
  isPro,
  hasApiKey,
}: UnifiedSettingsProps) {
  const [currentView, setCurrentView] = useState<View>('main');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  if (!isExpanded) return null;

  const handleByokComplete = () => {
    setCurrentView('main');
    // Settings will be updated by the ByokSetup component
  };

  const handleUpgradeComplete = () => {
    setCurrentView('main');
    setShowUpgradeModal(false);
  };

  const renderMainSettings = () => (
    <div className="space-y-4">
      {/* AI Configuration Section */}
      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-lg">🤖</span>
            <h3 className="font-semibold text-gray-900">AI Configuration</h3>
          </div>
          {isPro && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-500 to-pink-500 text-white">
              Pro
            </span>
          )}
        </div>

        {hasApiKey ? (
          <div className="space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-md p-3">
              <div className="flex items-center space-x-2">
                <span className="text-green-600">✓</span>
                <span className="text-sm text-green-700">
                  API key configured ({settings.byok.provider})
                </span>
              </div>
            </div>

            <button
              onClick={() => setCurrentView('byok')}
              className="w-full px-3 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm"
            >
              Manage API Configuration
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <div className="flex items-center space-x-2">
                <span className="text-yellow-600">⚠️</span>
                <span className="text-sm text-yellow-700">
                  No API key configured
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setCurrentView('byok')}
                className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Add API Key
              </button>
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm font-medium"
              >
                Start Free Trial
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Processing Profiles */}
      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <ProcessingProfiles
          settings={settings}
          onSettingsChange={onSettingsChange}
        />
      </div>

      {/* Appearance */}
      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <AppearanceSettings
          settings={settings}
          onSettingsChange={onSettingsChange}
        />
      </div>

      {/* Privacy */}
      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <PrivacySettings
          settings={settings}
          onSettingsChange={onSettingsChange}
        />
      </div>

      {/* Account Status */}
      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <ProStatusSettings settings={settings} />
      </div>
    </div>
  );

  const renderByokSetup = () => (
    <div>
      <button
        onClick={() => setCurrentView('main')}
        className="mb-4 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
      >
        ← Back to Settings
      </button>
      <SimplifiedByokSetup
        settings={settings}
        onComplete={handleByokComplete}
        onCancel={() => setCurrentView('main')}
      />
    </div>
  );

  return (
    <>
      <div className="border-t border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center space-x-2 mb-4">
          <span className="text-lg">⚙️</span>
          <h3 className="font-semibold text-gray-900">
            {currentView === 'byok' ? 'API Configuration' : 'Settings'}
          </h3>
        </div>

        {currentView === 'main' && renderMainSettings()}
        {currentView === 'byok' && renderByokSetup()}
      </div>

      {/* Upgrade Modal */}
      <ProUpgradePrompt
        isVisible={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onUpgradeComplete={handleUpgradeComplete}
      />
    </>
  );
}