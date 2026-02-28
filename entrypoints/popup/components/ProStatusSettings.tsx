import React, { useMemo, useState } from 'react';
import { Settings } from '@/lib/types';
import { browser } from 'wxt/browser';
import { resolveEntitlements } from '@/lib/entitlement-policy';
import {
  buildUnlockStateFromCode,
  formatUnlockCode,
  verifyUnlockCode,
} from '@/lib/unlock-code';
import { CheckCircle2, CreditCard, KeyRound, LockOpen, ShieldCheck } from 'lucide-react';

const CHECKOUT_URL = 'https://example.com/promptready-checkout';

interface ProStatusSettingsProps {
  settings: Settings;
  onSettingsChange: (settings: Partial<Settings>) => void;
}

export function ProStatusSettings({ settings, onSettingsChange }: ProStatusSettingsProps) {
  const [unlockCodeInput, setUnlockCodeInput] = useState('');
  const [unlockStatus, setUnlockStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const entitlements = useMemo(() => resolveEntitlements(settings), [settings]);

  const statusLabel = entitlements.isUnlocked
    ? 'Unlocked unlimited BYOK'
    : !entitlements.hasApiKey
      ? 'API key required for AI mode'
      : `${entitlements.remainingFreeByokStartsToday} free AI starts left today`;

  const handleCheckoutClick = async () => {
    try {
      if (typeof browser !== 'undefined' && browser.tabs?.create) {
        await browser.tabs.create({ url: CHECKOUT_URL });
        return;
      }
      window.open(CHECKOUT_URL, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Failed to open checkout page:', error);
      setUnlockStatus({
        type: 'error',
        message: 'Could not open checkout page. Please try again.',
      });
    }
  };

  const handleApplyUnlockCode = async () => {
    const normalized = formatUnlockCode(unlockCodeInput);
    const verification = verifyUnlockCode(unlockCodeInput);

    if (!verification.valid) {
      const reason = verification.errorCode === 'invalid_checksum'
        ? 'Invalid unlock code checksum.'
        : verification.errorCode === 'invalid_prefix'
          ? 'Unlock code prefix is invalid.'
          : 'Unlock code format is invalid.';

      setUnlockStatus({
        type: 'error',
        message: `${reason} Please copy the full code from your receipt.`,
      });
      return;
    }

    const unlockState = buildUnlockStateFromCode(unlockCodeInput);
    if (!unlockState) {
      setUnlockStatus({
        type: 'error',
        message: 'Could not apply unlock code. Please try again.',
      });
      return;
    }

    await onSettingsChange({ byokUnlock: unlockState });
    setUnlockCodeInput('');
    setUnlockStatus({
      type: 'success',
      message: `Unlock applied (${normalized}). Unlimited BYOK is now active on this browser profile.`,
    });
  };

  const isUnlocked = Boolean(settings.byokUnlock?.isUnlocked);

  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-2">
        <ShieldCheck className="w-4 h-4 text-brand-primary" />
        <h4 className="font-semibold text-foreground">AI Access</h4>
      </div>

      <div className="pl-6 flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Current status</span>
        <span className={`px-2 py-0.5 text-xs rounded font-bold uppercase tracking-wider ${
          isUnlocked
            ? 'bg-brand-surface text-brand-primary border border-brand-border'
            : 'bg-muted text-foreground border border-border'
        }`}>
          {isUnlocked ? 'Unlocked' : 'Freemium'}
        </span>
      </div>

      <div className="pl-6 text-xs text-muted-foreground leading-relaxed">
        {statusLabel}
      </div>

      {isUnlocked && (
        <div className="pl-6 pt-1">
          <div className="flex items-center space-x-2 text-brand-primary bg-brand-surface p-2 rounded-lg border border-brand-border">
            <LockOpen className="w-4 h-4" />
            <span className="text-xs font-semibold">Unlimited BYOK usage unlocked on this browser.</span>
          </div>
          {settings.byokUnlock?.unlockCodeLast4 && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Unlock code ending: <strong>{settings.byokUnlock.unlockCodeLast4}</strong>
            </p>
          )}
        </div>
      )}

      {!isUnlocked && (
        <div className="pl-6 space-y-3 pt-2">
          <button
            onClick={handleCheckoutClick}
            className="w-full px-3 py-2.5 bg-background text-brand-primary border border-brand-primary rounded-full hover:bg-brand-surface active:scale-[0.98] transition-all duration-200 ease-out shadow-sm flex items-center justify-center space-x-1.5 font-semibold text-sm"
          >
            <CreditCard className="w-4 h-4" />
            <span>Go to checkout</span>
          </button>

          <div className="rounded-lg border border-border bg-card p-3">
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Enter unlock code
            </label>
            <input
              type="text"
              value={unlockCodeInput}
              onChange={(event) => {
                setUnlockCodeInput(event.target.value.toUpperCase());
                setUnlockStatus(null);
              }}
              placeholder="PRU1-XXXX-XXXX-XXXX"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm tracking-wide"
            />
            <button
              onClick={handleApplyUnlockCode}
              disabled={!unlockCodeInput.trim()}
              className="mt-2 w-full px-3 py-2 bg-brand-primary text-brand-primary-foreground rounded-md text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="inline-flex items-center justify-center gap-1.5">
                <KeyRound className="w-4 h-4" />
                Apply unlock code
              </span>
            </button>
          </div>

          {unlockStatus && (
            <div className={`rounded-md border px-3 py-2 text-xs ${
              unlockStatus.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-700'
                : unlockStatus.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-border bg-muted text-muted-foreground'
            }`}>
              <div className="flex items-start gap-1.5">
                {unlockStatus.type === 'success' && <CheckCircle2 className="mt-0.5 h-4 w-4" />}
                <span>{unlockStatus.message}</span>
              </div>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground leading-snug">
            Unlock codes are validated locally in this extension (honor-system placeholder flow).
          </p>
        </div>
      )}
    </div>
  );
}
