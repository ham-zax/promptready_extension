// Refactored popup UI with focused hooks and simplified authentication
// Implements modern state management with proper separation of concerns

import React, { useState, useEffect } from 'react';
import { usePopupController } from './hooks/usePopupController';
import { useByokManager } from './hooks/useByokManager';
import { useProManager } from './hooks/useProManager';
import { useErrorHandler } from './hooks/useErrorHandler';
import { useToastManager } from './hooks/useToastManager';
import { UnifiedSettings } from './components/UnifiedSettings';
import { ToastContainer } from './hooks/useToastManager';
import type { Settings } from '@/lib/types';
import { ProBadge } from './components/ProBadge';
import { ModeToggle } from './components/ModeToggle';
import { PrimaryButton } from './components/PrimaryButton';
import { ProUpgradePrompt } from './components/ProUpgradePrompt';
import { CreditExhaustedPrompt } from './components/CreditExhaustedPrompt';
import { Storage } from '@/lib/storage';
import { LoadingOverlay } from './components/LoadingOverlay';
import { browser } from 'wxt/browser';

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
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
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
  const errorHandler = useErrorHandler();
  const toastManager = useToastManager();

  const [showSettings, setShowSettings] = useState(false);

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

  // Enhanced handlers using new hooks
  const handleUpgrade = () => {
    toastManager.showPersistentToast(
      'Choose your upgrade path:',
      'info',
      {
        label: 'Start Free Trial',
        onClick: () => proManager.startTrial('user@example.com'),
      }
    );
  };

  return (
    <div className="relative w-96 bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl">📋</span>
            <div className="flex flex-col leading-tight">
              <h1 className="text-lg font-semibold">PromptReady</h1>
              <p className="text-[11px] opacity-90">Clean, structure, and cite web content for perfect prompts</p>
            </div>
            {state.isPro && <ProBadge />}
            {state.settings?.flags?.developerMode && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-yellow-500 text-black rounded font-medium">DEV</span>
            )}
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1 rounded hover:bg-white hover:bg-opacity-20 transition-colors"
            aria-label="Settings"
          >
            ⚙️
          </button>
        </div>

        {/* Status + Mode Toggle */}
        <div className="mt-3 grid grid-cols-1 gap-2">
          <div className="flex items-center justify-between text-xs">
            <div>
              {state.settings?.flags?.developerMode ? (
                <span className="text-yellow-300">Developer Mode Active</span>
              ) : (
                !state.isPro && state.trial && !state.trial.hasExhausted ? `You have ${state.credits?.remaining} credits left.` : ' '
              )}
            </div>
            <div className="flex items-center">
              <ModeToggle
                mode={state.mode}
                onChange={(m: Settings['mode']) => onSettingsChange({ mode: m })}
                onUpgradePrompt={handleModeToggle}
              />
            </div>
          </div>

          <div className="flex justify-between text-[11px] opacity-80">
            <span className={state.mode === 'offline' ? 'font-semibold' : ''}>Offline</span>
            <span className={state.mode === 'ai' ? 'font-semibold' : ''}>
              {getAiLabel()}
            </span>
          </div>
        </div>
      </div>

      {/* Unified Settings Panel */}
      <UnifiedSettings
        isExpanded={showSettings}
        settings={state.settings as Settings}
        onSettingsChange={onSettingsChange}
        isPro={state.isPro}
        hasApiKey={byokManager.hasApiKey}
      />

      {/* Main Content */}
      <div className="p-4">
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
          <div className="p-4 text-center">
            <p className="text-lg font-semibold">You're out of free credits.</p>
            <p className="text-sm text-gray-600 mb-4">Upgrade to continue using AI Mode.</p>
            <button
              onClick={handleShowSettings}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Upgrade with your API Key
            </button>
          </div>
        )}

        {/* Processing Progress */}
        {isProcessing && state.processing.progress && (
          <div className="mt-3">
            <div className="bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${state.processing.progress}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-600 mt-1 text-center">
              {state.processing.message}
            </p>
          </div>
        )}

        {/* Export Options */}
        {hasContent && (
          <div className="mt-4 space-y-3">
            <div className="border-t pt-3">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Export Options</h3>

              <div className="grid grid-cols-2 gap-2">
                {/* Copy Markdown (Card) */}
                <button
                  onClick={() => handleCopy(state.exportData!.markdown)}
                  className="group w-full rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-sm p-3 text-left transition"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">📋</span>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">Copy Markdown</span>
                      <span className="text-[11px] text-gray-500">Copy cleaned markdown to your clipboard</span>
                    </div>
                  </div>
                </button>

                {/* Save Markdown (Card) */}
                <button
                  onClick={() => handleExport('md')}
                  className="group w-full rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-sm p-3 text-left transition"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">💾</span>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">Save Markdown</span>
                      <span className="text-[11px] text-gray-500">Download as a .md file</span>
                    </div>
                  </div>
                </button>
              </div>

              {/* Copy JSON (Full-width Card) */}
              <button
                onClick={() => handleCopy(JSON.stringify(state.exportData!.json, null, 2))}
                className="w-full mt-2 rounded-lg border border-gray-200 hover:border-purple-500 hover:shadow-sm p-3 text-left transition"
              >
                <div className="flex items-center space-x-2">
                  <span className="text-lg">📄</span>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">Copy JSON</span>
                    <span className="text-[11px] text-gray-500">Copy the structured export (for tools and automation)</span>
                  </div>
                </div>
              </button>
            </div>

            {/* Quality Report */}
            {state.exportData?.qualityReport && (
              <div className="border-t pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Quality Score</span>
                  <span
                    className={`text-xs font-medium ${
                      state.exportData.qualityReport.overallScore >= 80
                        ? 'text-green-600'
                        : state.exportData.qualityReport.overallScore >= 60
                        ? 'text-yellow-600'
                        : 'text-red-600'
                    }`}
                  >
                    {state.exportData.qualityReport.overallScore}/100
                  </span>
                </div>
              </div>
            )}

            {/* Developer Info */}
            {state.settings?.flags?.developerMode && state.exportData && (
              <div className="border-t pt-3">
                <h4 className="text-xs font-medium text-gray-700 mb-1">Developer Info</h4>
                <div className="text-xs text-gray-600 space-y-1">
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
              <div className="border-t pt-3">
                <h4 className="text-xs font-medium text-gray-700 mb-2">Developer Exports</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleCopy(state.exportData!.markdown)}
                    className="flex items-center justify-center space-x-1 py-1 px-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-xs"
                  >
                    <span>📋</span>
                    <span>Raw MD</span>
                  </button>
                  <button
                    onClick={() => handleCopy(JSON.stringify(state.exportData!.json, null, 2))}
                    className="flex items-center justify-center space-x-1 py-1 px-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-xs"
                  >
                    <span>📄</span>
                    <span>Raw JSON</span>
                  </button>
                  <button
                    onClick={() => handleCopy(state.exportData!.markdown.replace(/`/g, '\\`'))}
                    className="flex items-center justify-center space-x-1 py-1 px-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-xs"
                  >
                    <span>💻</span>
                    <span>Code Block</span>
                  </button>
                  <button
                    onClick={() => {
                      const html = state.exportData!.json.export?.html || '';
                      handleCopy(html);
                    }}
                    className="flex items-center justify-center space-x-1 py-1 px-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-xs"
                  >
                    <span>🌐</span>
                    <span>HTML</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Processing complete notification */}
      {processingComplete && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-3">
          <span>✔️</span>
          <div>
            <p className="font-medium">Content copied to clipboard!</p>
            {autoCloseCountdown !== null && (
              <p className="text-sm">Closing in {autoCloseCountdown}s...</p>
            )}
          </div>
          <button
            onClick={() => setAutoCloseCountdown(null)}
            className="ml-4 text-white hover:text-gray-200"
          >
            <span>❌</span>
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
