import React from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Storage } from '@/lib/storage';
import { authService } from '@/lib/auth-service';
import type { Settings } from '@/lib/types';

interface ModeToggleProps {
  mode: Settings['mode'];
  onChange: (mode: Settings['mode']) => void;
  onUpgradePrompt: () => void;
  isPro?: boolean;
}

export function ModeToggle({ mode, onChange, onUpgradePrompt }: ModeToggleProps) {
  const [authState, setAuthState] = React.useState<any>(null);
  
  React.useEffect(() => {
    authService.getAuthState().then(setAuthState);
  }, []);
  
  const aiDisabled = authState ? !authState.canUseAIMode : false;
  const aiTooltip = authState && !authState.canUseAIMode 
    ? (authState.planType === 'free' 
       ? 'AI Mode requires credits or API key' 
       : 'AI Mode is temporarily unavailable')
    : undefined;

  const handleValueChange = (newMode: Settings['mode']) => {
    if (!newMode) return; // Do nothing if the same item is clicked again to deselect

    if (newMode === 'ai' && aiDisabled) {
      onUpgradePrompt();
      return;
    }

    Storage.updateSettings({ mode: newMode });
    onChange(newMode);
  };

  return (
    <ToggleGroup
      type="single"
      value={mode}
      onValueChange={handleValueChange}
      className="flex items-center justify-center space-x-4 py-3 transition-all duration-300 ease-in-out"
      aria-label="Processing Mode"
    >
      <ToggleGroupItem
        value="offline"
        title="Free • Instant"
        className="flex items-center space-x-3 px-6 py-4 rounded-xl transition-all duration-300 ease-in-out transform hover:scale-105 data-[state=on]:bg-blue-50 data-[state=on]:border-2 data-[state=on]:border-blue-500 data-[state=on]:text-blue-700 data-[state=on]:scale-105 data-[state=on]:shadow-lg bg-gray-50 border-2 border-gray-200 text-gray-600 hover:bg-gray-100"
        aria-label="Offline Mode"
      >
        <div className="text-left">
          <div className="font-semibold text-sm flex items-center space-x-2">
            <span>🛰️</span>
            <span>Offline</span>
          </div>
          <div className="text-xs text-gray-500 data-[state=on]:text-blue-600">
            Free • Instant
          </div>
        </div>
      </ToggleGroupItem>

      <ToggleGroupItem
        value="ai"
        aria-label="AI Mode"
        aria-disabled={aiDisabled}
        title={aiTooltip}
        className={
          `flex items-center space-x-3 px-6 py-4 rounded-xl transition-all duration-300 ease-in-out transform hover:scale-105 relative
           data-[state=on]:bg-gradient-to-r data-[state=on]:from-purple-50 data-[state=on]:to-pink-50
           data-[state=on]:border-2 data-[state=on]:border-purple-500 data-[state=on]:text-purple-700
           data-[state=on]:scale-105 data-[state=on]:shadow-lg
           bg-gray-50 border-2 border-gray-200 text-gray-600 hover:bg-gray-100` +
          (aiDisabled ? ' opacity-60 cursor-not-allowed hover:bg-gray-50 hover:scale-100' : '')
        }
      >
        <div className="text-left">
          <div className="font-semibold text-sm flex items-center space-x-1">
            <span>AI Mode</span>
            {authState && (
              <>
                {authState.isDeveloperMode && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500 text-black">
                    DEV
                  </span>
                )}
                {authState.planType === 'pro' && !authState.isDeveloperMode && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                    PRO
                  </span>
                )}
                {authState.planType === 'free' && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-500 text-white">
                    {authState.remainingCredits} credits
                  </span>
                )}
              </>
            )}
          </div>
          <div className="text-xs text-gray-500 data-[state=on]:text-purple-600">
            {authState ? (
              authState.isDeveloperMode ? 'Unlimited • Developer' :
              authState.hasApiKey ? 'Enhanced • BYOK' :
              authState.canUseAIMode ? 'Enhanced • Credits' :
              'Limited • Upgrade'
            ) : 'Loading...'}
          </div>
        </div>
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
