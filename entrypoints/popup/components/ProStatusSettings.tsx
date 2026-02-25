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
        <Crown className="w-4 h-4 text-amber-500" />
        <h4 className="font-semibold text-gray-900">Pro Status</h4>
      </div>
      
      <div className="pl-6 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Current plan</span>
        <span className={`px-2 py-0.5 text-xs rounded font-bold uppercase tracking-wider ${
          settings.isPro 
            ? 'bg-amber-100 text-amber-800 border border-amber-200' 
            : 'bg-gray-100 text-gray-600 border border-gray-200'
        }`}>
          {settings.isPro ? 'Pro' : 'Free'}
        </span>
      </div>
      
      {!settings.isPro && (
        <div className="pl-6 pt-2">
          <button 
            onClick={handleUpgradeClick}
            className="w-full px-3 py-2 bg-amber-500 text-amber-950 font-semibold text-sm rounded-lg hover:bg-amber-400 active:scale-[0.98] transition-all shadow-sm flex items-center justify-center space-x-1.5"
          >
            <Crown className="w-4 h-4" />
            <span>Upgrade to Pro</span>
          </button>
          <p className="text-xs text-gray-500 mt-2 text-center leading-snug">
            Unlock AI processing and advanced features
          </p>
        </div>
      )}
      
      {settings.isPro && (
        <div className="pl-6 pt-1">
          <div className="flex items-center space-x-2 text-brand-primary bg-brand-surface p-2 rounded-lg border border-brand-primary/20">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-semibold">All Pro features unlocked</span>
          </div>
        </div>
      )}
    </div>
  );
}
