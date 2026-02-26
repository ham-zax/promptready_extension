// BYOK (Bring Your Own Key) Settings Component
// Handles AI configuration including API keys, models, and providers

import React, { useState } from 'react';
import { Settings } from '@/lib/types';
import { ModelSelect } from './ModelSelect';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';

interface ByokSettingsProps {
  settings: Settings;
  onSettingsChange: (settings: Partial<Settings>) => void;
  onApiKeyChange: (apiKey: string) => void;
  onApiKeySave: () => void;
  onApiKeyTest: () => void;
  hasApiKey: boolean;
  apiKeyInput: string;
}


import { Bot, Eye, EyeOff } from 'lucide-react';

export function ByokSettings({
  settings,
  onSettingsChange,
  onApiKeyChange,
  onApiKeySave,
  onApiKeyTest,
  hasApiKey,
  apiKeyInput,
}: ByokSettingsProps) {
  const [showApiKey, setShowApiKey] = useState(false);

  // Header
  const header = (
    <div className="flex items-center space-x-2">
      <Bot className="w-4 h-4 text-brand-primary" />
      <h4 className="font-semibold text-foreground">AI Configuration</h4>
      {settings.isPro && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
          Pro
        </span>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      {header}

      {(settings.isPro || settings.flags?.byokEnabled) ? (
        <div className="space-y-3 pl-6">
          <label className="block text-sm font-medium text-foreground">
            API Key (OpenRouter)
          </label>
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => onApiKeyChange(e.target.value)}
                placeholder={hasApiKey ? '••••••••••••••••' : 'Enter your API key'}
                className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={onApiKeySave}
              disabled={!apiKeyInput.trim()}
              className="px-3 py-2 bg-brand-primary text-brand-primary-foreground text-sm rounded-md hover:opacity-90 active:scale-95 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors"
            >
              Save
            </button>
          </div>

          {hasApiKey && (
            <div className="space-y-2">
              <label htmlFor="model-select" className="block text-sm font-medium text-foreground">
                Model
              </label>
              <ModelSelect
                value={settings.byok.selectedByokModel || settings.byok.model || ''}
                onChange={(v: string) => onSettingsChange({ byok: { ...settings.byok, selectedByokModel: v } })}
                apiBase={settings.byok.apiBase}
              />
            </div>
          )}

          {/* Test Button */}
          {hasApiKey && (
            <button
              onClick={onApiKeyTest}
              className="w-full px-3 py-2 bg-green-600/10 text-green-700 border border-green-600/20 text-sm font-medium rounded-md hover:bg-green-600/20 active:scale-95 transition-all"
            >
              Test API Connection
            </button>
          )}

          {/* Remove Key (destructive) */}
          {hasApiKey && (
            <div className="mt-2">
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    className="w-full px-3 py-2 bg-destructive/10 text-destructive border border-destructive/20 text-sm font-medium rounded-md hover:bg-destructive/20 active:scale-95 transition-all"
                  >
                    Remove Key
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogTitle>Remove API Key?</DialogTitle>
                  <DialogDescription>
                    Are you sure? This will remove your key and revert you to the free plan.
                  </DialogDescription>
                  <DialogFooter>
                    <DialogClose asChild>
                      <button className="px-3 py-2 bg-gray-200 rounded-md">Cancel</button>
                    </DialogClose>
                    <button
                      onClick={() => {
                        onSettingsChange({ byok: { ...settings.byok, apiKey: '' } });
                        onApiKeyChange('');
                      }}
                      className="px-3 py-2 bg-red-600 text-white rounded-md"
                    >
                      Confirm & Remove
                    </button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      ) : (
        <div className="pl-6 py-3 px-3 bg-brand-surface rounded-md border border-brand-border">
          <p className="text-sm font-medium text-brand-primary mb-1">
            BYOK is available but Pro features are locked.
          </p>
          <p className="text-xs text-brand-primary/80">
            Enter your key to enable AI Mode
          </p>
        </div>
      )}
    </div>
  );
}
