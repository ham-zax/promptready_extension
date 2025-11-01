import React from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Storage } from '@/lib/storage';
import type { Settings } from '@/lib/types';

interface ModeToggleProps {
  mode: Settings['mode'];
  isPro: boolean; // true if user has credits or a saved BYOK key
  onChange: (mode: Settings['mode']) => void;
  onUpgradePrompt: () => void;
}

export function ModeToggle({ mode, isPro, onChange, onUpgradePrompt }: ModeToggleProps) {
  const aiDisabled = !isPro;
  const aiTooltip = aiDisabled ? 'AI Mode is disabled — upgrade or connect your API key to enable.' : undefined;

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
      defaultValue="ai"
      value={mode}
      onValueChange={handleValueChange}
      className="flex items-center justify-center space-x-4 py-6"
      aria-label="Processing Mode"
    >
      <ToggleGroupItem
        value="offline"
        className="flex items-center space-x-3 px-6 py-4 rounded-xl transition-all duration-200 data-[state=on]:bg-blue-50 data-[state=on]:border-2 data-[state=on]:border-blue-500 data-[state=on]:text-blue-700 bg-gray-50 border-2 border-gray-200 text-gray-600 hover:bg-gray-100"
        aria-label="Offline Mode"
      >
        <div className="text-left">
          <div className="font-semibold text-sm">
            Offline
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
          `flex items-center space-x-3 px-6 py-4 rounded-xl transition-all duration-200 relative
           data-[state=on]:bg-gradient-to-r data-[state=on]:from-purple-50 data-[state=on]:to-pink-50
           data-[state=on]:border-2 data-[state=on]:border-purple-500 data-[state=on]:text-purple-700
           bg-gray-50 border-2 border-gray-200 text-gray-600 hover:bg-gray-100` +
          (aiDisabled ? ' opacity-60 cursor-not-allowed hover:bg-gray-50' : '')
        }
      >
        <div className="text-left">
          <div className="font-semibold text-sm flex items-center space-x-1">
            <span>AI Mode</span>
            {!isPro && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                Pro
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 data-[state=on]:text-purple-600">
            Enhanced • BYOK
          </div>
        </div>
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
