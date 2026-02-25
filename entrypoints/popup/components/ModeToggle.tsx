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

  return (
    <ToggleGroup
      type="single"
      value={mode}
      onValueChange={handleValueChange}
      className="flex w-full bg-black/20 backdrop-blur-sm p-1.5 rounded-2xl shadow-inner border border-white/10"
      aria-label="Processing Mode"
    >
      <ToggleGroupItem
        value="offline"
        title="Free • Instant"
        className="flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl transition-all duration-300 ease-in-out data-[state=on]:bg-white data-[state=on]:text-brand-primary data-[state=on]:shadow-md hover:bg-white/10 text-white/80 active:scale-95 border-0 data-[state=on]:scale-100"
        aria-label="Offline Mode"
      >
        <div className="flex items-center space-x-2 font-semibold text-sm">
          <WifiOff className="w-4 h-4" />
          <span>Offline</span>
        </div>
        <div className={`text-[10px] mt-0.5 font-medium tracking-wide ${mode === 'offline' ? 'text-brand-primary/80' : 'text-white/60'}`}>
          FREE • INSTANT
        </div>
      </ToggleGroupItem>

      <ToggleGroupItem
        value="ai"
        aria-label="AI Mode"
        aria-disabled={aiDisabled}
        title={aiTooltip}
        className={
          `flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl transition-all duration-300 ease-in-out data-[state=on]:bg-white data-[state=on]:text-brand-primary data-[state=on]:shadow-md hover:bg-white/10 text-white/80 active:scale-95 border-0 data-[state=on]:scale-100 relative overflow-hidden ` +
          (aiDisabled ? ' opacity-50 cursor-not-allowed hover:bg-transparent active:scale-100' : '')
        }
      >
        <div className="flex items-center space-x-2 font-semibold text-sm relative z-10">
          <Sparkles className="w-4 h-4" />
          <span>AI Mode</span>
        </div>
        <div className={`text-[10px] mt-0.5 font-medium tracking-wide flex items-center space-x-1 relative z-10 uppercase ${mode === 'ai' ? 'text-brand-primary/80' : 'text-white/60'}`}>
            {authState ? (
              authState.isDeveloperMode ? <span>Developer</span> :
              authState.hasApiKey ? <span>BYOK</span> :
              authState.canUseAIMode ? <span className="bg-brand-primary/10 px-1.5 py-0.5 rounded text-brand-primary font-bold">{authState.remainingCredits} Credits</span> :
              <span>Upgrade</span>
            ) : 'Loading...'}
        </div>
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
