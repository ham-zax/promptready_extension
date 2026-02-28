import React, { useEffect, useState } from 'react';
import { Settings } from '@/lib/types';
import { ProcessingProfiles } from './ProcessingProfiles';
import { AppearanceSettings } from './AppearanceSettings';
import { PrivacySettings } from './PrivacySettings';
import { ProStatusSettings } from './ProStatusSettings';
import { SimplifiedByokSetup } from './SimplifiedByokSetup';
import { Settings as SettingsIcon, Bot, CheckCircle2, AlertTriangle, ChevronLeft, MousePointerClick, WandSparkles } from 'lucide-react';

interface UnifiedSettingsProps {
  isExpanded: boolean;
  settings?: Settings;
  onSettingsChange: (settings: Partial<Settings>) => void;
  hasApiKey: boolean;
}

type View = 'main' | 'byok';

const MAX_CUSTOM_PROMPT_CHARS = 1000;

interface CustomPromptEditorProps {
  savedPrompt: string;
  onSave: (customPrompt: string) => void;
}

function CustomPromptEditor({ savedPrompt, onSave }: CustomPromptEditorProps) {
  const [draft, setDraft] = useState(savedPrompt);

  return (
    <div className="border border-border rounded-xl p-4 bg-card text-card-foreground shadow-sm transition-all duration-200 ease-out space-y-3">
      <div className="flex items-center space-x-2">
        <WandSparkles className="w-5 h-5 text-muted-foreground" />
        <h3 className="font-semibold text-foreground">Custom AI Prompt (optional)</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        This is treated as a non-authoritative preference. Core extraction safety/system instructions remain dominant.
      </p>
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value.slice(0, MAX_CUSTOM_PROMPT_CHARS))}
        rows={5}
        placeholder="Example: Prefer concise bullet summaries for long sections."
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {draft.length}/{MAX_CUSTOM_PROMPT_CHARS}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDraft('')}
            className="px-2.5 py-1.5 text-xs border border-border rounded-md hover:bg-muted"
          >
            Clear
          </button>
          <button
            onClick={() => onSave(draft)}
            className="px-3 py-1.5 text-xs font-semibold bg-brand-primary text-brand-primary-foreground rounded-md"
          >
            Save prompt
          </button>
        </div>
      </div>
    </div>
  );
}

export function UnifiedSettings({
  isExpanded,
  settings,
  onSettingsChange,
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
      customPrompt: '',
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

  useEffect(() => {
    if (!isExpanded) {
      const timer = setTimeout(() => setCurrentView('main'), 300);
      return () => clearTimeout(timer);
    }
  }, [isExpanded]);

  const handleByokComplete = () => {
    setCurrentView('main');
  };

  const renderMainSettings = () => (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="border border-border rounded-xl p-4 bg-card text-card-foreground shadow-sm transition-all duration-200 ease-out">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Bot className="w-5 h-5 text-brand-primary" />
            <h3 className="font-semibold text-foreground">AI Configuration</h3>
          </div>
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

            <button
              onClick={() => setCurrentView('byok')}
              className="w-full px-3 py-2 bg-brand-surface text-brand-primary border border-brand-border rounded-lg hover:bg-brand-primary hover:text-white active:scale-[0.98] transition-all duration-200 ease-out text-sm font-medium"
            >
              Add API Key
            </button>
          </div>
        )}
      </div>

      <CustomPromptEditor
        key={effectiveSettings.byok?.customPrompt || ''}
        savedPrompt={effectiveSettings.byok?.customPrompt || ''}
        onSave={(customPrompt) => onSettingsChange({
          byok: {
            ...effectiveSettings.byok,
            customPrompt,
          },
        })}
      />

      <div className="border border-border rounded-xl p-4 bg-card text-card-foreground shadow-sm transition-all duration-200 ease-out">
        <ProcessingProfiles
          settings={effectiveSettings}
          onSettingsChange={onSettingsChange}
        />
      </div>

      <div className="border border-border rounded-xl p-4 bg-card text-card-foreground shadow-sm transition-all duration-200 ease-out">
        <AppearanceSettings
          settings={effectiveSettings}
          onSettingsChange={onSettingsChange}
        />
      </div>

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
                  keepPopupOpen: e.target.checked,
                },
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
                    autoCloseDelay: parseInt(e.target.value, 10) * 1000,
                  },
                })}
                className="w-20 p-1.5 border border-border bg-background rounded-lg text-sm text-foreground focus:ring-brand-primary focus:border-brand-primary"
              />
            </div>
          )}
        </div>
      </div>

      <div className="border border-border rounded-xl p-4 bg-card text-card-foreground shadow-sm transition-all duration-200 ease-out">
        <PrivacySettings
          settings={effectiveSettings}
          onSettingsChange={onSettingsChange}
        />
      </div>

      <div className="border border-border rounded-xl p-4 bg-card text-card-foreground shadow-sm transition-all duration-200 ease-out">
        <ProStatusSettings settings={effectiveSettings} onSettingsChange={onSettingsChange} />
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
  );
}
