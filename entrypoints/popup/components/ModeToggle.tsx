import React from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { authService } from '@/lib/auth-service';
import type { Settings } from '@/lib/types';
import { WifiOff, Sparkles } from 'lucide-react';

interface ModeToggleProps {
  mode: Settings['mode'];
  onChange: (mode: Settings['mode']) => void;
  onUpgradePrompt: () => void;
}

export function ModeToggle({ mode, onChange, onUpgradePrompt }: ModeToggleProps) {
  const [authState, setAuthState] = React.useState<any>(null);

  const refreshAuthState = React.useCallback(() => {
    authService.getAuthState().then(setAuthState).catch(() => {
      setAuthState(null);
    });
  }, []);

  React.useEffect(() => {
    refreshAuthState();
  }, [refreshAuthState, mode]);

  const aiDisabled = authState ? !authState.canUseAIMode : false;
  const aiTooltip = authState && !authState.canUseAIMode
    ? authState.aiLockReason === 'missing_api_key'
      ? 'Add an OpenRouter API key to use AI mode.'
      : authState.aiLockReason === 'daily_limit_reached'
        ? 'Daily free AI limit reached. Enter unlock code or go to checkout.'
        : 'AI mode is temporarily unavailable.'
    : undefined;

  const handleValueChange = (newMode: Settings['mode']) => {
    if (!newMode) {
      return;
    }

    if (newMode === 'ai' && aiDisabled) {
      onUpgradePrompt();
      return;
    }

    onChange(newMode);
    refreshAuthState();
  };

  const aiStatusText = authState
    ? authState.isDeveloperMode
      ? 'Developer mode enabled'
      : authState.isUnlocked || authState.hasUnlimitedAccess
        ? 'Unlimited AI unlocked'
        : authState.hasApiKey
          ? `${authState.remainingFreeByokStartsToday} free AI starts left today`
          : 'Add OpenRouter API key to enable AI mode'
    : 'Checking AI access…';

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
