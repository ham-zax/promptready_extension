import React, { useMemo } from 'react';
import { Settings } from '@/lib/types';
import { FREE_BYOK_DAILY_LIMIT, resolveEntitlements } from '@/lib/entitlement-policy';
import { ShieldCheck } from 'lucide-react';

interface ProStatusSettingsProps {
  settings: Settings;
  onSettingsChange: (settings: Partial<Settings>) => void;
}

export function ProStatusSettings({ settings, onSettingsChange }: ProStatusSettingsProps) {
  void onSettingsChange;
  const entitlements = useMemo(() => resolveEntitlements(settings), [settings]);

  const statusLabel = !entitlements.hasApiKey
      ? 'API key required for AI mode'
      : `${entitlements.remainingFreeByokUsesToday} successful BYOK AI cleanups left today`;

  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-2">
        <ShieldCheck className="w-4 h-4 text-brand-primary" />
        <h4 className="font-semibold text-foreground">AI Access</h4>
      </div>

      <div className="pl-6 flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Current status</span>
        <span className="px-2 py-0.5 text-xs rounded font-bold uppercase tracking-wider bg-muted text-foreground border border-border">
          Daily BYOK
        </span>
      </div>

      <div className="pl-6 text-xs text-muted-foreground leading-relaxed">
        {statusLabel}
      </div>

      <div className="pl-6 text-xs text-muted-foreground leading-relaxed">
        AI cleanup is limited to {FREE_BYOK_DAILY_LIMIT} successful BYOK AI cleanups per local day.
        Failed OpenRouter requests do not count. Offline capture and export stay available.
      </div>
    </div>
  );
}
