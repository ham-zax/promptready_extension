import React, { useState, useEffect } from 'react';
import { Settings } from '@/lib/types';
import { ProcessingProfiles } from './ProcessingProfiles';
import { AppearanceSettings } from './AppearanceSettings';
import { PrivacySettings } from './PrivacySettings';
import { ProStatusSettings } from './ProStatusSettings';
import { SimplifiedByokSetup } from './SimplifiedByokSetup';
import { ProUpgradePrompt } from './ProUpgradePrompt';
import { Settings as SettingsIcon, Bot, CheckCircle2, AlertTriangle, ChevronLeft, MousePointerClick } from 'lucide-react';

interface UnifiedSettingsProps {
  isExpanded: boolean;
  settings?: Settings;
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
  const effectiveSettings: Settings = settings ?? {
    mode: 'offline',
    templates: { bundles: [] },
    byok: {
      provider: 'openrouter',
      apiBase: 'https://openrouter.ai/api/v1',
      apiKey: '',
      selectedByokModel: 'arcee-ai/trinity-large-preview:free',
    },
    privacy: { telemetryEnabled: false },
    flags: {
      aiModeEnabled: true,
      byokEnabled: true,
      trialEnabled: true,
    },
    processing: {
      profile: 'standard',
      readabilityPreset: 'standard',
      turndownPreset: 'standard',
      customOptions: {
        preserveCodeBlocks: true,
        includeImages: true,
        preserveTables: true,
        preserveLinks: true,
      },
    },
    ui: {
      theme: 'auto',
      animations: true,
      compactMode: false,
      keepPopupOpen: true,
      autoCloseDelay: 3000,
    },
  };

  const [currentView, setCurrentView] = useState<View>('main');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    if (!isExpanded) {
      const timer = setTimeout(() => setCurrentView('main'), 300);
      return () => clearTimeout(timer);
    }
  }, [isExpanded]);

  const handleByokComplete = () => {
    setCurrentView('main');
    // Settings will be updated by the ByokSetup component
  };

  const handleUpgradeComplete = () => {
    setCurrentView('main');
    setShowUpgradeModal(false);
  };

  const renderMainSettings = () => (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* AI Configuration Section */}
      <div className="border border-border rounded-xl p-4 bg-card text-card-foreground shadow-sm transition-all duration-200 ease-out">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Bot className="w-5 h-5 text-brand-primary" />
            <h3 className="font-semibold text-foreground">AI Configuration</h3>
          </div>
          {isPro && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-amber-950 uppercase tracking-wider">
              Pro
            </span>
          )}
        </div>

        {hasApiKey ? (
          <div className="space-y-3">
            <div className="bg-brand-surface border border-brand-border rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-brand-primary" />
                <span className="text-sm font-medium text-foreground">
                  API key configured ({effectiveSettings.byok.provider})
                </span>
              </div>
            </div>

            <button
              onClick={() => setCurrentView('byok')}
              className="w-full px-3 py-2 border border-border text-foreground rounded-lg hover:bg-muted active:scale-[0.98] transition-all duration-200 ease-out text-sm font-medium"
            >
              Manage API Configuration
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-muted border border-border rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-brand-primary" />
                <span className="text-sm font-medium text-foreground">
                  No API key configured
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setCurrentView('byok')}
                className="px-3 py-2 bg-brand-surface text-brand-primary border border-brand-border rounded-lg hover:bg-brand-primary hover:text-white active:scale-[0.98] transition-all duration-200 ease-out text-sm font-medium"
              >
                Add API Key
              </button>
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="px-3 py-2 bg-brand-primary text-brand-primary-foreground border border-[#c90000] rounded-lg hover:bg-[#d20000] active:scale-[0.98] transition-all duration-200 ease-out text-sm font-medium shadow-sm"
              >
                Start Free Trial
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Processing Profiles */}
      <div className="border border-border rounded-xl p-4 bg-card text-card-foreground shadow-sm transition-all duration-200 ease-out">
        <ProcessingProfiles
          settings={effectiveSettings}
          onSettingsChange={onSettingsChange}
        />
      </div>

      {/* Appearance */}
      <div className="border border-border rounded-xl p-4 bg-card text-card-foreground shadow-sm transition-all duration-200 ease-out">
        <AppearanceSettings
          settings={effectiveSettings}
          onSettingsChange={onSettingsChange}
        />
      </div>

      {/* Popup Behavior */}
      <div className="border border-border rounded-xl p-4 bg-card text-card-foreground shadow-sm transition-all duration-200 ease-out">
        <div className="flex items-center space-x-2 mb-3">
          <MousePointerClick className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold text-foreground">Popup Behavior</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label htmlFor="keepPopupOpen" className="text-sm text-foreground font-medium">Keep popup open after processing</label>
            <input
              id="keepPopupOpen"
              type="checkbox"
              checked={effectiveSettings.ui?.keepPopupOpen ?? false}
              onChange={(e) => onSettingsChange({
                ui: {
                  ...(effectiveSettings.ui || { theme: 'auto', animations: true, compactMode: false, keepPopupOpen: false, autoCloseDelay: 2000 }),
                  keepPopupOpen: e.target.checked
                }
              })}
              className="w-4 h-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary cursor-pointer"
            />
          </div>
          {!effectiveSettings.ui?.keepPopupOpen && (
            <div className="flex items-center justify-between">
              <label htmlFor="autoCloseDelay" className="text-sm text-foreground font-medium">Auto-close delay (seconds)</label>
              <input
                id="autoCloseDelay"
                type="number"
                min="1"
                max="10"
                value={(effectiveSettings.ui?.autoCloseDelay ?? 2000) / 1000}
              onChange={(e) => onSettingsChange({
                ui: {
                  ...(effectiveSettings.ui || { theme: 'auto', animations: true, compactMode: false, keepPopupOpen: false, autoCloseDelay: 2000 }),
                  autoCloseDelay: parseInt(e.target.value) * 1000
                }
              })}
                className="w-20 p-1.5 border border-border bg-background rounded-lg text-sm text-foreground focus:ring-brand-primary focus:border-brand-primary"
              />
            </div>
          )}
        </div>
      </div>

      {/* Privacy */}
      <div className="border border-border rounded-xl p-4 bg-card text-card-foreground shadow-sm transition-all duration-200 ease-out">
        <PrivacySettings
          settings={effectiveSettings}
          onSettingsChange={onSettingsChange}
        />
      </div>

      {/* Account Status */}
      <div className="border border-border rounded-xl p-4 bg-card text-card-foreground shadow-sm transition-all duration-200 ease-out">
        <ProStatusSettings settings={effectiveSettings} />
      </div>
    </div>
  );

  const renderByokSetup = () => (
    <div>
      <button
        onClick={() => setCurrentView('main')}
        className="mb-4 flex items-center space-x-1 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground bg-card border border-border rounded-lg hover:bg-accent active:scale-[0.98] transition-all"
      >
        <ChevronLeft className="w-4 h-4" />
        <span>Back to Settings</span>
      </button>
      <SimplifiedByokSetup
        settings={effectiveSettings}
        onComplete={handleByokComplete}
        onCancel={() => setCurrentView('main')}
      />
    </div>
  );

  return (
    <>
      <div className="border-t border-brand-border bg-background p-4 shadow-inner inset-y-0 relative z-10 w-full">
        <div className="flex items-center space-x-2 mb-5 pb-3 border-b border-border">
          <SettingsIcon className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold text-foreground text-lg">
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
