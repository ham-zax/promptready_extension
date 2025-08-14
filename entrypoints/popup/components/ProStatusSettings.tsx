// Pro Status Settings Component
// Handles Pro subscription status and upgrade options

import React from 'react';
import { Settings } from '@/lib/types';

interface ProStatusSettingsProps {
  settings: Settings;
}

export function ProStatusSettings({ settings }: ProStatusSettingsProps) {
  const handleUpgradeClick = () => {
    // TODO: Implement upgrade flow
    console.log('Upgrade to Pro clicked');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-2">
        <span className="text-sm">💎</span>
        <h4 className="font-medium text-gray-800">Pro Status</h4>
      </div>
      
      <div className="pl-6 flex items-center justify-between">
        <span className="text-sm text-gray-700">Current plan</span>
        <span className={`px-2 py-1 text-xs rounded-full font-medium ${
          settings.isPro 
            ? 'bg-green-100 text-green-700' 
            : 'bg-gray-100 text-gray-600'
        }`}>
          {settings.isPro ? 'Pro' : 'Free'}
        </span>
      </div>
      
      {!settings.isPro && (
        <div className="pl-6">
          <button 
            onClick={handleUpgradeClick}
            className="w-full px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm rounded-md hover:from-purple-600 hover:to-pink-600 transition-all"
          >
            Upgrade to Pro
          </button>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Unlock AI processing and advanced features
          </p>
        </div>
      )}
      
      {settings.isPro && (
        <div className="pl-6">
          <div className="flex items-center space-x-2 text-green-600">
            <span className="text-xs">✨</span>
            <span className="text-xs font-medium">All Pro features unlocked</span>
          </div>
        </div>
      )}
    </div>
  );
}
