// Refactored popup UI with focused hooks and BYOK freemium messaging.

import React, { useState, useEffect } from 'react';
import { usePopupController } from './hooks/usePopupController';
import { useByokManager } from './hooks/useByokManager';
import { useToastManager } from './hooks/useToastManager';
import { UnifiedSettings } from './components/UnifiedSettings';
import { ToastContainer } from './components/ToastContainer';
import type { Settings } from '@/lib/types';
import { ModeToggle } from './components/ModeToggle';
import { PrimaryButton } from './components/PrimaryButton';
import { Storage } from '@/lib/storage';
import { LoadingOverlay } from './components/LoadingOverlay';
import { browser } from 'wxt/browser';
import {
  LayoutTemplate,
  Settings as SettingsIcon,
  ClipboardCopy,
  Download,
  FileJson,
  Code2,
  Globe,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  CreditCard,
  X,
} from 'lucide-react';

const CHECKOUT_URL = 'https://example.com/promptready-checkout';

let devKeySequence = '';
const DEV_MODE_SEQUENCE = 'devmode';

export default function RefactoredPopup() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [processingStep, setProcessingStep] = useState('initialization');
  const [processingComplete, setProcessingComplete] = useState(false);
  const [autoCloseCountdown, setAutoCloseCountdown] = useState<number | null>(null);
  const [aiFallbackInfo, setAiFallbackInfo] = useState<{ stage: string; error: string } | null>(null);
  const [lastAiOutcome, setLastAiOutcome] = useState<string>('not_attempted');

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
        setProcessingStage('AI unavailable — switching to offline processing…');
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
        }

        setProcessingStage(
          aiResponseReceived
            ? 'AI response received'
            : aiFailed
              ? 'AI unavailable — offline output ready'
              : 'Content ready'
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

  const byokManager = useByokManager();
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

  const handleCaptureWithUiLock = async () => {
    setIsProcessing(true);
    setProcessingComplete(false);
    setProcessingStep('initialization');
    setProcessingStage(state.mode === 'ai' ? 'Preparing AI request...' : 'Capturing content...');
    setAutoCloseCountdown(null);
    setAiFallbackInfo(null);
    setLastAiOutcome('not_attempted');

    try {
      await handleCapture();
    } catch {
      setIsProcessing(false);
      setProcessingStep('error');
    }
  };

  const openCheckout = async () => {
    try {
      await browser.tabs.create({ url: CHECKOUT_URL });
    } catch (error) {
      console.error('Failed to open checkout page:', error);
    }
  };

  const animationsEnabled = state.settings?.ui?.animations ?? true;
  const revealClass = animationsEnabled ? 'animate-in fade-in slide-in-from-bottom-2 duration-300' : '';

  const modeStatusLabel = state.mode === 'offline'
    ? 'Offline mode'
    : state.settings?.flags?.developerMode
      ? 'AI mode • Developer'
      : state.isUnlocked
        ? 'AI mode • Unlocked unlimited'
        : 'AI mode • BYOK freemium';

  const aiUsageLabel = state.settings?.flags?.developerMode
    ? 'Unlimited AI uses'
    : state.isUnlocked
      ? 'Unlimited AI unlocked'
      : state.hasApiKey
        ? `${Math.max(0, state.remainingFreeByokStartsToday)} free AI starts left today`
        : 'Add OpenRouter API key to use AI mode';

  const formatPipelineStage = (stage: string): string => {
    switch (stage) {
      case 'initialization':
        return 'Capture request queued';
      case 'preprocessing':
        return 'Cleaning and preparing content';
      case 'ai-processing':
        return 'Sending request to OpenRouter';
      case 'byok-processing':
        return 'Waiting for AI response';
      case 'postprocessing':
        return 'Validating and finalizing output';
      case 'fallback':
        return 'Fallback to offline pipeline';
      default:
        return stage;
    }
  };

  const truncateMessage = (value: string, max = 140): string => {
    if (!value) return '';
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
  };

  const shouldShowAiLockCard =
    state.mode === 'ai' &&
    !state.canUseAIMode &&
    !state.settings?.flags?.developerMode;

  return (
    <div className="relative w-96 max-h-[600px] bg-background text-foreground antialiased flex flex-col overflow-hidden">
      <div className="bg-background/95 backdrop-blur-sm text-foreground p-4 shadow-sm border-b border-border z-20 relative shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <LayoutTemplate className="w-6 h-6 text-brand-primary" />
            <div className="flex flex-col leading-tight">
              <h1 className="text-lg font-medium tracking-tight">PromptReady</h1>
              <p className="text-[11px] text-muted-foreground">Clean, structure, and cite web content for perfect prompts</p>
            </div>
            {state.settings?.flags?.developerMode && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-yellow-500 text-black rounded font-bold uppercase tracking-wider">DEV</span>
            )}
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
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
              setShowSettings(true);
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
                hasApiKey={byokManager.hasApiKey}
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
                  <p className="text-sm font-semibold text-foreground">AI mode needs your OpenRouter API key</p>
                  <p className="text-xs text-muted-foreground mb-3 mt-1">Offline mode stays free and always available.</p>
                  <button
                    onClick={() => setShowSettings(true)}
                    className="w-full py-2.5 px-4 bg-background text-brand-primary border border-brand-primary rounded-full hover:bg-brand-surface active:scale-[0.98] transition-all duration-200 ease-out text-sm font-semibold shadow-sm"
                  >
                    Configure API Key
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-foreground">Daily free AI limit reached</p>
                  <p className="text-xs text-muted-foreground mb-3 mt-1">
                    Use Offline mode for free, or unlock unlimited BYOK usage.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setShowSettings(true)}
                      className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 bg-background text-brand-primary border border-brand-primary rounded-full hover:bg-brand-surface active:scale-[0.98] transition-all duration-200 ease-out text-sm font-semibold shadow-sm"
                    >
                      <KeyRound className="w-4 h-4" />
                      Enter unlock
                    </button>
                    <button
                      onClick={openCheckout}
                      className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 bg-brand-primary text-brand-primary-foreground border border-[#c90000] rounded-full hover:bg-[#d20000] active:scale-[0.98] transition-all duration-200 ease-out text-sm font-semibold shadow-sm"
                    >
                      <CreditCard className="w-4 h-4" />
                      Checkout
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

                {state.mode === 'ai' && state.exportData && (() => {
                  const outcome = state.exportData.aiOutcome || 'not_attempted';
                  const isSuccess = outcome === 'success';
                  const isMissingKey = outcome === 'fallback_missing_key';
                  const isDailyLimit = outcome === 'fallback_daily_limit_reached';
                  const isRequestFailed = outcome === 'fallback_request_failed';

                  const toneClass = isSuccess
                    ? 'border-emerald-600/30 bg-emerald-600/10 text-emerald-700'
                    : isMissingKey
                      ? 'border-sky-600/30 bg-sky-600/10 text-sky-700'
                      : isDailyLimit
                        ? 'border-amber-600/30 bg-amber-600/10 text-amber-800'
                        : isRequestFailed
                          ? 'border-rose-600/30 bg-rose-600/10 text-rose-700'
                          : 'border-amber-600/30 bg-amber-600/10 text-amber-800';

                  const title = isSuccess
                    ? 'AI processed successfully'
                    : isMissingKey
                      ? 'AI not configured (offline output generated)'
                      : isDailyLimit
                        ? 'Daily limit reached (offline output generated)'
                        : 'AI failed (offline output generated)';

                  const detail = isSuccess
                    ? 'OpenRouter response received.'
                    : isMissingKey
                      ? 'Add an OpenRouter API key in Settings to enable AI processing.'
                      : isDailyLimit
                        ? 'Enter unlock code or checkout to continue unlimited AI mode.'
                        : aiFallbackInfo
                          ? `Failed at ${formatPipelineStage(aiFallbackInfo.stage)}: ${truncateMessage(aiFallbackInfo.error)}`
                          : 'AI request failed and the extension used the offline pipeline instead.';

                  return (
                    <div className={`mb-3 rounded-lg border px-3 py-2 text-xs ${toneClass}`}>
                      <div className="flex items-start gap-2">
                        {isSuccess ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4" />
                        ) : (
                          <AlertTriangle className="mt-0.5 h-4 w-4" />
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold">{title}</div>
                          <div className="mt-0.5 text-[11px] opacity-85 leading-snug">{detail}</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleCopy(state.exportData!.markdown)}
                    className="group w-full rounded-xl border border-border bg-background text-card-foreground hover:bg-brand-surface hover:border-brand-primary/30 active:scale-[0.98] shadow-sm p-3 text-left transition-all duration-200 ease-out"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-brand-surface rounded-lg group-hover:bg-brand-primary group-hover:text-white transition-colors">
                        <ClipboardCopy className="w-4 h-4 text-brand-primary group-hover:text-white transition-colors" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-foreground">Copy MD</span>
                        <span className="text-[10px] text-muted-foreground">To clipboard</span>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleExport('md')}
                    className="group w-full rounded-xl border border-border bg-background text-card-foreground hover:bg-brand-surface hover:border-brand-primary/30 active:scale-[0.98] shadow-sm p-3 text-left transition-all duration-200 ease-out"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-brand-surface rounded-lg group-hover:bg-brand-primary group-hover:text-white transition-colors">
                        <Download className="w-4 h-4 text-brand-primary group-hover:text-white transition-colors" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-foreground">Save MD</span>
                        <span className="text-[10px] text-muted-foreground">Download file</span>
                      </div>
                    </div>
                  </button>
                </div>

                <button
                  onClick={() => handleCopy(JSON.stringify(state.exportData!.json, null, 2))}
                  className="group w-full mt-2 rounded-xl border border-border bg-background text-card-foreground hover:bg-brand-surface hover:border-brand-primary/30 active:scale-[0.98] shadow-sm p-3 text-left transition-all duration-200 ease-out"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-brand-surface rounded-lg group-hover:bg-brand-primary group-hover:text-white transition-colors">
                      <FileJson className="w-4 h-4 text-brand-primary group-hover:text-white transition-colors" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-foreground">Copy JSON</span>
                      <span className="text-[10px] text-muted-foreground">Structured data for automation</span>
                    </div>
                  </div>
                </button>
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
                  <h4 className="text-xs font-medium text-foreground mb-1">Developer Info</h4>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Pipeline: {state.exportData.pipelineUsed || 'standard'}</div>
                    <div>Chars: {(state.exportData.markdown || '').length}</div>
                    {state.exportData.stats && (
                      <div>Stats: {JSON.stringify(state.exportData.stats)}</div>
                    )}
                  </div>
                </div>
              )}

              {state.settings?.flags?.developerMode && hasContent && (
                <div className="border-t border-border pt-3">
                  <h4 className="text-xs font-medium text-foreground mb-2">Developer Exports</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleCopy(state.exportData!.markdown)}
                      className="flex items-center justify-center space-x-1 py-1 px-2 bg-muted text-foreground border border-border rounded hover:bg-accent active:scale-[0.98] transition-all text-xs"
                    >
                      <ClipboardCopy className="w-4 h-4" />
                      <span>Raw MD</span>
                    </button>
                    <button
                      onClick={() => handleCopy(JSON.stringify(state.exportData!.json, null, 2))}
                      className="flex items-center justify-center space-x-1 py-1 px-2 bg-muted text-foreground border border-border rounded hover:bg-accent active:scale-[0.98] transition-all text-xs"
                    >
                      <FileJson className="w-4 h-4" />
                      <span>Raw JSON</span>
                    </button>
                    <button
                      onClick={() => handleCopy(state.exportData!.markdown.replace(/`/g, '\\`'))}
                      className="flex items-center justify-center space-x-1 py-1 px-2 bg-muted text-foreground border border-border rounded hover:bg-accent active:scale-[0.98] transition-all text-xs"
                    >
                      <Code2 className="w-4 h-4" />
                      <span>Code Block</span>
                    </button>
                    <button
                      onClick={() => {
                        const html = state.exportData!.json.export?.html || '';
                        handleCopy(html);
                      }}
                      className="flex items-center justify-center space-x-1 py-1 px-2 bg-muted text-foreground border border-border rounded hover:bg-accent active:scale-[0.98] transition-all text-xs"
                    >
                      <Globe className="w-4 h-4" />
                      <span>HTML</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {processingComplete && (() => {
        const outcome = lastAiOutcome || 'not_attempted';
        const isFallback = state.mode === 'ai' && outcome.startsWith('fallback_');
        const isMissingKey = outcome === 'fallback_missing_key';
        const isDailyLimit = outcome === 'fallback_daily_limit_reached';
        const isRequestFailed = outcome === 'fallback_request_failed';

        const iconWrapClass = isFallback
          ? isMissingKey
            ? 'bg-sky-50 border-sky-200'
            : isDailyLimit
              ? 'bg-amber-50 border-amber-200'
              : isRequestFailed
                ? 'bg-rose-50 border-rose-200'
                : 'bg-amber-50 border-amber-200'
          : 'bg-emerald-50 border-emerald-200';

        const iconClass = isFallback
          ? isMissingKey
            ? 'text-sky-700'
            : isDailyLimit
              ? 'text-amber-700'
              : isRequestFailed
                ? 'text-rose-700'
                : 'text-amber-700'
          : 'text-emerald-600';

        const title = isFallback
          ? isMissingKey
            ? 'Offline output ready (AI not configured)'
            : isDailyLimit
              ? 'Offline output ready (daily limit reached)'
              : 'Offline output ready (AI failed)'
          : 'Content ready';

        const detail =
          isFallback && aiFallbackInfo
            ? `Failed at ${formatPipelineStage(aiFallbackInfo.stage)}`
            : undefined;

        return (
          <div className="absolute bottom-4 left-4 right-4 bg-card border border-border text-foreground px-4 py-3 rounded-xl shadow-lg flex items-center justify-between animate-in slide-in-from-bottom-4 duration-300 z-50">
            <div className="flex items-center space-x-3">
              <div className={`rounded-full p-1 border ${iconWrapClass}`}>
                {isFallback ? (
                  <AlertTriangle className={`w-4 h-4 ${iconClass}`} />
                ) : (
                  <CheckCircle2 className={`w-4 h-4 ${iconClass}`} />
                )}
              </div>
              <div>
                <p className="font-semibold text-sm">{title}</p>
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
