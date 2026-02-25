// Pro Status Settings Component
// Handles Pro subscription status and upgrade options

import React from 'react';
import { Settings } from '@/lib/types';
import { browser } from 'wxt/browser';
import { Crown, Sparkles } from 'lucide-react';

interface ProStatusSettingsProps {
  settings: Settings;
}

export function ProStatusSettings({ settings }: ProStatusSettingsProps) {
  const handleUpgradeClick = async () => {
    const upgradeUrl = 'https://promptready.app/';
    try {
      if (typeof browser !== 'undefined' && browser.tabs?.create) {
        await browser.tabs.create({ url: upgradeUrl });
        return;
      }
      window.open(upgradeUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Failed to open upgrade page:', error);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-2">
        <Crown className="w-4 h-4 text-brand-primary" />
        <h4 className="font-semibold text-foreground">Pro Status</h4>
      </div>
      
      <div className="pl-6 flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Current plan</span>
        <span className={`px-2 py-0.5 text-xs rounded font-bold uppercase tracking-wider ${
          settings.isPro 
            ? 'bg-brand-surface text-brand-primary border border-brand-border' 
            : 'bg-muted text-foreground border border-border'
        }`}>
          {settings.isPro ? 'Pro' : 'Free'}
        </span>
      </div>
      
      {!settings.isPro && (
        <div className="pl-6 pt-2">
          <button 
            onClick={handleUpgradeClick}
            className="w-full px-3 py-2.5 bg-background text-brand-primary border border-brand-primary rounded-full hover:bg-brand-surface active:scale-[0.98] transition-all duration-200 ease-out shadow-sm flex items-center justify-center space-x-1.5 font-semibold text-sm"
          >
            <Crown className="w-4 h-4" />
            <span>Upgrade to Pro</span>
          </button>
          <p className="text-xs text-muted-foreground mt-2 text-center leading-snug">
            Unlock AI processing and advanced features
          </p>
        </div>
      )}
      
      {settings.isPro && (
        <div className="pl-6 pt-1">
          <div className="flex items-center space-x-2 text-brand-primary bg-brand-surface p-2 rounded-lg border border-brand-border">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-semibold">All Pro features unlocked</span>
          </div>
        </div>
      )}
    </div>
  );
}
