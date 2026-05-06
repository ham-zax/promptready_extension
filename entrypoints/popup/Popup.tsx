// Refactored popup UI with focused hooks and BYOK freemium messaging.

import React, { useState, useEffect } from 'react';
import { usePopupController } from './hooks/usePopupController';
import { useToastManager } from './hooks/useToastManager';
import { UnifiedSettings } from './components/UnifiedSettings';
import { ToastContainer } from './components/ToastContainer';
import type { AIAttemptOutcome, Settings } from '@/lib/types';
import { ModeToggle } from './components/ModeToggle';
import { PrimaryButton } from './components/PrimaryButton';
import { Storage } from '@/lib/storage';
import { LoadingOverlay } from './components/LoadingOverlay';
import { derivePopupOutcome, type PopupOutcomeTone } from './lib/popup-outcome';
import { LogoPixelatedSimple } from '@/assets/logo_pixelated_simple';
import { browser } from 'wxt/browser';
import {
  Settings as SettingsIcon,
  ClipboardCopy,
  Download,
  FileJson,
  Code2,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronDown,
  X,
} from 'lucide-react';

let devKeySequence = '';
const DEV_MODE_SEQUENCE = 'devmode';

type SettingsInitialView = 'main' | 'byok';

type ExportActionId =
  | 'copy_md'
  | 'save_md'
  | 'copy_json'
  | 'raw_md'
  | 'raw_json'
  | 'code_block'
  | 'html';

type ExportActionFeedback = {
  id: ExportActionId;
  state: 'pending' | 'done';
} | null;

const ACTION_COMPLETE_LABEL: Record<ExportActionId, string> = {
  copy_md: 'Copied',
  save_md: 'Saved',
  copy_json: 'Copied',
  raw_md: 'Copied',
  raw_json: 'Copied',
  code_block: 'Ready',
  html: 'Copied',
};

