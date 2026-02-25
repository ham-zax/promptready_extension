// Refactored popup UI with focused hooks and simplified authentication
// Implements modern state management with proper separation of concerns

import React, { useState, useEffect } from 'react';
import { usePopupController } from './hooks/usePopupController';
import { useByokManager } from './hooks/useByokManager';
import { useProManager } from './hooks/useProManager';
import { useToastManager } from './hooks/useToastManager';
import { UnifiedSettings } from './components/UnifiedSettings';
import { ToastContainer } from './components/ToastContainer';
import type { Settings } from '@/lib/types';
import { ProBadge } from './components/ProBadge';
import { ModeToggle } from './components/ModeToggle';
import { PrimaryButton } from './components/PrimaryButton';
import { ProUpgradePrompt } from './components/ProUpgradePrompt';
import { Storage } from '@/lib/storage';
import { LoadingOverlay } from './components/LoadingOverlay';
import { browser } from 'wxt/browser';
import { LayoutTemplate, Settings as SettingsIcon, ClipboardCopy, Download, FileJson, Code2, Globe, CheckCircle2, X } from 'lucide-react';

// Developer mode activation state
let devKeySequence = '';
const DEV_MODE_SEQUENCE = 'devmode'; // Type 'devmode' to activate

// Main popup component with refactored architecture
export default function RefactoredPopup() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [processingComplete, setProcessingComplete] = useState(false);
  const [autoCloseCountdown, setAutoCloseCountdown] = useState<number | null>(null);

  useEffect(() => {
    // Listen for processing progress
    const handleProgress = (message: any) => {
      if (message.type === 'PROCESSING_PROGRESS') {
        setProcessingStage(message.payload.message);
        setIsProcessing(true);
        setProcessingComplete(false);
      } else if (message.type === 'PROCESSING_COMPLETE') {
        setIsProcessing(false);
        setProcessingComplete(true);
        
        // Check user preference for auto-close
        const checkAutoClose = async () => {
          const settings = await Storage.getSettings();
          // Default to keeping popup open (true) if setting doesn't exist
          const keepOpen = settings.ui?.keepPopupOpen ?? true;
          const delay = settings.ui?.autoCloseDelay ?? 3000;

          if (!keepOpen) {
            // Start countdown
            setAutoCloseCountdown(Math.floor(delay / 1000));
            
            const countdownInterval = setInterval(() => {
              setAutoCloseCountdown(prev => {
                if (prev === null || prev <= 1) {
                  clearInterval(countdownInterval);
                  window.close();
                  return null;
                }
                return prev - 1;
              });
            }, 1000);
          } else {
            console.log('[Popup] Keeping popup open (keepPopupOpen:', keepOpen, ')');
          }
        };

        checkAutoClose();
      } else if (message.type === 'PROCESSING_ERROR') {
        setIsProcessing(false);
        setProcessingComplete(false);
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
        e.returnValue = ''; // Standard way to show "are you sure" dialog
        return 'Processing in progress...';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isProcessing]);

  // Legacy controller for basic functionality
  const {
    state,
    hasContent,
    handleModeToggle,
    handleCapture,
    handleCopy,
    handleExport,
    handleUpgradeClose,
    onSettingsChange,
  } = usePopupController();

  // New focused hooks
  const byokManager = useByokManager();
  const proManager = useProManager();
  const toastManager = useToastManager();

  const [showSettings, setShowSettings] = useState(false);

  // Apply theme to document
  useEffect(() => {
    if (state.settings?.ui?.theme) {
      const theme = state.settings.ui.theme;
      const isDark = 
        theme === 'dark' || 
        (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else {
      // Default to system
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [state.settings?.ui?.theme]);

  // Developer mode activation via keyboard sequence
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only process keys when not focused on input elements
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      devKeySequence += event.key.toLowerCase();
      
      // Check if sequence matches
      if (devKeySequence.includes(DEV_MODE_SEQUENCE)) {
        toggleDeveloperMode();
        devKeySequence = ''; // Reset sequence
      }
      
      // Keep sequence length manageable
      if (devKeySequence.length > 20) {
        devKeySequence = devKeySequence.slice(-10);
      }
    };
  const toggleDeveloperMode = async () => {
    try {
      const settings = await Storage.getSettings();
      const currentDevMode = settings.flags?.developerMode || false;

      // Build a complete FeatureFlags object to satisfy required booleans
      const newFlags = {
        aiModeEnabled: settings.flags?.aiModeEnabled ?? true,
        byokEnabled: settings.flags?.byokEnabled ?? true,
        trialEnabled: settings.flags?.trialEnabled ?? false,
        developerMode: !currentDevMode,
      };

      await Storage.updateSettings({ flags: newFlags });

      // Show toast/log notification
      if (!currentDevMode) {
        console.log('🔓 Developer mode activated - AI mode unrestricted');
      } else {
        console.log('🔒 Developer mode deactivated');
      }
    } catch (error) {
      console.error('Failed to toggle developer mode:', error);
    }
  };

  document.addEventListener('keypress', handleKeyPress);
  return () => document.removeEventListener('keypress', handleKeyPress);
}, []);

  const handleShowSettings = () => {
    setShowSettings(true);
  };

  const getAiLabel = () => {
    if (state.settings?.flags?.developerMode) return 'AI (DEV)'; // Developer mode
    if (byokManager.hasApiKey) return 'AI (BYOK)'; // If user has their own key
    if (proManager.isInTrial) return 'AI (Trial)'; // If user is on free trial
    return 'AI'; // Default label if neither BYOK nor Trial (e.g., after trial exhausted)
  };

  return (
    <div className="relative w-96 max-h-[600px] bg-background text-foreground antialiased flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-brand-primary text-brand-primary-foreground p-4 shadow-sm border-b border-brand-border z-20 relative shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <LayoutTemplate className="w-6 h-6 text-brand-primary-foreground" />
            <div className="flex flex-col leading-tight">
              <h1 className="text-lg font-semibold">PromptReady</h1>
              <p className="text-[11px] opacity-90">Clean, structure, and cite web content for perfect prompts</p>
            </div>
            {state.isPro && <ProBadge />}
            {state.settings?.flags?.developerMode && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-yellow-500 text-black rounded font-bold uppercase tracking-wider">DEV</span>
            )}
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded-lg transition-all active:scale-95 ${showSettings ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-white/90 hover:text-white'}`}
            aria-label="Settings"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Status + Mode Toggle */}
        <div className="mt-4">
          <ModeToggle
            mode={state.mode}
            onChange={(m: Settings['mode']) => {
              onSettingsChange({ mode: m });
              setShowSettings(false);
            }}
            onUpgradePrompt={() => {
              handleModeToggle();
              setShowSettings(false);
            }}
          />
        </div>
      </div>

      {/* Scrollable Container for Settings and Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
        {/* Unified Settings Panel - Now scrolls underneath header */}
        <div
          className={`grid transition-[grid-template-rows,border-color] duration-300 ease-in-out shrink-0 ${
            showSettings ? 'grid-rows-[1fr] border-b border-brand-border' : 'grid-rows-[0fr] border-transparent border-b-0'
          }`}
        >
          <div className="overflow-hidden">
            <UnifiedSettings
              isExpanded={showSettings}
              settings={state.settings as Settings}
              onSettingsChange={onSettingsChange}
              isPro={state.isPro}
              hasApiKey={byokManager.hasApiKey}
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="p-4 flex-1 flex flex-col">
          {/* Capture Button */}
        <PrimaryButton
          onClick={handleCapture}
          disabled={isProcessing || (state.credits?.remaining === 0 && !state.settings?.flags?.developerMode)}
          isProcessing={isProcessing}
          processingText={processingStage || 'Processing...'}
        >
          Capture Content
        </PrimaryButton>

        {/* Upgrade Prompt View */}
        {state.credits?.remaining === 0 && !state.settings?.flags?.developerMode && (
          <div className="p-4 text-center mt-2 bg-amber-50 rounded-xl border border-amber-200">
            <p className="text-sm font-semibold text-amber-900">You&apos;re out of free credits</p>
            <p className="text-xs text-amber-700 mb-3 mt-1">Upgrade to continue using AI Mode.</p>
            <button
              onClick={handleShowSettings}
              className="w-full py-2 px-4 bg-amber-500 text-amber-950 font-medium rounded-lg hover:bg-amber-400 active:scale-[0.98] transition-all text-sm shadow-sm"
            >
              Upgrade with your API Key
            </button>
          </div>
        )}

        {/* Processing Progress */}
        {isProcessing && state.processing.progress && (
          <div className="mt-4">
            <div className="bg-muted rounded-full h-1.5 overflow-hidden border border-border">
              <div
                className="bg-brand-primary h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${state.processing.progress}%` }}
              ></div>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center font-medium animate-pulse">
              {state.processing.message}
            </p>
          </div>
        )}

        {/* Export Options */}
        {hasContent && (
          <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="border-t border-border pt-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Export Options</h3>

              <div className="grid grid-cols-2 gap-2">
                {/* Copy Markdown (Card) */}
                <button
                  onClick={() => handleCopy(state.exportData!.markdown)}
                  className="group w-full rounded-xl border border-border bg-card text-card-foreground hover:bg-brand-surface hover:border-brand-primary/30 active:scale-[0.98] shadow-sm hover:shadow p-3 text-left transition-all duration-200 ease-out"
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

                {/* Save Markdown (Card) */}
                <button
                  onClick={() => handleExport('md')}
                  className="group w-full rounded-xl border border-border bg-card text-card-foreground hover:bg-brand-surface hover:border-brand-primary/30 active:scale-[0.98] shadow-sm hover:shadow p-3 text-left transition-all duration-200 ease-out"
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

              {/* Copy JSON (Full-width Card) */}
              <button
                onClick={() => handleCopy(JSON.stringify(state.exportData!.json, null, 2))}
                className="group w-full mt-2 rounded-xl border border-border bg-card text-card-foreground hover:bg-brand-surface hover:border-brand-primary/30 active:scale-[0.98] shadow-sm hover:shadow p-3 text-left transition-all duration-200 ease-out"
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

            {/* Quality Report */}
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

            {/* Developer Info */}
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

            {/* Developer Export Options */}
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

      {/* Processing complete notification */}
      {processingComplete && (
        <div className="absolute bottom-4 left-4 right-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl shadow-lg flex items-center justify-between animate-in slide-in-from-bottom-4 duration-300 z-50">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <div>
              <p className="font-semibold text-sm">Content copied!</p>
              {autoCloseCountdown !== null && (
                <p className="text-xs text-green-600/80 mt-0.5">Closing in {autoCloseCountdown}s...</p>
              )}
            </div>
          </div>
          <button
            onClick={() => setAutoCloseCountdown(null)}
            className="text-green-600/60 hover:text-green-800 active:scale-95 transition-all p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Toast Notifications */}
      <ToastContainer
        toasts={toastManager.toasts}
        onHide={toastManager.hideToast}
      />

      {/* Upgrade Modal */}
      <ProUpgradePrompt
        isVisible={state.showUpgrade}
        onClose={handleUpgradeClose}
        onUpgradeComplete={() => {
          toastManager.showSuccess('Trial activated successfully!');
          handleUpgradeClose();
        }}
      />
      {isProcessing && (
        <LoadingOverlay status="processing" message={processingStage} progress={undefined} />
      )}
    </div>
  );
}
