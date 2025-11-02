// Simplified popup UI focused on 'open→copy→done' workflow
// Implements AI-first monetization with clear Offline/AI mode toggle
// Perfect separation of concerns using custom hook

import React, { useState, useEffect } from 'react';
import { usePopupController } from './hooks/usePopupController';
import { SettingsPanel } from './components/SettingsPanel';
import { Toast } from './components/Toast';
import type { Settings } from '@/lib/types';
import { ProBadge } from './components/ProBadge';
import { ModeToggle } from './components/ModeToggle';
import { PrimaryButton } from './components/PrimaryButton';
import { ProUpgradePrompt } from './components/ProUpgradePrompt';
import { CreditExhaustedPrompt } from './components/CreditExhaustedPrompt';
import { Storage } from '@/lib/storage';

// Developer mode activation state
let devKeySequence = '';
const DEV_MODE_SEQUENCE = 'devmode'; // Type 'devmode' to activate

// Main popup component - now purely presentational
export default function SimplifiedPopup() {
  const {
    state,
    isProcessing,
    hasContent,
    handleModeToggle,
    handleCapture,
    handleCopy,
    handleExport,
    handleUpgradeClose,
    // Newly exposed handlers
    showToast,
    onSettingsChange,
    onApiKeyChange,
    onApiKeySave,
    onApiKeyTest,
    settingsView, // <-- Add this
    handleSetSettingsView, // <-- Add this
    byokProvider, // <-- Add this
    handleSetByokProvider, // <-- Add this
  } = usePopupController();

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
        const newFlags = {
          ...settings.flags,
          developerMode: !currentDevMode
        };
        
        await Storage.updateSettings({ flags: newFlags });
        
        // Show toast notification
        if (!currentDevMode) {
          console.log('🔓 Developer mode activated - AI mode unrestricted');
          // You could add a toast here if needed
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
    handleSetSettingsView('byokChoice');
  };

  const getAiLabel = () => {
    if (state.settings?.flags?.developerMode) return 'AI (DEV)'; // Developer mode
    if (state.hasApiKey) return 'AI (BYOK)'; // If user has their own key
    if (state.trial && !state.trial.hasExhausted) return 'AI (Trial)'; // If user is on free trial
    return 'AI'; // Default label if neither BYOK nor Trial (e.g., after trial exhausted)
  };

  return (
    <div className="w-96 bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl">📋</span>
            <h1 className="text-lg font-semibold">PromptReady</h1>
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

        {/* Credits and Mode Toggle */}
        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs opacity-90">
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
        <div className="flex justify-between text-xs mt-1 opacity-75">
          <span className={state.mode === 'offline' ? 'font-medium' : ''}>Offline</span>
          <span className={state.mode === 'ai' ? 'font-medium' : ''}>
            {getAiLabel()}
          </span>
        </div>
      </div>

      {/* Settings Panel */}
      <SettingsPanel
        isExpanded={showSettings}
        settings={state.settings as Settings}
        onSettingsChange={onSettingsChange}
        onApiKeyChange={onApiKeyChange}
        onApiKeySave={onApiKeySave}
        onApiKeyTest={onApiKeyTest}
        hasApiKey={state.hasApiKey}
        apiKeyInput={state.apiKeyInput}
        settingsView={settingsView} // <-- Add this
        onSetSettingsView={handleSetSettingsView} // <-- Add this
        byokProvider={byokProvider} // <-- Add this
        onSetByokProvider={handleSetByokProvider} // <-- Add this
      />

      {/* Main Content */}
      <div className="p-4">
        {/* Capture Button */}
        <PrimaryButton
          onClick={handleCapture}
          disabled={isProcessing || (state.credits?.remaining === 0 && !state.settings?.flags?.developerMode)}
          isProcessing={isProcessing}
          processingText={state.processing.message || 'Processing...'}
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
                <button
                  onClick={() => handleCopy(state.exportData!.markdown)}
                  className="flex items-center justify-center space-x-1 py-2 px-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                >
                  <span>📋</span>
                  <span>Copy MD</span>
                </button>
                <button
                  onClick={() => handleExport('md')}
                  className="flex items-center justify-center space-x-1 py-2 px-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                >
                  <span>💾</span>
                  <span>Save MD</span>
                </button>
              </div>
              <button
                onClick={() => handleCopy(JSON.stringify(state.exportData!.json, null, 2))}
                className="w-full mt-2 py-2 px-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm"
              >
                📄 Copy JSON
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

      {/* Toast Notifications */}
      {state.toast && (
        <Toast
          message={state.toast.message}
          type={state.toast.type}
          onClose={() => {}}
        />
      )}

      {/* Upgrade Modal */}
      <ProUpgradePrompt
        isVisible={state.showUpgrade}
        onClose={handleUpgradeClose}
        onUpgrade={() => setShowSettings(true)}
      />
    </div>
  );
}