export default function RefactoredPopup() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [processingStep, setProcessingStep] = useState('initialization');
  const [processingComplete, setProcessingComplete] = useState(false);
  const [autoCloseCountdown, setAutoCloseCountdown] = useState<number | null>(null);
  const [aiFallbackInfo, setAiFallbackInfo] = useState<{ stage: string; error: string } | null>(null);
  const [lastAiOutcome, setLastAiOutcome] = useState<string>('not_attempted');
  const [showOutcomeDetails, setShowOutcomeDetails] = useState(false);
  const [showExportDetails, setShowExportDetails] = useState(false);
  const [showDeveloperDetails, setShowDeveloperDetails] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<ExportActionFeedback>(null);

  useEffect(() => {
    const handleProgress = (message: any) => {
      if (message.type === 'PROCESSING_PROGRESS') {
        const stage = typeof message?.payload?.stage === 'string' ? message.payload.stage : 'processing';
        const statusMessage = typeof message?.payload?.message === 'string' ? message.payload.message : 'Processing...';
        setProcessingStep(stage);
        setProcessingStage(statusMessage);
        setIsProcessing(true);
        setProcessingComplete(false);
        setAutoCloseCountdown(null);
        return;
      }

      if (message.type === 'PROCESSING_FALLBACK') {
        const stage = typeof message?.payload?.stage === 'string' ? message.payload.stage : 'ai-processing';
        const error = typeof message?.payload?.error === 'string' ? message.payload.error : 'AI request failed';
        setAiFallbackInfo({ stage, error });
        setProcessingStage('AI unavailable; continuing with offline capture...');
        setIsProcessing(true);
        setProcessingComplete(false);
        setAutoCloseCountdown(null);
        return;
      }

      if (message.type === 'PROCESSING_COMPLETE') {
        setIsProcessing(false);
        setProcessingComplete(true);
        setProcessingStep('complete');

        const aiOutcome = typeof message?.payload?.aiOutcome === 'string'
          ? message.payload.aiOutcome
          : 'not_attempted';
        setLastAiOutcome(aiOutcome);

        const aiResponseReceived = aiOutcome === 'success';
        const aiFailed = aiOutcome.startsWith('fallback_');

        if (!aiFailed) {
          setAiFallbackInfo(null);
        } else {
          const fallbackCode = typeof message?.payload?.fallbackCode === 'string'
            ? message.payload.fallbackCode
            : '';
          const warnings = Array.isArray(message?.payload?.warnings)
            ? message.payload.warnings.filter((warning: unknown): warning is string => typeof warning === 'string')
            : [];
          const qualityReasons = warnings
            .filter((warning: string) => warning.startsWith('ai_quality_gate:'))
            .map((warning: string) => warning.replace('ai_quality_gate:', ''));
          const fallbackStage = fallbackCode === 'ai_fallback:quality_gate_failed'
            ? 'postprocessing'
            : 'fallback';
          const fallbackError = fallbackCode === 'ai_fallback:quality_gate_failed'
            ? `AI quality gate failed${qualityReasons.length > 0 ? `: ${qualityReasons.join(', ')}` : ''}`
            : 'AI enhancement fell back to offline output.';
          setAiFallbackInfo({ stage: fallbackStage, error: fallbackError });
        }

        setProcessingStage(
          aiResponseReceived
            ? 'AI enhanced output ready'
            : aiFailed
              ? 'Offline output ready'
              : 'Offline output ready'
        );

        const checkAutoClose = async () => {
          const settings = await Storage.getSettings();
          const keepOpen = settings?.ui?.keepPopupOpen ?? true;
          const delay = settings?.ui?.autoCloseDelay ?? 3000;
          const isAiFlow = typeof aiOutcome === 'string' && aiOutcome !== 'not_attempted';

          if (!keepOpen && !isAiFlow) {
            setAutoCloseCountdown(Math.floor(delay / 1000));

            const countdownInterval = setInterval(() => {
              setAutoCloseCountdown((prev) => {
                if (prev === null || prev <= 1) {
                  clearInterval(countdownInterval);
                  window.close();
                  return null;
                }
                return prev - 1;
              });
            }, 1000);
            return;
          }

          setAutoCloseCountdown(null);
        };

        checkAutoClose();
        return;
      }

      if (message.type === 'PROCESSING_ERROR') {
        if (message?.payload?.fallbackUsed) {
          return;
        }
        setIsProcessing(false);
        setProcessingComplete(false);
        setProcessingStep('error');
        setAutoCloseCountdown(null);
      }
    };

    browser.runtime.onMessage.addListener(handleProgress);
    return () => browser.runtime.onMessage.removeListener(handleProgress);
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (event: Event) => {
      const e = event as unknown as { preventDefault: () => void; returnValue?: string };
      if (isProcessing) {
        e.preventDefault();
        e.returnValue = '';
        return 'Processing in progress...';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isProcessing]);

  const {
    state,
    hasContent,
    isProcessing: controllerIsProcessing,
    handleModeToggle,
    handleCapture,
    handleCopy,
    handleExport,
    onSettingsChange,
  } = usePopupController();

  const toastManager = useToastManager();
  const { showSuccess, showError, showInfo, showWarning } = toastManager;

  useEffect(() => {
    if (!state.toast) return;

    if (state.toast.type === 'success') {
      showSuccess(state.toast.message);
      return;
    }

    if (state.toast.type === 'error') {
      showError(state.toast.message);
      return;
    }

    if (state.toast.type === 'warning') {
      showWarning(state.toast.message);
      return;
    }

    showInfo(state.toast.message);
  }, [state.toast, showSuccess, showError, showWarning, showInfo]);

  const [showSettings, setShowSettings] = useState(false);
  const [settingsIntent, setSettingsIntent] = useState<{ initialView: SettingsInitialView; nonce: number }>({
    initialView: 'main',
    nonce: 0,
  });

  const openSettings = (initialView: SettingsInitialView = 'main') => {
    setSettingsIntent((current) => ({
      initialView,
      nonce: current.nonce + 1,
    }));
    setShowSettings(true);
  };

  useEffect(() => {
    if (state.settings?.ui?.theme) {
      const theme = state.settings.ui.theme;
      const isDark = theme === 'dark';

      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.settings?.ui?.theme]);

  useEffect(() => {
    const toggleDeveloperMode = async () => {
      try {
        const settings = await Storage.getSettings();
        const currentDevMode = settings?.flags?.developerMode || false;

        const newFlags = {
          aiModeEnabled: settings?.flags?.aiModeEnabled ?? true,
          byokEnabled: settings?.flags?.byokEnabled ?? true,
          // Legacy only: carried forward to avoid dropping legacy settings fields; no runtime effect.
          trialEnabled: settings?.flags?.trialEnabled ?? false,
          developerMode: !currentDevMode,
        };

        await Storage.updateSettings({ flags: newFlags });
      } catch (error) {
        console.error('Failed to toggle developer mode:', error);
      }
    };

    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      devKeySequence += event.key.toLowerCase();

      if (devKeySequence.includes(DEV_MODE_SEQUENCE)) {
        toggleDeveloperMode();
        devKeySequence = '';
      }

      if (devKeySequence.length > 20) {
        devKeySequence = devKeySequence.slice(-10);
      }
    };

    document.addEventListener('keypress', handleKeyPress);
    return () => document.removeEventListener('keypress', handleKeyPress);
  }, []);

  const processingActive = isProcessing || controllerIsProcessing;
  const deepCaptureEnabled = state.settings?.processing?.capturePolicy?.deepCaptureEnabled ?? false;

  const handleDeepCaptureChange = (enabled: boolean) => {
    const currentProcessing: Partial<NonNullable<Settings['processing']>> = state.settings?.processing || {};

    onSettingsChange({
      processing: {
        ...currentProcessing,
        capturePolicy: {
          ...currentProcessing.capturePolicy,
          deepCaptureEnabled: enabled,
        },
      } as NonNullable<Settings['processing']>,
    });
  };

  const handleCaptureWithUiLock = async () => {
    setIsProcessing(true);
    setProcessingComplete(false);
    setProcessingStep('initialization');
    setProcessingStage(state.mode === 'ai' ? 'Preparing capture request...' : 'Capturing content...');
    setAutoCloseCountdown(null);
    setAiFallbackInfo(null);
    setLastAiOutcome('not_attempted');
    setShowOutcomeDetails(false);
    setShowExportDetails(false);

    try {
      await handleCapture();
    } catch {
      setIsProcessing(false);
      setProcessingStep('error');
    }
  };

  const animationsEnabled = state.settings?.ui?.animations ?? true;
  const revealClass = animationsEnabled ? 'animate-in fade-in slide-in-from-bottom-2 duration-300' : '';

  const modeStatusLabel = state.mode === 'offline'
    ? 'Offline mode'
    : state.settings?.flags?.developerMode
      ? 'AI mode • Developer'
      : 'AI mode • BYOK daily limit';

  const aiUsageLabel = state.settings?.flags?.developerMode
    ? 'Developer bypass active'
    : state.hasApiKey
      ? `${Math.max(0, state.remainingFreeByokUsesToday)} successful BYOK AI cleanups left today`
      : 'Add BYOK API key to use AI mode';

  const truncateMessage = (value: string, max = 140): string => {
    if (!value) return '';
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
  };

  const outcome = derivePopupOutcome({
    mode: state.mode,
    hasContent,
    aiOutcome: state.exportData?.aiOutcome || (lastAiOutcome as AIAttemptOutcome),
    aiFallbackError: aiFallbackInfo?.error,
    canUseAIMode: state.canUseAIMode,
    aiLockReason: state.aiLockReason,
    processingStatus: state.processing.status,
    processingMessage: state.processing.message,
    qualityReport: state.exportData?.qualityReport,
  });

  const getOutcomeToneClass = (tone: PopupOutcomeTone): string => {
    switch (tone) {
      case 'success':
        return 'border-emerald-600/30 bg-emerald-600/10 text-emerald-700';
      case 'degraded':
        return 'border-amber-600/30 bg-amber-600/10 text-amber-800';
      case 'info':
        return 'border-sky-600/30 bg-sky-600/10 text-sky-700';
      case 'error':
        return 'border-rose-600/30 bg-rose-600/10 text-rose-700';
      case 'neutral':
      default:
        return 'border-border bg-muted text-foreground';
    }
  };

  const renderOutcomeIcon = (tone: PopupOutcomeTone) => {
    if (tone === 'success' || tone === 'neutral') {
      return <CheckCircle2 className="mt-0.5 h-4 w-4" />;
    }

    if (tone === 'info') {
      return <Info className="mt-0.5 h-4 w-4" />;
    }

    return <AlertTriangle className="mt-0.5 h-4 w-4" />;
  };

  const shouldShowOutcomeBanner = Boolean(outcome && (hasContent || outcome.kind === 'failed'));
  const shouldShowExportActions = Boolean(!outcome || outcome.primaryActions.length > 0);

  const shouldShowAiLockCard =
    state.mode === 'ai' &&
    !state.canUseAIMode &&
    !state.settings?.flags?.developerMode;

  const runActionFeedback = async (actionId: ExportActionId, action: () => void | Promise<void>) => {
    setActionFeedback({ id: actionId, state: 'pending' });

    try {
      await action();
      setActionFeedback({ id: actionId, state: 'done' });
      window.setTimeout(() => {
        setActionFeedback((current) => (
          current?.id === actionId && current.state === 'done' ? null : current
        ));
      }, 1200);
    } catch (error) {
      setActionFeedback(null);
      throw error;
    }
  };

  const getActionLabel = (actionId: ExportActionId, label: string): string => {
    if (actionFeedback?.id !== actionId) return label;
    if (actionFeedback.state === 'pending') return label;
    return ACTION_COMPLETE_LABEL[actionId];
  };

  const isActionPending = (actionId: ExportActionId): boolean => (
    actionFeedback?.id === actionId && actionFeedback.state === 'pending'
  );

  const isActionDone = (actionId: ExportActionId): boolean => (
    actionFeedback?.id === actionId && actionFeedback.state === 'done'
  );

  const renderPrimaryExportAction = ({
    actionId,
    label,
    description,
    icon,
    action,
  }: {
    actionId: ExportActionId;
    label: string;
    description: string;
    icon: React.ReactNode;
    action: () => void | Promise<void>;
  }) => {
    const displayLabel = getActionLabel(actionId, label);
    const done = isActionDone(actionId);

    return (
      <button
        onClick={() => void runActionFeedback(actionId, action)}
        disabled={isActionPending(actionId)}
        aria-busy={isActionPending(actionId)}
        className="group min-h-[68px] w-full rounded-xl border border-border bg-background text-card-foreground hover:bg-brand-surface hover:border-brand-primary/30 active:scale-[0.98] disabled:opacity-80 disabled:cursor-wait shadow-sm p-3 text-left transition-all duration-200 ease-out"
      >
        <div className="flex items-center space-x-3">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${done ? 'bg-emerald-500/10 text-emerald-700' : 'bg-brand-surface text-brand-primary group-hover:bg-brand-primary group-hover:text-white'}`}>
            {done ? <CheckCircle2 className="w-4 h-4" /> : icon}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="min-w-[58px] text-sm font-semibold text-foreground">{displayLabel}</span>
            <span className="text-[10px] text-muted-foreground leading-tight">{description}</span>
          </div>
        </div>
      </button>
    );
  };

  const renderCompactExportAction = ({
    actionId,
    label,
    icon,
    action,
  }: {
    actionId: ExportActionId;
    label: string;
    icon: React.ReactNode;
    action: () => void | Promise<void>;
  }) => {
    const displayLabel = getActionLabel(actionId, label);
    const done = isActionDone(actionId);

    return (
      <button
        onClick={() => void runActionFeedback(actionId, action)}
        disabled={isActionPending(actionId)}
        aria-busy={isActionPending(actionId)}
        className="flex min-h-8 items-center justify-center space-x-1 rounded border border-border bg-muted px-2 py-1 text-xs text-foreground hover:bg-accent active:scale-[0.98] disabled:opacity-80 disabled:cursor-wait transition-all"
      >
        {done ? <CheckCircle2 className="w-4 h-4 text-emerald-700" /> : icon}
        <span className="min-w-[48px]">{displayLabel}</span>
      </button>
    );
  };

  return (
    <div className="relative w-96 max-h-[600px] bg-background text-foreground antialiased flex flex-col overflow-hidden">
      <div className="bg-background/95 backdrop-blur-sm text-foreground p-4 shadow-sm border-b border-border z-20 relative shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand-border bg-brand-surface">
              <LogoPixelatedSimple className="h-7 w-7" />
            </div>
            <div className="flex min-w-0 flex-col leading-tight">
              <h1 className="linear-kicker truncate text-[1.75rem] font-normal text-foreground">PromptReady</h1>
              <p className="truncate text-[11px] text-muted-foreground">Clean, structure, and cite web content for prompts</p>
            </div>
            {state.settings?.flags?.developerMode && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-yellow-500 text-black rounded font-bold uppercase tracking-wider">DEV</span>
            )}
          </div>
          <button
            onClick={() => {
              if (showSettings) {
                setShowSettings(false);
                return;
              }

              openSettings('main');
            }}
            className={`p-1.5 rounded-lg transition-all active:scale-95 border ${showSettings ? 'bg-brand-surface border-brand-border text-brand-primary' : 'border-transparent hover:bg-muted text-muted-foreground hover:text-foreground'}`}
            aria-label="Settings"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>

        <div className={`mt-3 flex flex-wrap items-center gap-1.5 ${animationsEnabled ? 'animate-in fade-in duration-300' : ''}`}>
          <span className="inline-flex items-center rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground">
            {modeStatusLabel}
          </span>
          <span className="inline-flex items-center rounded-full border border-brand-border bg-brand-surface px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-primary">
            {aiUsageLabel}
          </span>
        </div>

        <div className="mt-4">
          <ModeToggle
            mode={state.mode}
            onChange={(m: Settings['mode']) => {
              handleModeToggle(m);
              setShowSettings(false);
            }}
            onUpgradePrompt={() => {
              openSettings('byok');
            }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
        <div
          className={`grid transition-[grid-template-rows,border-color] duration-300 ease-in-out shrink-0 ${
            showSettings ? 'grid-rows-[1fr] border-b border-brand-border' : 'grid-rows-[0fr] border-transparent border-b-0'
          }`}
        >
          <div className="overflow-hidden">
            {state.settings ? (
              <UnifiedSettings
                isExpanded={showSettings}
                settings={state.settings as Settings}
                onSettingsChange={onSettingsChange}
                hasApiKey={state.hasApiKey}
                initialView={settingsIntent.initialView}
                intentKey={settingsIntent.nonce}
              />
            ) : (
              <div className="p-4 text-sm text-muted-foreground">Loading settings...</div>
            )}
          </div>
        </div>

        <div className="p-4 flex-1 flex flex-col gap-3">
          <section className={`rounded-2xl border border-border bg-card p-3 shadow-sm ${revealClass}`}>
            <PrimaryButton
              onClick={handleCaptureWithUiLock}
              disabled={processingActive || (state.mode === 'ai' && !state.canUseAIMode)}
              isProcessing={processingActive}
              processingText={processingStage || state.processing.message || 'Processing...'}
            >
              Capture Content
            </PrimaryButton>

            {state.settings && (
              <label className="mt-3 flex items-start gap-3 rounded-lg border border-border bg-background px-3 py-2.5 cursor-pointer transition-colors hover:bg-muted/60">
                <input
                  type="checkbox"
                  checked={deepCaptureEnabled}
                  onChange={(event) => handleDeepCaptureChange(event.target.checked)}
                  disabled={processingActive}
                  className="mt-0.5 h-4 w-4 rounded border-border text-brand-primary focus:ring-brand-primary"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">Deep capture</span>
                  <span className="block text-xs leading-snug text-muted-foreground">
                    Scroll and settle long or lazy-loaded pages before capture.
                  </span>
                </span>
              </label>
            )}

            {!hasContent && !processingActive && (
              <p className="mt-2 px-1 text-xs text-muted-foreground leading-snug">
                Capture the active tab and generate clean Markdown + structured JSON in one click.
              </p>
            )}

            {processingActive && state.processing.progress && (
              <div className="mt-3">
                <div className="bg-muted rounded-full h-1.5 overflow-hidden border border-border">
                  <div
                    className="bg-brand-primary h-full rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${state.processing.progress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center font-medium animate-pulse">
                  {state.processing.message || processingStage}
                </p>
              </div>
            )}
          </section>

          {shouldShowAiLockCard && (
            <div className={`p-4 text-center bg-card rounded-2xl border border-brand-border ${revealClass}`}>
              {state.aiLockReason === 'missing_api_key' ? (
                <>
                  <p className="text-sm font-semibold text-foreground">AI mode needs your BYOK API key</p>
                  <p className="text-xs text-muted-foreground mb-3 mt-1">Offline mode stays free and always available.</p>
                  <button
                    onClick={() => openSettings('byok')}
                    className="w-full py-2.5 px-4 bg-background text-brand-primary border border-brand-primary rounded-full hover:bg-brand-surface active:scale-[0.98] transition-all duration-200 ease-out text-sm font-semibold shadow-sm"
                  >
                    Configure API Key
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-foreground">Daily BYOK AI limit reached</p>
                  <p className="text-xs text-muted-foreground mb-3 mt-1">
                    You’ve used 5 successful BYOK AI cleanups today. Offline mode is still available. Try AI again tomorrow.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleModeToggle('offline')}
                      className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 bg-background text-brand-primary border border-brand-primary rounded-full hover:bg-brand-surface active:scale-[0.98] transition-all duration-200 ease-out text-sm font-semibold shadow-sm"
                    >
                      <Globe className="w-4 h-4" />
                      Use Offline mode
                    </button>
                    <button
                      onClick={() => openSettings('byok')}
                      className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 bg-brand-primary text-brand-primary-foreground border border-[#c90000] rounded-full hover:bg-[#d20000] active:scale-[0.98] transition-all duration-200 ease-out text-sm font-semibold shadow-sm"
                    >
                      <SettingsIcon className="w-4 h-4" />
                      Open BYOK settings
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {hasContent && (
            <div className={`space-y-3 rounded-2xl border border-border bg-card p-3 shadow-sm ${revealClass}`}>
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Export Options</h3>

                {shouldShowOutcomeBanner && outcome && (
                  <div className={`mb-3 rounded-lg border px-3 py-2 text-xs ${getOutcomeToneClass(outcome.tone)}`}>
                    <div className="flex items-start gap-2">
                      {renderOutcomeIcon(outcome.tone)}
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{outcome.title}</div>
                        <div className="mt-0.5 text-[11px] opacity-85 leading-snug">{outcome.message}</div>
                        {(outcome.details || outcome.secondaryActions.length > 0) && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowOutcomeDetails((value) => !value);
                              setShowSettings(false);
                            }}
                            className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold underline underline-offset-2"
                          >
                            View details
                            <ChevronDown className={`h-3 w-3 transition-transform ${showOutcomeDetails ? 'rotate-180' : ''}`} />
                          </button>
                        )}
                        {showOutcomeDetails && (
                          <div className="mt-2 space-y-2 rounded-md border border-current/20 bg-background/55 p-2 text-[11px] leading-snug">
                            {outcome.details && <div>{truncateMessage(outcome.details, 220)}</div>}
                            {outcome.secondaryActions.includes('open_settings') && (
                              <button
                                type="button"
                                onClick={() => openSettings('byok')}
                                className="font-semibold underline underline-offset-2"
                              >
                                Open settings
                              </button>
                            )}
                            {outcome.secondaryActions.includes('change_model') && (
                              <button
                                type="button"
                                onClick={() => openSettings('byok')}
                                className="font-semibold underline underline-offset-2"
                              >
                                Change model
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {shouldShowExportActions && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {renderPrimaryExportAction({
                        actionId: 'copy_md',
                        label: 'Copy MD',
                        description: 'To clipboard',
                        icon: <ClipboardCopy className="w-4 h-4" />,
                        action: () => handleCopy(state.exportData!.markdown),
                      })}

                      {renderPrimaryExportAction({
                        actionId: 'save_md',
                        label: 'Save MD',
                        description: 'Download file',
                        icon: <Download className="w-4 h-4" />,
                        action: () => handleExport('md'),
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowExportDetails((value) => !value)}
                      className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.98] transition-all"
                    >
                      More exports
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showExportDetails ? 'rotate-180' : ''}`} />
                    </button>

                    {showExportDetails && (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {renderPrimaryExportAction({
                          actionId: 'copy_json',
                          label: 'Copy JSON',
                          description: 'Structured data',
                          icon: <FileJson className="w-4 h-4" />,
                          action: () => handleCopy(JSON.stringify(state.exportData!.json, null, 2)),
                        })}
                        {renderPrimaryExportAction({
                          actionId: 'raw_md',
                          label: 'Raw MD',
                          description: 'Markdown text',
                          icon: <ClipboardCopy className="w-4 h-4" />,
                          action: () => handleCopy(state.exportData!.markdown),
                        })}
                        {renderPrimaryExportAction({
                          actionId: 'raw_json',
                          label: 'Raw JSON',
                          description: 'JSON payload',
                          icon: <FileJson className="w-4 h-4" />,
                          action: () => handleCopy(JSON.stringify(state.exportData!.json, null, 2)),
                        })}
                        {renderPrimaryExportAction({
                          actionId: 'code_block',
                          label: 'Code Block',
                          description: 'Escaped Markdown',
                          icon: <Code2 className="w-4 h-4" />,
                          action: () => handleCopy(state.exportData!.markdown.replace(/`/g, '\\`')),
                        })}
                        {renderPrimaryExportAction({
                          actionId: 'html',
                          label: 'HTML',
                          description: 'Rendered export',
                          icon: <Globe className="w-4 h-4" />,
                          action: () => {
                            const html = state.exportData!.json.export?.html || '';
                            return handleCopy(html);
                          },
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>

              {state.exportData?.qualityReport && (
                <div className="border-t border-border pt-3">
                  <div className="flex items-center justify-between bg-muted rounded-lg p-2.5 border border-border">
                    <span className="text-xs font-medium text-foreground">Quality Score</span>
                    <div className="flex items-center space-x-1.5">
                      <span
                        className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          state.exportData.qualityReport.overallScore >= 80
                            ? 'bg-green-100 text-green-700'
                            : state.exportData.qualityReport.overallScore >= 60
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {state.exportData.qualityReport.overallScore}/100
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {state.settings?.flags?.developerMode && state.exportData && (
                <div className="border-t border-border pt-3">
                  <button
                    type="button"
                    onClick={() => setShowDeveloperDetails((value) => !value)}
                    className="flex w-full items-center justify-between text-xs font-medium text-foreground"
                  >
                    <span>Developer details</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDeveloperDetails ? 'rotate-180' : ''}`} />
                  </button>

                  {showDeveloperDetails && (
                    <div className="mt-2 space-y-3">
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>Pipeline: {state.exportData.pipelineUsed || 'standard'}</div>
                        <div>Chars: {(state.exportData.markdown || '').length}</div>
                        {state.exportData.stats && (
                          <div className="space-y-2 break-all">
                            <div>Stats: {JSON.stringify(state.exportData.stats)}</div>
                            {(state.exportData.stats as any).extractionDiagnostics?.candidateTraces && (
                              <div className="border border-border rounded p-2 bg-muted/50 overflow-auto max-h-40 text-left mt-2">
                                <div className="font-semibold mb-1 text-foreground">Candidate Traces</div>
                                <pre className="text-[10px]">
                                  {JSON.stringify((state.exportData.stats as any).extractionDiagnostics.candidateTraces, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 className="text-xs font-medium text-foreground mb-2">Developer Exports</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {renderCompactExportAction({
                            actionId: 'raw_md',
                            label: 'Raw MD',
                            icon: <ClipboardCopy className="w-4 h-4" />,
                            action: () => handleCopy(state.exportData!.markdown),
                          })}
                          {renderCompactExportAction({
                            actionId: 'raw_json',
                            label: 'Raw JSON',
                            icon: <FileJson className="w-4 h-4" />,
                            action: () => handleCopy(JSON.stringify(state.exportData!.json, null, 2)),
                          })}
                          {renderCompactExportAction({
                            actionId: 'code_block',
                            label: 'Code Block',
                            icon: <Code2 className="w-4 h-4" />,
                            action: () => handleCopy(state.exportData!.markdown.replace(/`/g, '\\`')),
                          })}
                          {renderCompactExportAction({
                            actionId: 'html',
                            label: 'HTML',
                            icon: <Globe className="w-4 h-4" />,
                            action: () => {
                              const html = state.exportData!.json.export?.html || '';
                              return handleCopy(html);
                            },
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {processingComplete && (() => {
        const toastOutcome = outcome || derivePopupOutcome({
          mode: state.mode,
          hasContent: true,
          aiOutcome: lastAiOutcome as AIAttemptOutcome,
          aiFallbackError: aiFallbackInfo?.error,
          qualityReport: state.exportData?.qualityReport,
        });

        const iconWrapClass =
          toastOutcome?.tone === 'degraded'
            ? 'bg-amber-50 border-amber-200'
            : toastOutcome?.tone === 'error'
              ? 'bg-rose-50 border-rose-200'
              : 'bg-emerald-50 border-emerald-200';

        const iconClass =
          toastOutcome?.tone === 'degraded'
            ? 'text-amber-700'
            : toastOutcome?.tone === 'error'
              ? 'text-rose-700'
              : 'text-emerald-600';

        const detail =
          toastOutcome?.tone === 'degraded' && aiFallbackInfo
            ? aiFallbackInfo.error
            : undefined;

        return (
          <div className="absolute bottom-4 left-4 right-4 bg-card border border-border text-foreground px-4 py-3 rounded-xl shadow-lg flex items-center justify-between animate-in slide-in-from-bottom-4 duration-300 z-50">
            <div className="flex items-center space-x-3">
              <div className={`rounded-full p-1 border ${iconWrapClass}`}>
                {toastOutcome?.tone === 'degraded' || toastOutcome?.tone === 'error' ? (
                  <AlertTriangle className={`w-4 h-4 ${iconClass}`} />
                ) : (
                  <CheckCircle2 className={`w-4 h-4 ${iconClass}`} />
                )}
              </div>
              <div>
                <p className="font-semibold text-sm">{toastOutcome?.title || 'Output ready'}</p>
                {detail && (
                  <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
                )}
                {autoCloseCountdown !== null && (
                  <p className="text-xs text-muted-foreground mt-0.5">Closing in {autoCloseCountdown}s...</p>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                setAutoCloseCountdown(null);
                setProcessingComplete(false);
              }}
              className="text-muted-foreground hover:text-foreground active:scale-95 transition-all p-1 rounded-md hover:bg-muted"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })()}

      <ToastContainer
        toasts={toastManager.toasts}
        onHide={toastManager.hideToast}
      />

      {processingActive && (
        <LoadingOverlay
          status={state.processing.status}
          stage={processingStep}
          mode={state.mode}
          failedStage={aiFallbackInfo?.stage}
          failedMessage={aiFallbackInfo?.error}
          message={processingStage || state.processing.message}
          progress={state.processing.progress}
        />
      )}
    </div>
  );
}
