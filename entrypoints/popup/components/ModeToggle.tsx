import React from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Storage } from '@/lib/storage';
import { authService } from '@/lib/auth-service';
import type { Settings } from '@/lib/types';
import { WifiOff, Sparkles } from 'lucide-react';

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

  const aiStatusText = authState
    ? authState.isDeveloperMode
      ? 'Developer mode enabled'
      : authState.hasApiKey
        ? 'BYOK connected'
        : authState.canUseAIMode
          ? `${authState.remainingCredits} credits available`
          : 'Upgrade required for AI mode'
    : 'Checking access…';

  return (
    <div className="space-y-2">
      <div className="rounded-2xl border border-border bg-card/80 p-1.5 shadow-[0_1px_0_rgba(23,23,23,0.04)]">
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={handleValueChange}
          className="grid grid-cols-2 gap-1.5"
          aria-label="Processing Mode"
        >
          <ToggleGroupItem
            value="offline"
            title="Free • Instant"
            className="h-11 rounded-xl border border-transparent bg-transparent text-foreground transition-all duration-200 ease-out hover:bg-muted/85 active:scale-[0.98] data-[state=on]:bg-brand-primary data-[state=on]:text-brand-primary-foreground data-[state=on]:border-[#c90000] data-[state=on]:shadow-[0_4px_10px_rgba(231,0,0,0.18)]"
            aria-label="Offline Mode"
          >
            <div className="flex items-center justify-center space-x-2 font-semibold text-sm">
              <WifiOff className="w-4 h-4" />
              <span>Offline</span>
            </div>
          </ToggleGroupItem>

          <ToggleGroupItem
            value="ai"
            aria-label="AI Mode"
            aria-disabled={aiDisabled}
            title={aiTooltip}
            className={
              'h-11 rounded-xl border border-transparent bg-transparent text-foreground transition-all duration-200 ease-out hover:bg-muted/85 active:scale-[0.98] data-[state=on]:bg-brand-primary data-[state=on]:text-brand-primary-foreground data-[state=on]:border-[#c90000] data-[state=on]:shadow-[0_4px_10px_rgba(231,0,0,0.18)] ' +
              (aiDisabled ? 'opacity-50 cursor-not-allowed hover:bg-transparent active:scale-100' : '')
            }
          >
            <div className="flex items-center justify-center space-x-2 font-semibold text-sm">
              <Sparkles className="w-4 h-4" />
              <span>AI Mode</span>
            </div>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="px-1 text-[11px] text-muted-foreground leading-snug">
        {aiStatusText}
      </div>
    </div>
  );
}
